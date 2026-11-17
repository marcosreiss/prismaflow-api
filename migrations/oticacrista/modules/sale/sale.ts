import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { loadMapping } from "@migrations/oticacrista/shared/mapping";
import { createMigrationLogger } from "@migrations/oticacrista/shared/logger";
import { formatTimestamp } from "@migrations/oticacrista/shared/utils";
import { parseLegacyId } from "./sale.converter";
import { loadSales } from "./sale.loader";
import { prepareSaleMigration, type SalePreflight } from "./sale.preflight";
import { findPersistedSaleIds, persistSalesAtomically, validateMappingTargets } from "./sale.persistence";
import { createSaleReport, type SaleExecutionReport } from "./sale.report";

const MAPPINGS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/mappings");

async function main(): Promise<void> {
    const startedAt = new Date();
    const runId = `${formatTimestamp(startedAt)}-${process.pid}`;
    const logger = createMigrationLogger({
        entity: "sale",
        entityReportsDir: "./migrations/oticacrista/modules/sale/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });
    const report = createSaleReport();

    let preflight: SalePreflight | null = null;
    let created = 0;
    let itemsCreated = 0;
    let persistenceErrors = 0;
    let mappingErrors = 0;
    let structuralErrors = 0;
    let transactionResult: SaleExecutionReport["transactionResult"] = "NOT_STARTED";
    let mappingStatus: SaleExecutionReport["mappingStatus"] = migrationConfig.dryRun ? "NOT_APPLICABLE" : "NOT_CREATED";
    let mappingFinalized = false;
    let blockReason: string | null = null;

    const saveExecution = () => {
        const finishedAt = new Date();
        const validationErrors = preflight?.issues.length ?? 0;
        const salesEligible = preflight?.salesEligible ?? 0;
        const itemsEligible = preflight?.itemsEligible ?? 0;
        const ready = preflight !== null && preflight.issues.length === 0 && structuralErrors === 0
            && persistenceErrors === 0 && blockReason === null;

        report.saveExecution({
            entity: "Sale",
            tenantId: migrationConfig.tenantId,
            dryRun: migrationConfig.dryRun,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            total: preflight?.salesAnalyzed ?? 0,
            created,
            existing: 0,
            errors: validationErrors + persistenceErrors + mappingErrors + structuralErrors,
            pending: preflight?.salesPending ?? 0,
            migrationReady: ready,
            wouldCreateSales: ready && transactionResult === "DRY_RUN_VALIDATED" ? salesEligible : 0,
            wouldCreateItems: ready && transactionResult === "DRY_RUN_VALIDATED" ? itemsEligible : 0,
            salesEligible,
            salesPending: preflight?.salesPending ?? 0,
            validationErrors,
            persistenceErrors,
            mappingErrors,
            itemsAnalyzed: preflight?.itemsAnalyzed ?? 0,
            itemsEligible,
            itemsCreated,
            itemsWithoutSale: preflight?.itemsWithoutSale ?? 0,
            clientsWithoutMapping: preflight?.clientsWithoutMapping ?? 0,
            productsWithoutMapping: preflight?.productsWithoutMapping ?? 0,
            financialInconsistencies: preflight?.financialInconsistencies ?? 0,
            oversizedTexts: preflight?.oversizedTexts ?? 0,
            transactionResult,
            mappingStatus,
            mappingFile: report.mappingPath,
            mappingFinalized,
            blockReason,
        });
    };

    try {
        logger.info("MIGRAÇÃO: SALE + ITEM PRODUCT");
        logger.info(`Run ID: ${runId}`);
        logger.info(`Tenant: ${migrationConfig.tenantId}`);
        logger.info(`Branch: ${migrationConfig.branchId}`);
        logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);

        const recovery = await report.recoverPendingMapping((saleIds) => findPersistedSaleIds(
            prisma as unknown as Pick<PrismaClient, "sale">,
            migrationConfig.tenantId,
            saleIds,
        ));
        if (recovery.status !== "NONE") {
            blockReason = recovery.reason ?? "Mapping de uma execução anterior requer reconciliação.";
            mappingStatus = recovery.status === "RECOVERED" ? "FINALIZED" : "RECOVERY_REQUIRED";
            mappingFinalized = recovery.status === "RECOVERED";
            if (recovery.status === "BLOCKED") structuralErrors++;
            logger.error(`[BLOQUEADA ANTES DO PREFLIGHT] ${blockReason}`);
            if (recovery.status === "RECOVERED") {
                logger.warning("Mapping anterior recuperado. Esta execução foi interrompida para impedir duplicação de vendas.");
            }
            saveExecution();
            return;
        }

        const loaded = loadSales(migrationConfig.inputDir);
        const clients = loadMapping(MAPPINGS_DIR, "client");
        const products = loadMapping(MAPPINGS_DIR, "product");
        const referencedClientIds = [...new Set(loaded.sales.flatMap((sale) => {
            const legacyId = parseLegacyId(sale.ateCliente);
            const targetId = legacyId === null ? undefined : clients.get(legacyId)?.newId;
            return targetId === undefined || !Number.isInteger(targetId) || targetId < 1 || targetId > 2_147_483_647 ? [] : [targetId];
        }))];
        const referencedProductIds = [...new Set(loaded.items.flatMap((item) => {
            const legacyId = parseLegacyId(item.itemProduto);
            const targetId = legacyId === null ? undefined : products.get(legacyId)?.newId;
            return targetId === undefined || !Number.isInteger(targetId) || targetId < 1 || targetId > 2_147_483_647 ? [] : [targetId];
        }))];
        const mappingTargets = await validateMappingTargets(
            prisma as unknown as Pick<PrismaClient, "client" | "product" | "branch">,
            migrationConfig.tenantId,
            migrationConfig.branchId,
            referencedClientIds,
            referencedProductIds,
        );
        preflight = prepareSaleMigration({
            sales: loaded.sales,
            items: loaded.items,
            clients,
            products,
            tenantId: migrationConfig.tenantId,
            branchId: migrationConfig.branchId,
            knownClientIds: mappingTargets.clientIds,
            knownProductIds: mappingTargets.productIds,
            branchExists: mappingTargets.branchExists,
        });

        for (const issue of preflight.issues) report.saveIssue(issue, "PREFLIGHT");
        blockReason = preflight.issues.length
            ? `${preflight.issues.length} inconsistência(s) encontrada(s) no preflight.`
            : null;
        report.savePreflight(preflight, runId, blockReason);

        logger.info(`Atendimentos analisados: ${preflight.salesAnalyzed}`);
        logger.info(`Vendas individualmente aptas: ${preflight.salesEligible}`);
        logger.info(`Vendas pendentes: ${preflight.salesPending}`);
        logger.info(`Itens analisados: ${preflight.itemsAnalyzed}`);
        logger.info(`Itens individualmente aptos: ${preflight.itemsEligible}`);
        logger.info(`Itens sem atendimento: ${preflight.itemsWithoutSale}`);

        if (preflight.issues.length > 0) {
            logger.error(`[MIGRAÇÃO BLOQUEADA ANTES DA PERSISTÊNCIA] ${blockReason}`);
            saveExecution();
            return;
        }

        if (migrationConfig.dryRun) {
            transactionResult = "DRY_RUN_VALIDATED";
            logger.success(`DRY RUN aprovado: seriam criadas ${preflight.salesEligible} vendas e ${preflight.itemsEligible} itens. Nenhuma escrita no banco ou mapping foi feita.`);
            saveExecution();
            return;
        }

        report.startMapping(runId, preflight.plans.length);
        mappingStatus = "DISCARDED";
        try {
            const result = await persistSalesAtomically(
                prisma as unknown as Pick<PrismaClient, "$transaction">,
                preflight.plans,
                { tenantId: migrationConfig.tenantId, branchId: migrationConfig.branchId },
                (entry) => report.appendMapping(entry),
            );
            transactionResult = "COMMITTED";
            created = result.createdSales;
            itemsCreated = result.createdItems;
            logger.info(`Transação confirmada: ${created} vendas e ${itemsCreated} itens.`);
        } catch (error) {
            transactionResult = "ROLLED_BACK";
            persistenceErrors++;
            const reason = error instanceof Error ? error.message : String(error);
            blockReason = `Transação global revertida: ${reason}`;
            logger.error(`[ROLLBACK GLOBAL] ${reason}`);
            try {
                report.saveTransactionFailure(runId, preflight.plans.map((plan) => ({
                    legacyId: plan.legacyId,
                    sourceSaleId: plan.source.ateId,
                    relatedItemCount: plan.items.length,
                })), error);
            } catch (reportError) {
                logger.error(`[FALHA AO GRAVAR RELATÓRIO DO ROLLBACK] ${reportError instanceof Error ? reportError.message : String(reportError)}`);
            }
            try {
                report.discardAfterRollback();
                mappingStatus = "DISCARDED";
            } catch (cleanupError) {
                mappingStatus = "RECOVERY_REQUIRED";
                blockReason += ` Falha ao limpar artefatos temporários: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
                logger.error(`[CRÍTICO] ${blockReason}`);
            }
            saveExecution();
            return;
        }

        try {
            report.markCommitted();
            mappingStatus = "RECOVERY_REQUIRED";
            report.finalizeMapping();
            mappingFinalized = true;
            mappingStatus = "FINALIZED";
            logger.success("Mapping finalizado após o commit da transação.");
        } catch (error) {
            mappingStatus = "RECOVERY_REQUIRED";
            mappingErrors++;
            blockReason = `Banco confirmado; mapping requer recuperação: ${error instanceof Error ? error.message : String(error)}`;
            logger.error(`[FALHA CRÍTICA PÓS-COMMIT] ${blockReason}`);
            try {
                const criticalReport = report.saveCriticalMappingFailure(runId, error);
                logger.error(`Relatório de recuperação: ${criticalReport}`);
            } catch (reportError) {
                logger.error(`[FALHA AO GRAVAR RELATÓRIO CRÍTICO] ${reportError instanceof Error ? reportError.message : String(reportError)}`);
                logger.error(`Preservar ${report.temporaryPath} e ${report.recoveryManifestPath}; não repetir a migração.`);
            }
        }

        saveExecution();
    } catch (error) {
        structuralErrors++;
        blockReason = error instanceof Error ? error.message : String(error);
        logger.error(`[BLOQUEADA ANTES DA PERSISTÊNCIA] ${blockReason}`);
        report.saveFatalPreflight(runId, error);
        saveExecution();
    }
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração de vendas:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
