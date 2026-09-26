import {
    Client,
    PrismaClient,
} from "@prisma/client";

import {
    loadClientSources,
    type ClientSource,
    type OrphanClient,
    type OrphanPessoa,
} from "./loaders/pesCliente.loader";

import {
    convertClient,
    normalizeCpf,
} from "./converters/client.converter";

import {
    convertOrphanClient,
    convertOrphanPessoa,
} from "./converters/orphan-client.converter";

import {
    createClient,
} from "./service/client/client.persistence";

import {
    buildClientIndexes,
} from "./service/client/client.index";

import {
    findClientMatch,
} from "./service/client/client.matcher";

import {
    createTimestamp,
    saveClientErrors,
    saveClientExecution,
} from "./service/client/client.report";

import {
    createTemporaryMappingFile,
    appendTemporaryMapping,
    finalizeClientMapping,
    discardTemporaryMapping,
    loadClientMapping,
} from "./mapping/client.mapping";

/* =========================================================
 * CONFIGURAÇÃO
 * ========================================================= */

const prisma =
    new PrismaClient();

const TENANT_ID =
    "cmibvcyed00007m0118rkgft8";

const BRANCH_ID =
    "cmibvcyed00017m014r66e39w";

const DRY_RUN = false;

/* =========================================================
 * TIPOS
 * ========================================================= */

interface MigrationCounters {
    created: number;
    existing: number;
    pending: number;
    errors: number;
}

interface MigrationReports {
    pending: unknown[];
    errors: unknown[];
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function hasCpfConflict(
    convertedCpf: string | null,
    existingClients: Client[],
): boolean {
    if (!convertedCpf) {
        return false;
    }

    const cpf =
        normalizeCpf(convertedCpf);

    if (!cpf) {
        return false;
    }

    return existingClients.some(
        (client) =>
            normalizeCpf(client.cpf) ===
            cpf,
    );
}

function addPending(
    reports: MigrationReports,
    record: unknown,
): void {
    reports.pending.push(record);
}

function addError(
    reports: MigrationReports,
    record: unknown,
): void {
    reports.errors.push(record);
}

async function persistClient(
    converted: ReturnType<typeof convertClient>,
    oldId: string,
    oldName: string,
    indexes: ReturnType<
        typeof buildClientIndexes
    >,
    mapping: Map<string, number>,
    counters: MigrationCounters,
): Promise<Client> {
    const client =
        await createClient({
            prisma,
            data: converted,
            tenantId: TENANT_ID,
            branchId: BRANCH_ID,
            indexes,
        });

    appendTemporaryMapping({
        oldId,
        newId: client.id,
        status: "CREATED",
        oldName,
        newName: client.name,
        matchedBy: "CREATE",
    });

    mapping.set(
        oldId,
        client.id,
    );

    counters.created++;

    console.log(
        `✓ CREATED | ${client.name} | new_id=${client.id}`,
    );

    return client;
}

/* =========================================================
 * CLIENTES RELACIONADOS
 * ========================================================= */

async function processSource(
    source: ClientSource,
    index: number,
    total: number,
    existingClients: Client[],
    indexes: ReturnType<
        typeof buildClientIndexes
    >,
    mapping: Map<string, number>,
    reports: MigrationReports,
    counters: MigrationCounters,
): Promise<void> {
    const oldId =
        source.cliente.cliPessoa;

    const oldName =
        source.pessoa.pesNome;

    console.log(
        `\n[${index}/${total}] ${oldName}`,
    );

    if (mapping.has(oldId)) {
        console.log(
            `→ EXISTING MAPPING | oldId=${oldId} | newId=${mapping.get(oldId)}`,
        );

        counters.existing++;
        return;
    }

    try {
        const converted =
            convertClient(source);

        const match =
            findClientMatch(
                source,
                indexes,
            );

        if (match.client) {
            console.log(
                `✓ EXISTING | ${converted.name} | matchedBy=${match.matchedBy} | new_id=${match.client.id}`,
            );

            if (!DRY_RUN) {
                appendTemporaryMapping({
                    oldId,
                    newId: match.client.id,
                    status: "EXISTING",
                    oldName,
                    newName:
                        match.client.name,
                    matchedBy:
                        match.matchedBy,
                });
            }

            mapping.set(
                oldId,
                match.client.id,
            );

            counters.existing++;
            return;
        }

        if (
            hasCpfConflict(
                converted.cpf,
                existingClients,
            )
        ) {
            addPending(
                reports,
                {
                    oldId,
                    name: converted.name,
                    status: "PENDING",
                    reason:
                        "CPF já pertence a outro cliente e não houve correspondência segura por nome + CPF.",
                    cpf: converted.cpf,
                },
            );

            console.log(
                `→ PENDING | CPF em conflito | ${converted.name}`,
            );

            counters.pending++;
            return;
        }

        if (!DRY_RUN) {
            await persistClient(
                converted,
                oldId,
                oldName,
                indexes,
                mapping,
                counters,
            );

            return;
        }

        console.log(
            `→ CREATE [DRY_RUN] | ${converted.name}`,
        );

        counters.created++;
    } catch (error) {
        counters.errors++;

        const record = {
            oldId,
            name: oldName,
            status: "ERROR",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        };

        addError(
            reports,
            record,
        );

        console.error(
            `✗ ERROR | ${oldName}`,
        );

        console.error(error);
    }
}

/* =========================================================
 * PESCLIENTE SEM PESSOA
 * ========================================================= */

async function processOrphanClient(
    orphan: OrphanClient,
    index: number,
    total: number,
    indexes: ReturnType<
        typeof buildClientIndexes
    >,
    mapping: Map<string, number>,
    reports: MigrationReports,
    counters: MigrationCounters,
): Promise<void> {
    const oldId =
        orphan.cliente.cliPessoa;

    console.log(
        `\n[ÓRFÃO PESCLIENTE ${index}/${total}] cliPessoa=${oldId}`,
    );

    if (mapping.has(oldId)) {
        console.log(
            `→ EXISTING MAPPING | oldId=${oldId} | newId=${mapping.get(oldId)}`,
        );

        counters.existing++;
        return;
    }

    try {
        const converted =
            convertOrphanClient(
                orphan,
            );

        if (!DRY_RUN) {
            const client =
                await createClient({
                    prisma,
                    data: converted,
                    tenantId: TENANT_ID,
                    branchId: BRANCH_ID,
                    indexes,
                });

            appendTemporaryMapping({
                oldId,
                newId: client.id,
                status: "CREATED",
                oldName:
                    `PESCLIENTE ${oldId}`,
                newName: client.name,
                matchedBy:
                    "ORPHAN_PESCLIENTE",
            });

            mapping.set(
                oldId,
                client.id,
            );

            counters.created++;

            console.log(
                `✓ CREATED ORPHAN | ${client.name} | new_id=${client.id}`,
            );

            return;
        }

        console.log(
            `→ CREATE ORPHAN [DRY_RUN] | ${converted.name}`,
        );

        counters.created++;
    } catch (error) {
        counters.errors++;

        const record = {
            oldId,
            name:
                `PESCLIENTE ${oldId}`,
            status: "ERROR",
            orphanType:
                "PESCLIENTE_WITHOUT_PESSOA",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        };

        addError(
            reports,
            record,
        );

        console.error(
            `✗ ERROR ORPHAN | cliPessoa=${oldId}`,
        );

        console.error(error);
    }
}

/* =========================================================
 * PESSOA SEM PESCLIENTE
 * ========================================================= */

async function processOrphanPessoa(
    orphan: OrphanPessoa,
    index: number,
    total: number,
    indexes: ReturnType<
        typeof buildClientIndexes
    >,
    mapping: Map<string, number>,
    reports: MigrationReports,
    counters: MigrationCounters,
): Promise<void> {
    const oldId =
        orphan.pessoa.pesId;

    const oldName =
        orphan.pessoa.pesNome;

    console.log(
        `\n[ÓRFÃO PESSOA ${index}/${total}] ${oldName}`,
    );

    if (mapping.has(oldId)) {
        console.log(
            `→ EXISTING MAPPING | oldId=${oldId} | newId=${mapping.get(oldId)}`,
        );

        counters.existing++;
        return;
    }

    try {
        const converted =
            convertOrphanPessoa(
                orphan,
            );

        if (!DRY_RUN) {
            const client =
                await createClient({
                    prisma,
                    data: converted,
                    tenantId: TENANT_ID,
                    branchId: BRANCH_ID,
                    indexes,
                });

            appendTemporaryMapping({
                oldId,
                newId: client.id,
                status: "CREATED",
                oldName,
                newName: client.name,
                matchedBy:
                    "ORPHAN_PESSOA",
            });

            mapping.set(
                oldId,
                client.id,
            );

            counters.created++;

            console.log(
                `✓ CREATED ORPHAN | ${client.name} | new_id=${client.id}`,
            );

            return;
        }

        console.log(
            `→ CREATE ORPHAN [DRY_RUN] | ${converted.name}`,
        );

        counters.created++;
    } catch (error) {
        counters.errors++;

        const record = {
            oldId,
            name: oldName,
            status: "ERROR",
            orphanType:
                "PESSOA_WITHOUT_PESCLIENTE",
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        };

        addError(
            reports,
            record,
        );

        console.error(
            `✗ ERROR ORPHAN | ${oldName}`,
        );

        console.error(error);
    }
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main(): Promise<void> {
    const startedAt =
        new Date();

    console.log(
        "\n========================================",
    );

    console.log(
        "MIGRAÇÃO DE CLIENTES",
    );

    console.log(
        "========================================",
    );

    console.log(
        `DRY_RUN: ${DRY_RUN}`,
    );

    console.log(
        `Tenant: ${TENANT_ID}`,
    );

    console.log(
        `Branch: ${BRANCH_ID}`,
    );

    console.log(
        "========================================\n",
    );

    const {
        sources,
        orphanClients,
        orphanPessoas,
    } = loadClientSources();

    console.log(
        `Registros relacionados: ${sources.length}`,
    );

    console.log(
        `pesCliente sem pessoa: ${orphanClients.length}`,
    );

    console.log(
        `pessoa sem pesCliente: ${orphanPessoas.length}`,
    );

    const existingClients =
        await prisma.client.findMany({
            where: {
                tenantId: TENANT_ID,
            },
        });

    console.log(
        `Clientes existentes: ${existingClients.length}`,
    );

    const indexes =
        buildClientIndexes(
            existingClients,
        );

    const mapping =
        loadClientMapping();

    if (!DRY_RUN) {
        createTemporaryMappingFile();
    }

    const reports:
        MigrationReports = {
        pending: [],
        errors: [],
    };

    const counters:
        MigrationCounters = {
        created: 0,
        existing: 0,
        pending: 0,
        errors: 0,
    };

    /*
     * 1. Clientes que possuem
     * pessoa + pesCliente.
     */
    for (
        let i = 0;
        i < sources.length;
        i++
    ) {
        await processSource(
            sources[i],
            i + 1,
            sources.length,
            existingClients,
            indexes,
            mapping,
            reports,
            counters,
        );
    }

    /*
     * 2. pesCliente sem pessoa.
     *
     * Criamos um Client parcial para
     * preservar o relacionamento das
     * vendas futuras.
     */
    for (
        let i = 0;
        i < orphanClients.length;
        i++
    ) {
        await processOrphanClient(
            orphanClients[i],
            i + 1,
            orphanClients.length,
            indexes,
            mapping,
            reports,
            counters,
        );
    }

    /*
     * 3. pessoa sem pesCliente.
     *
     * Criamos um Client utilizando
     * somente os dados disponíveis
     * em pessoa.csv.
     */
    for (
        let i = 0;
        i < orphanPessoas.length;
        i++
    ) {
        await processOrphanPessoa(
            orphanPessoas[i],
            i + 1,
            orphanPessoas.length,
            indexes,
            mapping,
            reports,
            counters,
        );
    }

    const finishedAt =
        new Date();

    /*
     * Mapping definitivo somente
     * quando não existem erros.
     */
    let mappingSaved =
        false;

    if (!DRY_RUN) {
        if (
            counters.errors === 0
        ) {
            finalizeClientMapping();
            mappingSaved = true;
        } else {
            discardTemporaryMapping();

            console.log(
                "\n⚠️ Existem erros. Mapping não foi substituído.",
            );
        }
    }

    /*
     * Relatório de PENDING / ERROR.
     */
    saveClientErrors(
        reports.pending,
        reports.errors,
    );

    /*
     * Relatório da execução.
     */
    saveClientExecution({
        migration: "03-client",
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        dryRun: DRY_RUN,
        startedAt,
        finishedAt,
        total:
            sources.length +
            orphanClients.length +
            orphanPessoas.length,
        created: counters.created,
        existing: counters.existing,
        pending: counters.pending,
        errors: counters.errors,
        mappingSaved,
    });

    console.log(
        "\n========================================",
    );

    console.log(
        "RESUMO",
    );

    console.log(
        "========================================",
    );

    console.log(
        `Total:     ${sources.length +
        orphanClients.length +
        orphanPessoas.length
        }`,
    );

    console.log(
        `Created:   ${counters.created}`,
    );

    console.log(
        `Existing:  ${counters.existing}`,
    );

    console.log(
        `Pending:   ${counters.pending}`,
    );

    console.log(
        `Errors:    ${counters.errors}`,
    );

    console.log(
        `Mapping:   ${mappingSaved
            ? "SAVED"
            : DRY_RUN
                ? "DRY_RUN"
                : "NOT_SAVED"
        }`,
    );

    console.log(
        "========================================\n",
    );
}

main()
    .catch((error) => {
        console.error(
            "\nERRO FATAL:",
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(
        async () => {
            await prisma.$disconnect();
        },
    );