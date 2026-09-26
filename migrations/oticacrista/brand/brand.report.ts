import fs from "node:fs";
import path from "node:path";

import type { OldBrand } from "./brand.loader";
import type { MigrationExecutionReport } from "../shared/types";
import {
    formatTimestamp,
    serializeError,
} from "../shared/utils";

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

export function createBrandReport(
    options: BrandReportOptions
) {
    const errorsDir = path.join(
        options.reportsDir,
        "errors"
    );

    const executionsDir = path.join(
        options.reportsDir,
        "executions"
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
        const outputDir = path.resolve(
            process.cwd(),
            "migrations/oticacrista/mappings"
        );

        fs.mkdirSync(outputDir, {
            recursive: true,
        });

        const finalPath = path.join(
            outputDir,
            "01-brand-mapping.csv"
        );

        const tempPath = `${finalPath}.tmp`;

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

        const filePath = path.join(
            errorsDir,
            `01-brand-error-${brand.marcaId}-${timestamp}.json`
        );

        const errorData = {
            entity: "Brand",
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

        const filePath = path.join(
            executionsDir,
            `01-brand-execution-${timestamp}.json`
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