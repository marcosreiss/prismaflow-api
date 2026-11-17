import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { createMigrationLogger } from "@migrations/oticacrista/shared/logger";
import { formatTimestamp } from "@migrations/oticacrista/shared/utils";
import { convertClient } from "./client.converter";
import { buildClientIndexes } from "./client.index";
import { findClientMatch } from "./client.matcher";
import { loadClients } from "./client.loader";
import { createClient, loadProductionClients } from "./client.persistence";
import { createClientReport } from "./client.report";

async function main(): Promise<void> {
    const startedAt = new Date();
    const logger = createMigrationLogger({
        entity: "client",
        entityReportsDir: "./migrations/oticacrista/modules/client/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });
    const report = createClientReport();

    let created = 0;
    let existing = 0;
    let errors = 0;
    let pending = 0;

    try {
        logger.info("MIGRAÇÃO: CLIENT");
        logger.info(`Tenant: ${migrationConfig.tenantId}`);
        logger.info(`Branch: ${migrationConfig.branchId}`);
        logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);

        const sources = loadClients();
        const productionClients = await loadProductionClients();
        const indexes = buildClientIndexes(productionClients);
        logger.info(`Registros no CSV: ${sources.length}`);
        logger.info(`Clientes no tenant: ${productionClients.length}`);

        if (!migrationConfig.dryRun) report.startMapping();

        for (let index = 0; index < sources.length; index++) {
            const source = sources[index];
            const label = `[${index + 1}/${sources.length}] ID legado ${source.id} | ${source.pesNome}`;
            try {
                const match = findClientMatch(source, indexes);
                if (match.ambiguous) {
                    pending++;
                    report.saveIssue(source, match.reason ?? "Correspondência ambígua.", "AMBIGUOUS");
                    logger.warning(`${label} | AMBÍGUO: ${match.reason}`);
                    continue;
                }

                if (match.client) {
                    existing++;
                    if (!migrationConfig.dryRun) {
                        report.appendMapping({
                            oldId: source.id,
                            newId: match.client.id,
                            status: "EXISTING",
                            oldName: source.pesNome,
                            newName: match.client.name,
                        });
                    }
                    logger.info(`${label} | EXISTENTE ${match.client.id} via ${match.matchedBy}`);
                    continue;
                }

                const data = convertClient(source);
                if (migrationConfig.dryRun) {
                    created++;
                    logger.info(`${label} | CRIARIA`);
                    continue;
                }

                const client = await createClient(data, indexes);
                created++;
                report.appendMapping({
                    oldId: source.id,
                    newId: client.id,
                    status: "CREATED",
                    oldName: source.pesNome,
                    newName: client.name,
                });
                logger.info(`${label} | CRIADO ${client.id}`);
            } catch (error) {
                errors++;
                report.saveIssue(source, error instanceof Error ? error.message : String(error), "ERROR", error);
                logger.error(`${label} | ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        const finishedAt = new Date();
        if (migrationConfig.dryRun) {
            logger.info("DRY RUN finalizado. Nenhum mapping foi alterado.");
        } else if (errors === 0 && pending === 0) {
            report.finalizeMapping();
            logger.success("Mapping de clientes atualizado.");
        } else {
            report.discardMapping();
            logger.warning("Mapping não finalizado: há registros pendentes ou erros.");
        }

        report.saveExecution({
            entity: "Client",
            tenantId: migrationConfig.tenantId,
            dryRun: migrationConfig.dryRun,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            total: sources.length,
            created,
            existing,
            errors,
            pending,
        });

        logger.info(`Resumo: total=${sources.length}, criados=${created}, existentes=${existing}, pendentes=${pending}, erros=${errors}`);
    } catch (error) {
        if (!migrationConfig.dryRun) report.discardMapping();
        throw error;
    }
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração de clientes:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
