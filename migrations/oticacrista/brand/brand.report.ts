import fs from "node:fs";
import path from "node:path";

import type { OldBrand } from "./brand.loader";
import type { MigrationExecutionReport } from "../shared/types";
import {
    formatTimestamp,
    serializeError,
} from "../shared/utils";

/* =========================================================
 * CONFIGURAÇÃO DE ARQUIVOS E DIRETÓRIOS
 * ========================================================= */

const ENTITY = "brand";
const ENTITY_NAME = "Brand";

const ENTITY_ORDER = "01";

const ERRORS_DIR_NAME = "errors";
const EXECUTIONS_DIR_NAME = "executions";

const MAPPINGS_DIR = path.resolve(
    process.cwd(),
    "migrations/oticacrista/mappings"
);

const MAPPING_FILE_NAME =
    `${ENTITY_ORDER}-${ENTITY}-mapping.csv`;

const ERROR_FILE_PREFIX =
    `${ENTITY_ORDER}-${ENTITY}-error`;

const EXECUTION_FILE_PREFIX =
    `${ENTITY_ORDER}-${ENTITY}-execution`;

const MAPPING_TEMP_SUFFIX = ".tmp";

/* =========================================================
 * TIPOS
 * ========================================================= */

export interface BrandMapping {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
}

interface SaveBrandErrorOptions {
    brand: OldBrand;
    error: unknown;
}

interface BrandReportOptions {
    reportsDir: string;
}

/* =========================================================
 * REPORT
 * ========================================================= */

export function createBrandReport(
    options: BrandReportOptions
) {
    const errorsDir = path.join(
        options.reportsDir,
        ERRORS_DIR_NAME
    );

    const executionsDir = path.join(
        options.reportsDir,
        EXECUTIONS_DIR_NAME
    );

    fs.mkdirSync(errorsDir, {
        recursive: true,
    });

    fs.mkdirSync(executionsDir, {
        recursive: true,
    });

    function saveMapping(
        mappings: BrandMapping[]
    ): void {
        fs.mkdirSync(MAPPINGS_DIR, {
            recursive: true,
        });

        const finalPath = path.join(
            MAPPINGS_DIR,
            MAPPING_FILE_NAME
        );

        const tempPath =
            `${finalPath}${MAPPING_TEMP_SUFFIX}`;

        const header =
            "old_id,new_id,status,old_name,new_name\n";

        const rows = mappings.map((mapping) =>
            [
                mapping.oldId,
                mapping.newId ?? "",
                mapping.status,
                csvEscape(mapping.oldName),
                csvEscape(mapping.newName),
            ].join(",")
        );

        fs.writeFileSync(
            tempPath,
            header + rows.join("\n"),
            "utf-8"
        );

        fs.renameSync(
            tempPath,
            finalPath
        );
    }

    function saveError({
        brand,
        error,
    }: SaveBrandErrorOptions): void {
        const timestamp = formatTimestamp(
            new Date()
        );

        const fileName =
            `${ERROR_FILE_PREFIX}-${brand.marcaId}-${timestamp}.json`;

        const filePath = path.join(
            errorsDir,
            fileName
        );

        const errorData = {
            entity: ENTITY_NAME,
            oldId: brand.marcaId,
            oldName: brand.marcaNome,
            occurredAt: new Date().toISOString(),
            error: serializeError(error),
        };

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                errorData,
                null,
                2
            ),
            "utf-8"
        );
    }

    function saveExecution(
        report: MigrationExecutionReport
    ): void {
        const timestamp = formatTimestamp(
            new Date(report.finishedAt)
        );

        const fileName =
            `${EXECUTION_FILE_PREFIX}-${timestamp}.json`;

        const filePath = path.join(
            executionsDir,
            fileName
        );

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                report,
                null,
                2
            ),
            "utf-8"
        );
    }

    return {
        saveMapping,
        saveError,
        saveExecution,
    };
}

/* =========================================================
 * UTILITÁRIOS
 * ========================================================= */

function csvEscape(value: string): string {
    if (
        value.includes(",") ||
        value.includes('"') ||
        value.includes("\n")
    ) {
        return `"${value.replace(
            /"/g,
            '""'
        )}"`;
    }

    return value;
}