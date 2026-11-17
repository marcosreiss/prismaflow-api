import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { loadMapping } from "@migrations/oticacrista/shared/mapping";
import { createMigrationLogger } from "@migrations/oticacrista/shared/logger";
import { formatTimestamp } from "@migrations/oticacrista/shared/utils";
import { EXCLUDED_LEGACY_SALE_IDS, parseLegacyId } from "./payment.converter";
import { loadPayments } from "./payment.loader";
import { preparePaymentMigration, type PaymentPreflight } from "./payment.preflight";
import { findPaymentSaleSnapshots, persistPaymentsAtomically } from "./payment.persistence";
import { createPaymentReport, type PaymentExecutionReport } from "./payment.report";

const MAPPINGS_DIR = "migrations/oticacrista/mappings";

async function main(): Promise<void> {
    const startedAt = new Date();
    const runId = `${formatTimestamp(startedAt)}-${process.pid}`;
    const logger = createMigrationLogger({
        entity: "payment",
        entityReportsDir: "./migrations/oticacrista/modules/payment/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });
    const report = createPaymentReport();

    let preflight: PaymentPreflight | null = null;
    let createdPayments = 0;
    let createdMethods = 0;
    let createdInstallments = 0;
    let persistenceErrors = 0;
    let validationErrors = 0;
    let structuralErrors = 0;
    let blockReason: string | null = null;
    let transactionResult: PaymentExecutionReport["transactionResult"] = "NOT_STARTED";

    const saveExecution = () => {
        const finishedAt = new Date();
        const errors = validationErrors + persistenceErrors + structuralErrors;
        report.saveExecution({
            entity: "Payment",
            tenantId: migrationConfig.tenantId,
            dryRun: migrationConfig.dryRun,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            total: preflight?.salesAnalyzed ?? 0,
            created: createdPayments,
            existing: 0,
            errors,
            runId,
            paymentsPlanned: preflight?.plans.length ?? 0,
            methodsCreated: createdMethods,
            installmentsCreated: createdInstallments,
            methodsByType: preflight?.methodsByType ?? {},
            entriesIdentified: preflight?.entriesIdentified ?? 0,
            installmentsAnalyzed: preflight?.installmentsAnalyzed ?? 0,
            installmentsConfirmed: preflight?.installmentsConfirmed ?? 0,
            installmentsPending: preflight?.installmentsPending ?? 0,
            totalAmount: preflight?.totalAmount ?? 0,
            paidAmount: preflight?.paidAmount ?? 0,
            openAmount: preflight?.openAmount ?? 0,
            pendingPayments: preflight?.plans.filter((plan) => plan.status === "PENDING").length ?? 0,
            validationErrors,
            persistenceErrors,
            excludedOutOfScope: preflight?.excluded ?? 0,
            roundingWarnings: preflight?.roundingWarnings.length ?? 0,
            transactionResult,
            migrationReady: preflight !== null && preflight.issues.length === 0 && structuralErrors === 0 && blockReason === null,
            blockReason,
        });
    };

    try {
        logger.info("MIGRAÇÃO: PAYMENT + PAYMENT METHOD ITEM + PAYMENT INSTALLMENT");
        logger.info(`Run ID: ${runId}`);
        logger.info(`Tenant: ${migrationConfig.tenantId}`);
        logger.info(`Branch: ${migrationConfig.branchId}`);
        logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);

        const loaded = loadPayments();
        const saleMapping = loadMapping(MAPPINGS_DIR, "sale");
        const mappedSaleIds = [...new Set(loaded.sales.flatMap((sale) => {
            if (EXCLUDED_LEGACY_SALE_IDS.has(sale.ateId.trim())) return [];
            const legacyId = parseLegacyId(sale.ateId);
            const saleId = legacyId === null ? undefined : saleMapping.get(legacyId)?.newId;
            return saleId !== undefined && Number.isSafeInteger(saleId) && saleId > 0 ? [saleId] : [];
        }))];
        const persistedSales = await findPaymentSaleSnapshots(
            prisma as unknown as Pick<PrismaClient, "sale">,
            migrationConfig.tenantId,
            mappedSaleIds,
        );
        preflight = preparePaymentMigration({
            sales: loaded.sales,
            installments: loaded.installments,
            saleMapping,
            persistedSales,
            branchId: migrationConfig.branchId,
        });

        validationErrors = preflight.issues.length;
        for (const issue of preflight.issues) report.saveIssue(issue, "PREFLIGHT");
        blockReason = validationErrors ? `${validationErrors} inconsistência(s) encontrada(s) no preflight.` : null;
        report.savePreflight(preflight, runId, blockReason);

        logger.info(`Atendimentos analisados: ${preflight.salesAnalyzed}`);
        logger.info(`Pagamentos previstos: ${preflight.plans.length}`);
        logger.info(`Métodos previstos: ${JSON.stringify(preflight.methodsByType)}`);
        logger.info(`Parcelas analisadas/confirmadas/pendentes: ${preflight.installmentsAnalyzed}/${preflight.installmentsConfirmed}/${preflight.installmentsPending}`);
        logger.info(`Valores total/pago/em aberto: ${preflight.totalAmount}/${preflight.paidAmount}/${preflight.openAmount}`);
        logger.info(`Excluídos do escopo: ${preflight.excluded}`);
        logger.info(`Avisos de arredondamento documentados: ${preflight.roundingWarnings.length}`);

        if (preflight.issues.length > 0) {
            logger.error(`[MIGRAÇÃO BLOQUEADA ANTES DA PERSISTÊNCIA] ${blockReason}`);
            saveExecution();
            process.exitCode = 1;
            return;
        }

        if (migrationConfig.dryRun) {
            transactionResult = "DRY_RUN_VALIDATED";
            logger.success(`DRY RUN aprovado: seriam criados ${preflight.plans.length} pagamentos, ${Object.values(preflight.methodsByType).reduce((sum, value) => sum + value, 0)} métodos e ${preflight.installmentsAnalyzed} parcelas. Nenhuma escrita foi feita.`);
            saveExecution();
            return;
        }

        try {
            const persisted = await persistPaymentsAtomically(
                prisma as unknown as Pick<PrismaClient, "$transaction">,
                preflight.plans,
                { tenantId: migrationConfig.tenantId, branchId: migrationConfig.branchId },
            );
            transactionResult = "COMMITTED";
            createdPayments = persisted.createdPayments;
            createdMethods = persisted.createdMethods;
            createdInstallments = persisted.createdInstallments;
            logger.success(`Transação confirmada: ${createdPayments} pagamentos, ${createdMethods} métodos e ${createdInstallments} parcelas.`);
        } catch (error) {
            transactionResult = "ROLLED_BACK";
            persistenceErrors++;
            blockReason = error instanceof Error ? error.message : String(error);
            report.saveIssue({ kind: "GLOBAL_TRANSACTION_ROLLBACK", legacyId: "all", reasons: [blockReason] }, "PERSISTENCE", error);
            logger.error(`[ROLLBACK GLOBAL] ${blockReason}`);
        }
        saveExecution();
    } catch (error) {
        structuralErrors++;
        blockReason = error instanceof Error ? error.message : String(error);
        report.saveFatal(runId, error);
        logger.error(`[FALHA ESTRUTURAL] ${blockReason}`);
        saveExecution();
    } finally {
        await prisma.$disconnect();
    }

    if (validationErrors || persistenceErrors || structuralErrors) process.exitCode = 1;
}

void main();
