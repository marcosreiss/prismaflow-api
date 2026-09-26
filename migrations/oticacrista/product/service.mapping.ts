// migrations/oticacrista/product/service.mapping.ts

import fs from "node:fs";
import path from "node:path";

export interface ServiceMapping {
    oldId: string | number;
    newId: string | number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
}

const MAPPING_PATH = path.resolve(
    process.cwd(),
    "migrations/oticacrista/mappings/02-service-mapping.csv",
);

const TEMP_MAPPING_PATH = `${MAPPING_PATH}.tmp`;

function escapeCsv(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);

    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
    ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

function ensureDirectory(): void {
    const directory = path.dirname(MAPPING_PATH);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

/**
 * Cria o arquivo temporário do mapping.
 *
 * O arquivo definitivo só será criado após a migração
 * ser concluída sem erros.
 */
export function createServiceMappingTemp(): void {
    ensureDirectory();

    const header =
        "old_id,new_id,status,old_name,new_name\n";

    fs.writeFileSync(TEMP_MAPPING_PATH, header, "utf8");
}

/**
 * Adiciona um registro ao mapping temporário.
 */
export function appendServiceMapping(
    mapping: ServiceMapping
): void {
    const row = [
        escapeCsv(mapping.oldId),
        escapeCsv(mapping.newId),
        escapeCsv(mapping.status),
        escapeCsv(mapping.oldName),
        escapeCsv(mapping.newName),
    ].join(",");

    fs.appendFileSync(
        TEMP_MAPPING_PATH,
        `${row}\n`,
        "utf8"
    );
}

/**
 * Salva vários registros de mapping de uma vez.
 */
export function saveServiceMapping(
    mappings: ServiceMapping[]
): void {
    createServiceMappingTemp();

    for (const mapping of mappings) {
        appendServiceMapping(mapping);
    }
}

/**
 * Finaliza o mapping:
 *
 * .tmp → arquivo definitivo
 *
 * Isso evita sobrescrever o último mapping válido
 * caso a execução apresente erros.
 */
export function finalizeServiceMapping(): void {
    if (!fs.existsSync(TEMP_MAPPING_PATH)) {
        return;
    }

    if (fs.existsSync(MAPPING_PATH)) {
        fs.unlinkSync(MAPPING_PATH);
    }

    fs.renameSync(TEMP_MAPPING_PATH, MAPPING_PATH);
}

/**
 * Remove o arquivo temporário caso a execução
 * tenha apresentado erros.
 */
export function discardServiceMapping(): void {
    if (fs.existsSync(TEMP_MAPPING_PATH)) {
        fs.unlinkSync(TEMP_MAPPING_PATH);
    }
}

/**
 * Retorna o caminho do mapping definitivo.
 */
export function getServiceMappingPath(): string {
    return MAPPING_PATH;
}