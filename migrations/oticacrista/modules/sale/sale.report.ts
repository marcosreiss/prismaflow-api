import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createMappingWriter, loadMappingFile } from "@migrations/oticacrista/shared/mapping";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { PreflightIssue, SalePreflight } from "./sale.preflight";
import type { SaleMappingEntry } from "./sale.persistence";

const ENTITY = "sale";
const ENTITY_NAME = "Sale";
const DEFAULT_REPORTS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/modules/sale/reports");
const DEFAULT_MAPPINGS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/mappings");
const ERRORS_DIR_NAME = "errors";
const EXECUTIONS_DIR_NAME = "executions";
const ERROR_FILE_PREFIX = `${ENTITY}-error`;
const PREFLIGHT_FILE_PREFIX = `${ENTITY}-preflight`;
const EXECUTION_FILE_PREFIX = `${ENTITY}-execution`;
const CRITICAL_FILE_PREFIX = `${ENTITY}-mapping-critical`;
const MAPPING_HEADER = "old_id,new_id,status,old_name,new_name";
const RECOVERY_MANIFEST_NAME = `${ENTITY}-mapping-recovery.json`;

export interface RecoveryManifest {
    entity: "Sale";
    runId: string;
    state: "IN_PROGRESS" | "COMMITTED_PENDING_FINALIZE";
    startedAt: string;
    expectedRows: number;
    committedAt?: string;
    rowCount?: number;
    sha256?: string;
    temporaryPath: string;
    finalPath: string;
}

export interface SaleExecutionReport extends MigrationExecutionReport {
    migrationReady: boolean;
    wouldCreateSales: number;
    wouldCreateItems: number;
    salesEligible: number;
    salesPending: number;
    validationErrors: number;
    persistenceErrors: number;
    mappingErrors: number;
    itemsAnalyzed: number;
    itemsEligible: number;
    itemsCreated: number;
    itemsWithoutSale: number;
    clientsWithoutMapping: number;
    productsWithoutMapping: number;
    financialInconsistencies: number;
    oversizedTexts: number;
    transactionResult: "NOT_STARTED" | "DRY_RUN_VALIDATED" | "COMMITTED" | "ROLLED_BACK";
    mappingStatus: "NOT_CREATED" | "DISCARDED" | "FINALIZED" | "RECOVERY_REQUIRED" | "NOT_APPLICABLE";
    mappingFile: string;
    mappingFinalized: boolean;
    blockReason: string | null;
}

export function createSaleReport(options: { reportsDir?: string; mappingsDir?: string } = {}) {
    const reportsDir = options.reportsDir ?? DEFAULT_REPORTS_DIR;
    const mappingsDir = options.mappingsDir ?? DEFAULT_MAPPINGS_DIR;
    const errorsDir = path.join(reportsDir, ERRORS_DIR_NAME);
    const executionsDir = path.join(reportsDir, EXECUTIONS_DIR_NAME);
    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });

    const mappingWriter = createMappingWriter(mappingsDir, ENTITY);
    const mappingPath = mappingWriter.getPath();
    const temporaryPath = `${mappingPath}.tmp`;
    const recoveryManifestPath = path.join(errorsDir, RECOVERY_MANIFEST_NAME);
    const recoveryManifestTempPath = `${recoveryManifestPath}.tmp`;
    let issueSequence = 0;
    let mappingRowCount = 0;
    let expectedMappingRows = 0;

    function writeJsonAtomic(filePath: string, value: unknown): void {
        const tempPath = `${filePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
    }

    function writeIssue(legacyId: string, payload: unknown): string {
        issueSequence++;
        const timestamp = `${formatTimestamp(new Date())}-${issueSequence}`;
        const safeId = legacyId.replace(/[^a-zA-Z0-9_-]/g, "_") || "unknown";
        const filePath = path.join(errorsDir, `${ERROR_FILE_PREFIX}-${safeId}-${timestamp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
        return filePath;
    }

    function readRecoveryManifest(): RecoveryManifest | null {
        if (!fs.existsSync(recoveryManifestPath)) return null;
        return JSON.parse(fs.readFileSync(recoveryManifestPath, "utf8")) as RecoveryManifest;
    }

    function sha256(filePath: string): string {
        return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    }

    function publishCommittedMapping(expectedHash: string): void {
        if (fs.existsSync(temporaryPath)) {
            try {
                mappingWriter.finalize();
            } catch {
                // A committed transaction is recoverable from the intact temp file.
                // Keep the temp until the replacement is verified so another retry is safe.
                fs.copyFileSync(temporaryPath, mappingPath);
            }
        }
        if (!fs.existsSync(mappingPath) || sha256(mappingPath) !== expectedHash) {
            throw new Error("Mapping final não corresponde aos dados confirmados no banco.");
        }
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }

    return {
        mappingPath,
        temporaryPath,
        recoveryManifestPath,
        saveIssue(issue: PreflightIssue, kind: "PREFLIGHT" | "PERSISTENCE", error?: unknown) {
            writeIssue(issue.legacyId, {
                entity: issue.kind === "ORPHAN_ITEM" ? "ItemProduct" : ENTITY_NAME,
                kind,
                sourceKind: issue.kind,
                oldId: issue.legacyId,
                reasons: issue.reasons,
                occurredAt: new Date().toISOString(),
                ...(issue.sourceSale ? { sourceSale: issue.sourceSale } : {}),
                ...(issue.relatedItems ? { relatedItems: issue.relatedItems } : {}),
                ...(issue.sourceItem ? { sourceItem: issue.sourceItem } : {}),
                ...(error === undefined ? {} : { error: serializeError(error) }),
            });
        },
        savePreflight(preflight: SalePreflight, runId: string, blockReason: string | null) {
            const timestamp = formatTimestamp(new Date());
            fs.writeFileSync(path.join(errorsDir, `${PREFLIGHT_FILE_PREFIX}-${timestamp}.json`), JSON.stringify({
                entity: ENTITY_NAME,
                runId,
                status: preflight.issues.length ? "BLOCKED" : "READY",
                blockReason,
                generatedAt: new Date().toISOString(),
                counts: {
                    salesAnalyzed: preflight.salesAnalyzed,
                    salesEligible: preflight.salesEligible,
                    salesPending: preflight.salesPending,
                    itemsAnalyzed: preflight.itemsAnalyzed,
                    itemsEligible: preflight.itemsEligible,
                    itemsWithoutSale: preflight.itemsWithoutSale,
                    clientsWithoutMapping: preflight.clientsWithoutMapping,
                    productsWithoutMapping: preflight.productsWithoutMapping,
                    financialInconsistencies: preflight.financialInconsistencies,
                    oversizedTexts: preflight.oversizedTexts,
                },
                issues: preflight.issues,
            }, null, 2), "utf8");
        },
        saveFatalPreflight(runId: string, error: unknown) {
            const timestamp = formatTimestamp(new Date());
            const payload = {
                entity: ENTITY_NAME,
                runId,
                status: "BLOCKED",
                blockReason: error instanceof Error ? error.message : String(error),
                generatedAt: new Date().toISOString(),
                counts: { salesAnalyzed: 0, salesEligible: 0, salesPending: 0, itemsAnalyzed: 0, itemsEligible: 0, itemsWithoutSale: 0 },
                issues: [{ kind: "STRUCTURAL", error: serializeError(error) }],
            };
            fs.writeFileSync(path.join(errorsDir, `${PREFLIGHT_FILE_PREFIX}-${timestamp}.json`), JSON.stringify(payload, null, 2), "utf8");
            writeIssue("structure", {
                entity: ENTITY_NAME,
                kind: "STRUCTURAL",
                runId,
                occurredAt: new Date().toISOString(),
                error: serializeError(error),
            });
        },
        saveTransactionFailure(runId: string, plans: Array<{ legacyId: number; sourceSaleId: string; relatedItemCount: number }>, error: unknown) {
            const filePath = writeIssue(runId, {
                entity: ENTITY_NAME,
                kind: "GLOBAL_TRANSACTION_ROLLBACK",
                occurredAt: new Date().toISOString(),
                attemptedSales: plans.length,
                affectedRecords: plans,
                error: serializeError(error),
            });
            return filePath;
        },
        async recoverPendingMapping(
            reconcileSaleIds?: (saleIds: number[]) => Promise<Set<number>>,
        ): Promise<{ status: "NONE" | "RECOVERED" | "BLOCKED"; reason?: string }> {
            const manifest = readRecoveryManifest();
            const hasTemp = fs.existsSync(temporaryPath);
            if (!manifest && !hasTemp && fs.existsSync(mappingPath)) {
                return {
                    status: "BLOCKED",
                    reason: `Mapping definitivo já existe em ${mappingPath}; o módulo não possui reconciliação de vendas previamente migradas e bloqueou nova criação para evitar duplicatas.`,
                };
            }
            if (!manifest && !hasTemp && !fs.existsSync(recoveryManifestTempPath)) return { status: "NONE" };

            if (!manifest) {
                return { status: "BLOCKED", reason: `Mapping temporário sem manifesto recuperável: ${temporaryPath}` };
            }
            if (manifest.state === "IN_PROGRESS") {
                if (!reconcileSaleIds || !Number.isInteger(manifest.expectedRows)) {
                    return { status: "BLOCKED", reason: `Execução anterior ${manifest.runId} ficou em estado IN_PROGRESS; reconciliação dos IDs no banco é necessária.` };
                }
                try {
                    const rows = loadMappingFile(temporaryPath, ENTITY);
                    const ids = [...rows.values()].map((row) => row.newId);
                    const existingIds = await reconcileSaleIds(ids);
                    if (existingIds.size === 0) {
                        mappingWriter.discard();
                        fs.unlinkSync(recoveryManifestPath);
                        if (fs.existsSync(recoveryManifestTempPath)) fs.unlinkSync(recoveryManifestTempPath);
                        return { status: "NONE", reason: `Execução anterior ${manifest.runId} não deixou vendas confirmadas; temporário removido.` };
                    }
                    if (rows.size !== manifest.expectedRows || existingIds.size !== manifest.expectedRows || ids.some((id) => !existingIds.has(id))) {
                        return { status: "BLOCKED", reason: `Execução ${manifest.runId} tem estado parcial ou inconsistente: mapping=${rows.size}/${manifest.expectedRows}, vendas encontradas=${existingIds.size}.` };
                    }
                    const committedManifest: RecoveryManifest = {
                        ...manifest,
                        state: "COMMITTED_PENDING_FINALIZE",
                        committedAt: new Date().toISOString(),
                        rowCount: rows.size,
                        sha256: sha256(temporaryPath),
                    };
                    writeJsonAtomic(recoveryManifestPath, committedManifest);
                } catch (error) {
                    return { status: "BLOCKED", reason: `Não foi possível reconciliar execução ${manifest.runId}: ${error instanceof Error ? error.message : String(error)}` };
                }
            }

            const confirmedManifest = readRecoveryManifest();
            if (confirmedManifest?.state !== "COMMITTED_PENDING_FINALIZE" || !confirmedManifest.sha256) {
                return { status: "BLOCKED", reason: `Execução anterior ${manifest.runId} ficou em estado ${manifest.state}; reconcilie o banco antes de executar novamente.` };
            }

            try {
                if (hasTemp) {
                    if (sha256(temporaryPath) !== confirmedManifest.sha256) {
                        return { status: "BLOCKED", reason: "Hash do mapping temporário diverge do manifesto de commit." };
                    }
                    publishCommittedMapping(confirmedManifest.sha256);
                }
                if (!fs.existsSync(mappingPath) || sha256(mappingPath) !== confirmedManifest.sha256) {
                    return { status: "BLOCKED", reason: "Mapping final não corresponde aos dados confirmados no banco." };
                }
                fs.unlinkSync(recoveryManifestPath);
                return { status: "RECOVERED", reason: `Mapping confirmado da execução ${manifest.runId} foi finalizado. Execute uma nova revisão do preflight antes de qualquer outra migração.` };
            } catch (error) {
                return { status: "BLOCKED", reason: `Falha ao recuperar mapping confirmado: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        startMapping(runId: string, expectedRows: number) {
            if (fs.existsSync(mappingPath) || fs.existsSync(temporaryPath) || fs.existsSync(recoveryManifestPath) || fs.existsSync(recoveryManifestTempPath)) {
                throw new Error("Há artefatos de mapping de uma execução anterior; reconciliação obrigatória antes de iniciar.");
            }
            mappingWriter.create(MAPPING_HEADER);
            mappingRowCount = 0;
            expectedMappingRows = expectedRows;
            try {
                writeJsonAtomic(recoveryManifestPath, {
                    entity: ENTITY_NAME,
                    runId,
                    state: "IN_PROGRESS",
                    startedAt: new Date().toISOString(),
                    expectedRows,
                    temporaryPath,
                    finalPath: mappingPath,
                } satisfies RecoveryManifest);
            } catch (error) {
                mappingWriter.discard();
                if (fs.existsSync(recoveryManifestTempPath)) fs.unlinkSync(recoveryManifestTempPath);
                throw error;
            }
        },
        appendMapping(row: SaleMappingEntry) {
            mappingWriter.append([row.oldId, row.newId, "CREATED", row.oldName, row.newName]);
            mappingRowCount++;
        },
        markCommitted() {
            if (mappingRowCount !== expectedMappingRows) {
                throw new Error(`Mapping incompleto: ${mappingRowCount} de ${expectedMappingRows} vendas.`);
            }
            if (!fs.existsSync(temporaryPath)) throw new Error("Mapping temporário não existe após o commit.");
            const previous = readRecoveryManifest();
            if (!previous) throw new Error("Manifesto de recuperação desapareceu antes do commit.");
            writeJsonAtomic(recoveryManifestPath, {
                ...previous,
                state: "COMMITTED_PENDING_FINALIZE",
                committedAt: new Date().toISOString(),
                rowCount: mappingRowCount,
                sha256: sha256(temporaryPath),
            } satisfies RecoveryManifest);
        },
        finalizeMapping() {
            const manifest = readRecoveryManifest();
            if (!manifest?.sha256) throw new Error("Manifesto de commit não contém hash para validação do mapping.");
            publishCommittedMapping(manifest.sha256);
            if (fs.existsSync(recoveryManifestPath)) fs.unlinkSync(recoveryManifestPath);
        },
        discardAfterRollback() {
            mappingWriter.discard();
            if (fs.existsSync(recoveryManifestPath)) fs.unlinkSync(recoveryManifestPath);
            if (fs.existsSync(recoveryManifestTempPath)) fs.unlinkSync(recoveryManifestTempPath);
        },
        saveCriticalMappingFailure(runId: string, error: unknown, manifest?: RecoveryManifest | null) {
            const timestamp = `${formatTimestamp(new Date())}-${Date.now()}`;
            const filePath = path.join(errorsDir, `${CRITICAL_FILE_PREFIX}-${timestamp}.json`);
            fs.writeFileSync(filePath, JSON.stringify({
                entity: ENTITY_NAME,
                runId,
                severity: "CRITICAL",
                occurredAt: new Date().toISOString(),
                reason: "O banco confirmou a transação, mas o mapping não foi finalizado. Não execute novamente a migração antes de recuperar o mapping.",
                mappingPath,
                temporaryPath,
                recoveryManifestPath,
                manifest: manifest ?? readRecoveryManifest(),
                error: serializeError(error),
            }, null, 2), "utf8");
            return filePath;
        },
        saveExecution(execution: SaleExecutionReport) {
            const timestamp = `${formatTimestamp(new Date(execution.finishedAt))}-${Date.now()}`;
            fs.writeFileSync(path.join(executionsDir, `${EXECUTION_FILE_PREFIX}-${timestamp}.json`), JSON.stringify(execution, null, 2), "utf8");
        },
    };
}
