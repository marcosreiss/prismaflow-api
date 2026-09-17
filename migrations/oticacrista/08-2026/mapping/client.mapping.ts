// migrations/oticacrista/08-2026/mapping/client.mapping.ts

import fs from "fs";
import path from "path";

export interface ClientMapping {
    oldId: string;
    newId: number;
    name: string;
    matchedBy: string;
}

const MAPPING_FILE = path.resolve(
    __dirname,
    "../mapping/03-client-mapping.csv",
);

const TEMP_MAPPING_FILE = `${MAPPING_FILE}.tmp`;

export function loadClientMapping(): Map<string, number> {
    const mapping = new Map<string, number>();

    if (!fs.existsSync(MAPPING_FILE)) {
        return mapping;
    }

    const content = fs.readFileSync(
        MAPPING_FILE,
        "utf-8",
    );

    const lines = content
        .split(/\r?\n/)
        .filter(Boolean);

    if (lines.length <= 1) {
        return mapping;
    }

    for (const line of lines.slice(1)) {
        const parts = line.split(",");

        if (parts.length < 2) {
            continue;
        }

        const oldId = parts[0];
        const newId = Number(parts[1]);

        if (
            oldId &&
            Number.isInteger(newId)
        ) {
            mapping.set(oldId, newId);
        }
    }

    return mapping;
}

export function createTemporaryMappingFile(): void {
    fs.mkdirSync(
        path.dirname(MAPPING_FILE),
        { recursive: true },
    );

    fs.writeFileSync(
        TEMP_MAPPING_FILE,
        "oldId,newId,name,matchedBy\n",
        "utf-8",
    );
}

export function appendTemporaryMapping(
    mapping: ClientMapping,
): void {
    const line = [
        mapping.oldId,
        mapping.newId,
        escapeCsv(mapping.name),
        mapping.matchedBy,
    ].join(",");

    fs.appendFileSync(
        TEMP_MAPPING_FILE,
        `${line}\n`,
        "utf-8",
    );
}

function escapeCsv(value: string): string {
    if (
        value.includes(",") ||
        value.includes('"') ||
        value.includes("\n")
    ) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
}

export function finalizeClientMapping(): void {
    if (!fs.existsSync(TEMP_MAPPING_FILE)) {
        return;
    }

    fs.renameSync(
        TEMP_MAPPING_FILE,
        MAPPING_FILE,
    );
}

export function discardTemporaryMapping(): void {
    if (fs.existsSync(TEMP_MAPPING_FILE)) {
        fs.unlinkSync(TEMP_MAPPING_FILE);
    }
}