// migrations/oticacrista/shared/mapping.ts

import fs from "node:fs";
import path from "node:path";

/* =========================================================
 * LEITURA DE MAPPING (genérico, reutilizável por qualquer entidade)
 * ========================================================= */

export interface MappingRow {
    oldId: number;
    newId: number;
    status: string;
    oldName: string;
    newName: string;
}

/**
 * Carrega um mapping já finalizado (old_id,new_id,status,old_name,new_name)
 * de outra entidade, indexado por oldId.
 *
 * Usado, por exemplo, pela migração de Product para resolver o
 * brandNewId a partir do brandOldId, lendo o mapping de Brand.
 */
export function loadMapping(
    mappingsDir: string,
    entity: string,
): Map<number, MappingRow> {
    const filePath = path.join(
        mappingsDir,
        `${entity}-mapping.csv`,
    );

    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Mapping de "${entity}" não encontrado: ${filePath}`,
        );
    }

    return loadMappingFile(filePath, entity);
}

/** Loads a mapping file at an explicit path using the same strict parser. */
export function loadMappingFile(
    filePath: string,
    entity: string,
): Map<number, MappingRow> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Mapping de "${entity}" não encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

    if (lines.length === 0) {
        throw new Error(`Mapping de "${entity}" está vazio: ${filePath}`);
    }

    const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
    if (header[0] !== "old_id" || header[1] !== "new_id" || header[2] !== "status") {
        throw new Error(`Cabeçalho inválido no mapping de "${entity}": ${filePath}`);
    }

    const map = new Map<number, MappingRow>();

    for (const [index, line] of lines.slice(1).entries()) {
        const values = parseCsvLine(line);

        const oldId = Number(values[0]);
        const newId = Number(values[1]);

        if (!Number.isSafeInteger(oldId) || oldId < 1 || !Number.isSafeInteger(newId) || newId < 1 || !values[2]) {
            throw new Error(`Mapping de "${entity}" contém IDs inválidos na linha ${index + 2}: ${filePath}`);
        }

        if (map.has(oldId)) {
            throw new Error(`Mapping de "${entity}" contém old_id duplicado (${oldId}): ${filePath}`);
        }

        map.set(oldId, {
            oldId,
            newId,
            status: values[2] ?? "",
            oldName: values[3] ?? "",
            newName: values[4] ?? "",
        });
    }

    return map;
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}

export function csvEscape(value: unknown): string {
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

/* =========================================================
 * ESCRITA INCREMENTAL DE MAPPING
 * ========================================================= *
 *
 * Fluxo:
 *   create()  -> cria o .tmp com o header
 *   append()  -> adiciona uma linha por vez, conforme os
 *                registros vão sendo processados
 *   finalize() -> .tmp -> arquivo definitivo (só chamar
 *                 quando a execução termina sem erros)
 *   discard() -> remove o .tmp (execução terminou com erros,
 *                mapping anterior é preservado)
 *
 * Em DRY_RUN, nenhuma dessas funções deve ser chamada pelo
 * orquestrador/report — o mapping simplesmente não é tocado.
 */

export interface MappingWriter {
    create: (header: string) => void;
    append: (row: (string | number | null)[]) => void;
    finalize: () => void;
    discard: () => void;
    getPath: () => string;
}

export function createMappingWriter(
    mappingsDir: string,
    entity: string,
): MappingWriter {
    const finalPath = path.join(
        mappingsDir,
        `${entity}-mapping.csv`,
    );

    const tempPath = `${finalPath}.tmp`;

    function create(header: string): void {
        fs.mkdirSync(mappingsDir, { recursive: true });
        fs.writeFileSync(tempPath, `${header}\n`, "utf-8");
    }

    function append(row: (string | number | null)[]): void {
        const line = row.map(csvEscape).join(",");
        fs.appendFileSync(tempPath, `${line}\n`, "utf-8");
    }

    function finalize(): void {
        if (!fs.existsSync(tempPath)) {
            return;
        }

        fs.renameSync(tempPath, finalPath);
    }

    function discard(): void {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }

    function getPath(): string {
        return finalPath;
    }

    return { create, append, finalize, discard, getPath };
}
