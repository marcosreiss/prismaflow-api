import fs from "node:fs";
import path from "node:path";
import { createMappingWriter } from "@migrations/oticacrista/shared/mapping";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { OldSale, OldSaleItem } from "./sale.loader";

const ENTITY = "sale";
const ENTITY_NAME = "Sale";
const REPORTS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/modules/sale/reports");
const MAPPINGS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/mappings");
const ERRORS_DIR_NAME = "errors";
const EXECUTIONS_DIR_NAME = "executions";
const ERROR_FILE_PREFIX = `${ENTITY}-error`;
const ITEM_ERROR_FILE_PREFIX = `${ENTITY}-item-error`;
const EXECUTION_FILE_PREFIX = `${ENTITY}-execution`;
const MAPPING_HEADER = "old_id,new_id,status,old_name,new_name";

export interface SaleExecutionReport extends MigrationExecutionReport {
    itemsAnalyzed: number;
    itemsCreated: number;
    itemsWithoutSale: number;
    clientsWithoutMapping: number;
    productsWithoutMapping: number;
    financialInconsistencies: number;
    mappingFile: string;
    mappingFinalized: boolean;
}

export function createSaleReport() {
    const errorsDir = path.join(REPORTS_DIR, ERRORS_DIR_NAME);
    const executionsDir = path.join(REPORTS_DIR, EXECUTIONS_DIR_NAME);
    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });
    const mappingWriter = createMappingWriter(MAPPINGS_DIR, ENTITY);
    let issueSequence = 0;

    function writeIssue(prefix: string, legacyId: string, payload: unknown): void {
        issueSequence++;
        const timestamp = `${formatTimestamp(new Date())}-${issueSequence}`;
        const safeId = legacyId.replace(/[^a-zA-Z0-9_-]/g, "_");
        fs.writeFileSync(
            path.join(errorsDir, `${prefix}-${safeId}-${timestamp}.json`),
            JSON.stringify(payload, null, 2),
            "utf8",
        );
    }

    return {
        mappingPath: mappingWriter.getPath(),
        startMapping() {
            mappingWriter.create(MAPPING_HEADER);
        },
        appendMapping(row: { oldId: number; newId: number; oldName: string; newName: string }) {
            mappingWriter.append([row.oldId, row.newId, "CREATED", row.oldName, row.newName]);
        },
        finalizeMapping() {
            mappingWriter.finalize();
        },
        discardMapping() {
            mappingWriter.discard();
        },
        saveSaleIssue(sale: OldSale, items: OldSaleItem[], reasons: string[], kind: "PENDING" | "ERROR", error?: unknown) {
            writeIssue(ERROR_FILE_PREFIX, sale.ateId, {
                entity: ENTITY_NAME,
                oldId: sale.ateId,
                kind,
                reasons,
                occurredAt: new Date().toISOString(),
                sourceSale: sale,
                relatedItems: items,
                ...(error === undefined ? {} : { error: serializeError(error) }),
            });
        },
        saveOrphanItem(item: OldSaleItem, reason: string) {
            writeIssue(ITEM_ERROR_FILE_PREFIX, item.itemAtendimento, {
                entity: "ItemProduct",
                oldSaleId: item.itemAtendimento,
                kind: "MISSING_SALE",
                reason,
                occurredAt: new Date().toISOString(),
                sourceItem: item,
            });
        },
        saveExecution(execution: SaleExecutionReport) {
            const timestamp = `${formatTimestamp(new Date(execution.finishedAt))}-${Date.now()}`;
            fs.writeFileSync(
                path.join(executionsDir, `${EXECUTION_FILE_PREFIX}-${timestamp}.json`),
                JSON.stringify(execution, null, 2),
                "utf8",
            );
        },
    };
}
