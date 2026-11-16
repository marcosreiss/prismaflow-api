// migrations/oticacrista/client/client.ts

import { PrismaClient, type Client } from "@prisma/client";

import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { createMigrationLogger } from "@migrations/oticacrista/shared/logger";
import { formatTimestamp } from "@migrations/oticacrista/shared/utils";

import {
    loadClientSources,
    type ClientSource,
    type OrphanClient,
    type OrphanPessoa,
} from "./client.loader";
import { convertClient } from "./client.converter";
import {
    convertOrphanClient,
    convertOrphanPessoa,
} from "./client.orphan-converter";
import { buildClientIndexes, type ClientIndexes } from "./client.index";
import { findClientMatch } from "./client.matcher";
import { createClient, findClientByCpf } from "./client.persistence";
import { createClientReport } from "./client.report";

const prisma = new PrismaClient();

interface Counters {
    created: number;
    existing: number;
    pending: number;
    errors: number;
}

/**
 * Guarda oldId -> { id, name } do cliente já resolvido nesta execução
 * (criado ou casado com um existente). Precisa do nome, e não só do
 * newId, porque quando um oldId repetido aparece de novo (duplicata no
 * CSV de origem) reaproveitamos esse registro via registerExisting,
 * que grava newName no mapping — sem o nome aqui, essa coluna ficaria
 * vazia para os casos de duplicata.
 */
type ResolvedMap = Map<string, { id: number; name: string }>;

/**
 * Verifica se o CPF do registro convertido já pertence a outro cliente
 * existente no banco. Usado como trava de segurança: nunca criar um
 * Client novo com um CPF que já existe em outro registro, mesmo que o
 * matcher não tenha encontrado correspondência segura por nome + CPF
 * (o banco também não permite CPF duplicado no tenant).
 *
 * Usado nos três fluxos (source, orphanClient, orphanPessoa) da mesma
 * forma — antes havia uma checagem equivalente só no fluxo de pessoa
 * órfã (via findClientByCpf contra o banco); aqui ela foi generalizada
 * para os três, usando o mesmo findClientByCpf.
 */
async function findCpfConflict(cpf: string | null): Promise<Client | null> {
    return findClientByCpf(prisma, cpf, migrationConfig.tenantId);
}

async function persistNewClient(
    data: ReturnType<typeof convertClient>,
    oldId: string,
    oldName: string,
    matchedBy: string,
    indexes: ClientIndexes,
    resolved: ResolvedMap,
    counters: Counters,
    report: ReturnType<typeof createClientReport>,
    logger: ReturnType<typeof createMigrationLogger>,
): Promise<void> {
    const result = await createClient({
        prisma,
        data,
        tenantId: migrationConfig.tenantId,
        branchId: migrationConfig.branchId,
        indexes,
        dryRun: migrationConfig.dryRun,
    });

    counters.created++;

    if (migrationConfig.dryRun) {
        logger.info(`[CREATE DRY_RUN] ${oldId} | ${data.name}`);
        return;
    }

    const client = result.client as Client;

    resolved.set(oldId, { id: client.id, name: client.name });

    report.appendMapping({
        oldId,
        newId: client.id,
        status: "CREATED",
        oldName,
        newName: client.name,
        matchedBy,
    });

    logger.info(`[CREATED] ${oldId} → ${client.id} | ${client.name}`);
}

function registerExisting(
    oldId: string,
    oldName: string,
    client: { id: number; name: string },
    matchedBy: string,
    resolved: ResolvedMap,
    counters: Counters,
    report: ReturnType<typeof createClientReport>,
    logger: ReturnType<typeof createMigrationLogger>,
): void {
    resolved.set(oldId, { id: client.id, name: client.name });
    counters.existing++;

    if (!migrationConfig.dryRun) {
        report.appendMapping({
            oldId,
            newId: client.id,
            status: "EXISTING",
            oldName,
            newName: client.name,
            matchedBy,
        });
    }

    logger.info(`[EXISTING] ${oldId} → ${client.id} | matchedBy=${matchedBy}`);
}

async function processSource(
    source: ClientSource,
    index: number,
    total: number,
    indexes: ClientIndexes,
    resolved: ResolvedMap,
    counters: Counters,
    report: ReturnType<typeof createClientReport>,
    logger: ReturnType<typeof createMigrationLogger>,
): Promise<void> {
    const oldId = source.cliente.cliPessoa;
    const oldName = source.pessoa.pesNome;

    logger.info(`[${index}/${total}] ${oldName}`);

    const alreadyResolved = resolved.get(oldId);

    if (alreadyResolved) {
        registerExisting(
            oldId,
            oldName,
            alreadyResolved,
            "ALREADY_MAPPED",
            resolved,
            counters,
            report,
            logger,
        );

        return;
    }

    try {
        const converted = convertClient(source);
        const match = findClientMatch(source, indexes);

        if (match.client) {
            registerExisting(
                oldId,
                oldName,
                match.client,
                match.matchedBy,
                resolved,
                counters,
                report,
                logger,
            );

            return;
        }

        const conflict = await findCpfConflict(converted.cpf);

        if (conflict) {
            report.addPending({
                oldId,
                name: converted.name,
                reason:
                    "CPF já pertence a outro cliente e não houve correspondência segura por nome + CPF.",
                cpf: converted.cpf,
                ambiguousBy: match.ambiguousBy,
            });

            counters.pending++;
            logger.warning(`[PENDING] CPF em conflito | ${converted.name}`);

            return;
        }

        await persistNewClient(
            converted,
            oldId,
            oldName,
            "CREATE",
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    } catch (error) {
        counters.errors++;

        report.addError({ oldId, name: oldName, error });

        logger.error(`[ERRO] ${oldName}`);
        logger.error(error instanceof Error ? error.message : String(error));
    }
}

async function processOrphanClient(
    orphan: OrphanClient,
    index: number,
    total: number,
    indexes: ClientIndexes,
    resolved: ResolvedMap,
    counters: Counters,
    report: ReturnType<typeof createClientReport>,
    logger: ReturnType<typeof createMigrationLogger>,
): Promise<void> {
    const oldId = orphan.cliente.cliPessoa;
    const label = `PESCLIENTE ${oldId}`;

    logger.info(`[ÓRFÃO PESCLIENTE ${index}/${total}] cliPessoa=${oldId}`);

    const alreadyResolved = resolved.get(oldId);

    if (alreadyResolved) {
        registerExisting(
            oldId,
            label,
            alreadyResolved,
            "ALREADY_MAPPED",
            resolved,
            counters,
            report,
            logger,
        );

        return;
    }

    try {
        const converted = convertOrphanClient(orphan);

        /*
         * pesCliente órfão não tem CPF (não vem de pessoa.csv), então
         * não há conflito de CPF possível aqui — segue direto para
         * criação.
         */
        await persistNewClient(
            converted,
            oldId,
            label,
            "ORPHAN_PESCLIENTE",
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    } catch (error) {
        counters.errors++;

        report.addError({
            oldId,
            name: label,
            orphanType: "PESCLIENTE_WITHOUT_PESSOA",
            error,
        });

        logger.error(`[ERRO ÓRFÃO] cliPessoa=${oldId}`);
        logger.error(error instanceof Error ? error.message : String(error));
    }
}

async function processOrphanPessoa(
    orphan: OrphanPessoa,
    index: number,
    total: number,
    indexes: ClientIndexes,
    resolved: ResolvedMap,
    counters: Counters,
    report: ReturnType<typeof createClientReport>,
    logger: ReturnType<typeof createMigrationLogger>,
): Promise<void> {
    const oldId = orphan.pessoa.pesId;
    const oldName = orphan.pessoa.pesNome;

    logger.info(`[ÓRFÃO PESSOA ${index}/${total}] ${oldName}`);

    const alreadyResolved = resolved.get(oldId);

    if (alreadyResolved) {
        registerExisting(
            oldId,
            oldName,
            alreadyResolved,
            "ALREADY_MAPPED",
            resolved,
            counters,
            report,
            logger,
        );

        return;
    }

    try {
        const converted = convertOrphanPessoa(orphan);

        /*
         * pessoa órfã tem CPF (vem de pessoa.csv). Se o CPF já
         * pertence a um cliente existente, reaproveitamos esse
         * cliente em vez de criar um novo — aqui não há nome de
         * pesCliente para desambiguar contra, então o CPF sozinho
         * já é a evidência mais forte disponível.
         */
        const conflict = await findCpfConflict(converted.cpf);

        if (conflict) {
            registerExisting(
                oldId,
                oldName,
                conflict,
                "CPF",
                resolved,
                counters,
                report,
                logger,
            );

            return;
        }

        await persistNewClient(
            converted,
            oldId,
            oldName,
            "ORPHAN_PESSOA",
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    } catch (error) {
        counters.errors++;

        report.addError({
            oldId,
            name: oldName,
            orphanType: "PESSOA_WITHOUT_PESCLIENTE",
            error,
        });

        logger.error(`[ERRO ÓRFÃO] ${oldName}`);
        logger.error(error instanceof Error ? error.message : String(error));
    }
}

async function main(): Promise<void> {
    const startedAt = new Date();

    const logger = createMigrationLogger({
        entity: "client",
        entityReportsDir: "./migrations/oticacrista/modules/client/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });

    const report = createClientReport({
        entityReportsDir: "./migrations/oticacrista/modules/client/reports",
        mappingsDir: "./migrations/oticacrista/mappings",
    });

    logger.info("=================================");
    logger.info("MIGRAÇÃO: CLIENT");
    logger.info("=================================");
    logger.info(`Tenant: ${migrationConfig.tenantId}`);
    logger.info(`Branch: ${migrationConfig.branchId ?? "NÃO DEFINIDA"}`);
    logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);
    logger.info("");

    const { sources, orphanClients, orphanPessoas } = loadClientSources({
        inputDir: migrationConfig.inputDir,
    });

    logger.info(`Registros relacionados: ${sources.length}`);
    logger.info(`pesCliente sem pessoa: ${orphanClients.length}`);
    logger.info(`pessoa sem pesCliente: ${orphanPessoas.length}`);
    logger.info("");

    const existingClients = await prisma.client.findMany({
        where: { tenantId: migrationConfig.tenantId },
    });

    logger.info(`Clientes existentes: ${existingClients.length}`);
    logger.info("");

    const indexes = buildClientIndexes(existingClients);
    const resolved: ResolvedMap = new Map();

    if (!migrationConfig.dryRun) {
        report.startMapping();
    }

    const counters: Counters = {
        created: 0,
        existing: 0,
        pending: 0,
        errors: 0,
    };

    /*
     * 1. Clientes que possuem pessoa + pesCliente (caso normal).
     */
    for (let i = 0; i < sources.length; i++) {
        await processSource(
            sources[i],
            i + 1,
            sources.length,
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    }

    /*
     * 2. pesCliente sem pessoa — cliente parcial, sem CPF/nome real,
     * preservado para não perder o relacionamento de vendas antigas.
     */
    for (let i = 0; i < orphanClients.length; i++) {
        await processOrphanClient(
            orphanClients[i],
            i + 1,
            orphanClients.length,
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    }

    /*
     * 3. pessoa sem pesCliente — cliente parcial, só com os dados de
     * pessoa.csv (pode ter CPF, então passa pela checagem de conflito).
     */
    for (let i = 0; i < orphanPessoas.length; i++) {
        await processOrphanPessoa(
            orphanPessoas[i],
            i + 1,
            orphanPessoas.length,
            indexes,
            resolved,
            counters,
            report,
            logger,
        );
    }

    const finishedAt = new Date();

    if (migrationConfig.dryRun) {
        logger.info("DRY RUN finalizado. Nenhum mapping foi criado ou alterado.");
    } else if (counters.errors === 0) {
        report.finalizeMapping();
        logger.info("Mapping de client atualizado com sucesso.");
    } else {
        report.discardMapping();
        logger.warning("O mapping não foi atualizado porque ocorreram erros.");
    }

    report.savePendingAndErrors();

    const total = sources.length + orphanClients.length + orphanPessoas.length;

    report.saveExecution({
        entity: "Client",
        tenantId: migrationConfig.tenantId,
        dryRun: migrationConfig.dryRun,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        total,
        created: counters.created,
        existing: counters.existing,
        errors: counters.errors,
        pending: counters.pending,
    });

    logger.info("");
    logger.info("=================================");
    logger.info("MIGRAÇÃO FINALIZADA");
    logger.info("=================================");
    logger.info(`Total:      ${total}`);
    logger.info(`Created:    ${counters.created}`);
    logger.info(`Existing:   ${counters.existing}`);
    logger.info(`Pending:    ${counters.pending}`);
    logger.info(`Errors:     ${counters.errors}`);
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });