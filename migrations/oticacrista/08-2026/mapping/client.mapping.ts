// migrations/oticacrista/08-2026/mapping/client.mapping.ts
/**
 * Responsável pela relação: oldId -> newId dos clientes.
 */

import fs from "node:fs";
import path from "node:path";

export interface ClientMapping {
    oldId: string;
    newId: number;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
    matchedBy: string;
}

const MAPPING_PATH = path.resolve(
    __dirname,
    "../reports/mappings/03-client-mapping.csv",
);

const TEMP_MAPPING_PATH =
    `${MAPPING_PATH}.tmp`;

function escapeCsv(
    value: string | number | null,
): string {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    const stringValue = String(value);

    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
    ) {
        return `"${stringValue.replace(
            /"/g,
            '""',
        )}"`;
    }

    return stringValue;
}

function parseCsvLine(
    line: string,
): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (
            char === "," &&
            !insideQuotes
        ) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}

export function loadClientMapping():
    Map<string, number> {
    const mapping =
        new Map<string, number>();

    if (!fs.existsSync(MAPPING_PATH)) {
        return mapping;
    }

    const content =
        fs.readFileSync(
            MAPPING_PATH,
            "utf-8",
        );

    const lines = content
        .split(/\r?\n/)
        .filter(Boolean);

    for (const line of lines.slice(1)) {
        const values =
            parseCsvLine(line);

        const oldId =
            values[0];

        const newId =
            Number(values[1]);

        if (
            oldId &&
            Number.isInteger(newId)
        ) {
            mapping.set(
                oldId,
                newId,
            );
        }
    }

    return mapping;
}

export function createTemporaryMappingFile():
    void {
    fs.mkdirSync(
        path.dirname(MAPPING_PATH),
        { recursive: true },
    );

    fs.writeFileSync(
        TEMP_MAPPING_PATH,
        [
            "old_id",
            "new_id",
            "status",
            "old_name",
            "new_name",
            "matched_by",
        ].join(",") + "\n",
        "utf-8",
    );
}

export function appendTemporaryMapping(
    mapping: ClientMapping,
): void {
    const row = [
        mapping.oldId,
        mapping.newId,
        mapping.status,
        mapping.oldName,
        mapping.newName,
        mapping.matchedBy,
    ]
        .map(escapeCsv)
        .join(",");

    fs.appendFileSync(
        TEMP_MAPPING_PATH,
        `${row}\n`,
        "utf-8",
    );
}

export function finalizeClientMapping():
    void {
    if (
        !fs.existsSync(
            TEMP_MAPPING_PATH,
        )
    ) {
        return;
    }

    fs.renameSync(
        TEMP_MAPPING_PATH,
        MAPPING_PATH,
    );
}

export function discardTemporaryMapping():
    void {
    if (
        fs.existsSync(
            TEMP_MAPPING_PATH,
        )
    ) {
        fs.unlinkSync(
            TEMP_MAPPING_PATH,
        );
    }
}

export function getClientMappingPath():
    string {
    return MAPPING_PATH;
}