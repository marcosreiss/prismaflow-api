// migrations/oticacrista/client/client.report.ts

import fs from "node:fs";
import path from "node:path";

import { createMappingWriter } from "@migrations/oticacrista/shared/mapping";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";

const MAPPING_HEADER = "old_id,new_id,status,old_name,new_name,matched_by";

export interface ClientMappingRow {
    oldId: string;
    newId: number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
    matchedBy: string;
}

interface SaveClientErrorOptions {
    oldId: string;
    name: string;
    orphanType?: string;
    error: unknown;
}

interface SaveClientPendingOptions {
    oldId: string;
    name: string;
    reason: string;
    cpf?: string | null;
    ambiguousBy?: string[];
}

interface ClientReportOptions {
    entityReportsDir: string;
    mappingsDir: string;
}

export function createClientReport(options: ClientReportOptions) {
    const errorsDir = path.join(options.entityReportsDir, "errors");
    const executionsDir = path.join(options.entityReportsDir, "executions");

    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });

    const clientMapping = createMappingWriter(options.mappingsDir, "client");

    const pendingRecords: SaveClientPendingOptions[] = [];
    const errorRecords: unknown[] = [];

    function startMapping(): void {
        clientMapping.create(MAPPING_HEADER);
    }

    function appendMapping(row: ClientMappingRow): void {
        clientMapping.append([
            row.oldId,
            row.newId,
            row.status,
            row.oldName,
            row.newName,
            row.matchedBy,
        ]);
    }

    function finalizeMapping(): void {
        clientMapping.finalize();
    }

    function discardMapping(): void {
        clientMapping.discard();
    }

    function addPending(record: SaveClientPendingOptions): void {
        pendingRecords.push(record);
    }

    function addError({
        oldId,
        name,
        orphanType,
        error,
    }: SaveClientErrorOptions): void {
        errorRecords.push({
            oldId,
            name,
            orphanType,
            occurredAt: new Date().toISOString(),
            error: serializeError(error),
        });
    }

    /**
     * Grava pendências e erros acumulados durante a execução em um
     * único arquivo (evita gerar um JSON por registro, já que ambos
     * são relatórios de "análise manual necessária").
     */
    function savePendingAndErrors(): void {
        if (pendingRecords.length === 0 && errorRecords.length === 0) {
            return;
        }

        const timestamp = formatTimestamp(new Date());

        fs.writeFileSync(
            path.join(errorsDir, `client-errors-${timestamp}.json`),
            JSON.stringify(
                { pending: pendingRecords, errors: errorRecords },
                null,
                2,
            ),
            "utf-8",
        );
    }

    function saveExecution(report: MigrationExecutionReport): void {
        const timestamp = formatTimestamp(new Date(report.finishedAt));

        fs.writeFileSync(
            path.join(executionsDir, `client-execution-${timestamp}.json`),
            JSON.stringify(report, null, 2),
            "utf-8",
        );
    }

    return {
        startMapping,
        appendMapping,
        finalizeMapping,
        discardMapping,
        addPending,
        addError,
        savePendingAndErrors,
        saveExecution,
    };
}