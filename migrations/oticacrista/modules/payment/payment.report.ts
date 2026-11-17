import fs from "node:fs";
import path from "node:path";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";
import type { PaymentPreflight } from "./payment.preflight";

const DEFAULT_REPORTS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/modules/payment/reports");

export interface PaymentExecutionReport extends MigrationExecutionReport {
    runId: string;
    paymentsPlanned: number;
    methodsCreated: number;
    installmentsCreated: number;
    methodsByType: Record<string, number>;
    entriesIdentified: number;
    installmentsAnalyzed: number;
    installmentsConfirmed: number;
    installmentsPending: number;
    totalAmount: number;
    paidAmount: number;
    openAmount: number;
    pendingPayments: number;
    validationErrors: number;
    persistenceErrors: number;
    excludedOutOfScope: number;
    roundingWarnings: number;
    transactionResult: "NOT_STARTED" | "DRY_RUN_VALIDATED" | "COMMITTED" | "ROLLED_BACK";
    migrationReady: boolean;
    blockReason: string | null;
}

export function createPaymentReport(reportsDir = DEFAULT_REPORTS_DIR) {
    const errorsDir = path.join(reportsDir, "errors");
    const executionsDir = path.join(reportsDir, "executions");
    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });
    let issueSequence = 0;

    return {
        saveIssue(issue: { kind: string; legacyId: string; reasons: string[]; sourceRecord?: unknown }, phase: "PREFLIGHT" | "PERSISTENCE", error?: unknown) {
            issueSequence++;
            const timestamp = `${formatTimestamp(new Date())}-${issueSequence}`;
            const safeId = issue.legacyId.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
            const filePath = path.join(errorsDir, `payment-error-${safeId}-${timestamp}.json`);
            fs.writeFileSync(filePath, JSON.stringify({
                entity: "Payment",
                phase,
                kind: issue.kind,
                legacyId: issue.legacyId,
                reasons: issue.reasons,
                occurredAt: new Date().toISOString(),
                ...(issue.sourceRecord === undefined ? {} : { sourceRecord: issue.sourceRecord }),
                ...(error === undefined ? {} : { error: serializeError(error) }),
            }, null, 2), "utf8");
            return filePath;
        },
        savePreflight(preflight: PaymentPreflight, runId: string, blockReason: string | null) {
            const timestamp = formatTimestamp(new Date());
            fs.writeFileSync(path.join(errorsDir, `payment-preflight-${timestamp}.json`), JSON.stringify({
                entity: "Payment",
                runId,
                status: preflight.issues.length ? "BLOCKED" : "READY",
                blockReason,
                generatedAt: new Date().toISOString(),
                counts: {
                    salesAnalyzed: preflight.salesAnalyzed,
                    paymentsPlanned: preflight.plans.length,
                    paymentErrors: preflight.issues.length,
                    methodsByType: preflight.methodsByType,
                    entriesIdentified: preflight.entriesIdentified,
                    installmentsAnalyzed: preflight.installmentsAnalyzed,
                    installmentsConfirmed: preflight.installmentsConfirmed,
                    installmentsPending: preflight.installmentsPending,
                    pendingPayments: preflight.plans.filter((plan) => plan.status === "PENDING").length,
                    totalAmount: preflight.totalAmount,
                    paidAmount: preflight.paidAmount,
                    openAmount: preflight.openAmount,
                    excludedOutOfScope: preflight.excluded,
                    roundingWarnings: preflight.roundingWarnings.length,
                },
                roundingWarnings: preflight.roundingWarnings,
                issues: preflight.issues,
            }, null, 2), "utf8");
        },
        saveFatal(runId: string, error: unknown) {
            const timestamp = formatTimestamp(new Date());
            fs.writeFileSync(path.join(errorsDir, `payment-preflight-fatal-${timestamp}.json`), JSON.stringify({
                entity: "Payment",
                runId,
                status: "BLOCKED",
                occurredAt: new Date().toISOString(),
                error: serializeError(error),
            }, null, 2), "utf8");
        },
        saveExecution(execution: PaymentExecutionReport) {
            const timestamp = `${formatTimestamp(new Date(execution.finishedAt))}-${Date.now()}`;
            fs.writeFileSync(path.join(executionsDir, `payment-execution-${timestamp}.json`), JSON.stringify(execution, null, 2), "utf8");
        },
    };
}
