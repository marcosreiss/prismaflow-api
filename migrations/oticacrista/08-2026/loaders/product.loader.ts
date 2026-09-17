// migrations/oticacrista/08-2026/loaders/product.loader.ts

import fs from "fs";
import path from "path";

export interface OldProduct {
    prodId: number;
    prodNome: string;
    prodMarca: number | null;
    prodPrecoCompra: number;
    prodPrecoVenda: number;
    prodPercentual: number;
    prodQtd: number;
    prodTipo: string;
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

function parseNumber(value: string): number {
    if (!value || value.trim() === "") {
        return 0;
    }

    const normalized = value
        .trim()
        .replace(/\./g, "")
        .replace(",", ".");

    const number = Number(normalized);

    return Number.isFinite(number) ? number : 0;
}

export function loadProducts(filePath: string): OldProduct[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const headers = parseCsvLine(lines[0]);

    const requiredHeaders = [
        "prodId",
        "prodNome",
        "prodMarca",
        "prodPrecoCompra",
        "prodPrecoVenda",
        "prodPercentual",
        "prodQtd",
        "prodTipo",
    ];

    for (const header of requiredHeaders) {
        if (!headers.includes(header)) {
            throw new Error(
                `Coluna obrigatória "${header}" não encontrada no CSV.`,
            );
        }
    }

    return lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line);

        const get = (header: string): string => {
            const position = headers.indexOf(header);
            return values[position] ?? "";
        };

        const prodId = Number(get("prodId"));

        if (!Number.isInteger(prodId)) {
            throw new Error(
                `prodId inválido na linha ${index + 2}: ${get("prodId")}`,
            );
        }

        const marca = get("prodMarca").trim();

        return {
            prodId,
            prodNome: get("prodNome").trim(),
            prodMarca:
                marca === "" || marca === "0"
                    ? null
                    : Number(marca),
            prodPrecoCompra: parseNumber(get("prodPrecoCompra")),
            prodPrecoVenda: parseNumber(get("prodPrecoVenda")),
            prodPercentual: parseNumber(get("prodPercentual")),
            prodQtd: Math.max(0, Math.trunc(parseNumber(get("prodQtd")))),
            prodTipo: get("prodTipo").trim(),
        };
    });
}