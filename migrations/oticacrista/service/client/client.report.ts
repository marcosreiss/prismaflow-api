/**
 * Responsável pelos relatórios da execução.
 */

import fs from "node:fs";
import path from "node:path";

const REPORTS_PATH = path.resolve(
    __dirname,
    "../../reports",
);

export const ERRORS_PATH = path.join(
    REPORTS_PATH,
    "errors",
);

export const EXECUTIONS_PATH =
    path.join(
        REPORTS_PATH,
        "executions",
    );

export function createTimestamp(): string {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

export function saveJson(
    directory: string,
    filename: string,
    data: unknown,
): void {
    fs.mkdirSync(
        directory,
        {
            recursive: true,
        },
    );

    fs.writeFileSync(
        path.join(
            directory,
            filename,
        ),
        JSON.stringify(
            data,
            null,
            2,
        ),
        "utf-8",
    );
}

export function saveClientErrors(
    pending: unknown[],
    errors: unknown[],
): void {
    if (
        pending.length === 0 &&
        errors.length === 0
    ) {
        return;
    }

    saveJson(
        ERRORS_PATH,
        `03-client-errors-${createTimestamp()}.json`,
        {
            pending,
            errors,
        },
    );
}

export function saveClientExecution(
    data: {
        migration: string;
        tenantId: string;
        branchId: string;
        dryRun: boolean;
        startedAt: Date;
        finishedAt: Date;
        total: number;
        created: number;
        existing: number;
        pending: number;
        errors: number;
        mappingSaved: boolean;
    },
): void {
    saveJson(
        EXECUTIONS_PATH,
        `03-client-${createTimestamp()}.json`,
        {
            ...data,
            durationMs:
                data.finishedAt.getTime() -
                data.startedAt.getTime(),
        },
    );
}