import fs from "node:fs";
import path from "node:path";
import { createMappingWriter } from "@migrations/oticacrista/shared/mapping";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { ClientSource } from "./client.loader";

const ENTITY = "client";
const ENTITY_NAME = "Client";
const REPORTS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/modules/client/reports");
const ERRORS_DIR_NAME = "errors";
const EXECUTIONS_DIR_NAME = "executions";
const ERROR_FILE_PREFIX = `${ENTITY}-error`;
const EXECUTION_FILE_PREFIX = `${ENTITY}-execution`;
const MAPPINGS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/mappings");
const MAPPING_HEADER = "old_id,new_id,status,old_name,new_name";

export function createClientReport() {
    const errorsDir = path.join(REPORTS_DIR, ERRORS_DIR_NAME);
    const executionsDir = path.join(REPORTS_DIR, EXECUTIONS_DIR_NAME);
    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });
    const mappingWriter = createMappingWriter(MAPPINGS_DIR, ENTITY);

    return {
        startMapping() {
            mappingWriter.create(MAPPING_HEADER);
        },
        appendMapping(row: { oldId: string; newId: number; status: "CREATED" | "EXISTING"; oldName: string; newName: string }) {
            mappingWriter.append([row.oldId, row.newId, row.status, row.oldName, row.newName]);
        },
        finalizeMapping() {
            mappingWriter.finalize();
        },
        discardMapping() {
            mappingWriter.discard();
        },
        saveIssue(source: ClientSource, reason: string, kind: "AMBIGUOUS" | "ERROR", error?: unknown) {
            const timestamp = formatTimestamp(new Date());
            const safeId = source.id.replace(/[^a-zA-Z0-9_-]/g, "_");
            const payload = {
                entity: ENTITY_NAME,
                oldId: source.id,
                oldName: source.pesNome,
                kind,
                reason,
                occurredAt: new Date().toISOString(),
                ...(error === undefined ? {} : { error: serializeError(error) }),
                source,
            };
            fs.writeFileSync(
                path.join(errorsDir, `${ERROR_FILE_PREFIX}-${safeId}-${timestamp}.json`),
                JSON.stringify(payload, null, 2),
                "utf8",
            );
        },
        saveExecution(report: MigrationExecutionReport) {
            const timestamp = formatTimestamp(new Date(report.finishedAt));
            fs.writeFileSync(
                path.join(executionsDir, `${EXECUTION_FILE_PREFIX}-${timestamp}.json`),
                JSON.stringify(report, null, 2),
                "utf8",
            );
        },
    };
}
