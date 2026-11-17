import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface OldSale {
    ateId: string;
    ateColaborador: string;
    ateCliente: string;
    ateDataCompra: string;
    ateTotal: string;
}

export interface OldSaleItem {
    itemAtendimento: string;
    itemProduto: string;
    itemQtd: string;
    itemTotalParcial: string;
    itemDesc: string;
    itemTotalGeral: string;
    itemObs: string;
}

function loadCsv<T>(filePath: string, requiredHeaders: string[]): T[] {
    if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);

    const content = fs.readFileSync(filePath, "utf8");
    const records = parse(content, {
        columns: (headers: string[]) => {
            const normalized = headers.map((header) => header.trim());
            const duplicates = normalized.filter((header, index) => normalized.indexOf(header) !== index);
            if (duplicates.length) throw new Error(`Cabeçalho duplicado em ${filePath}: ${[...new Set(duplicates)].join(", ")}`);
            const missing = requiredHeaders.filter((header) => !normalized.includes(header));
            if (missing.length) throw new Error(`Colunas obrigatórias ausentes em ${filePath}: ${missing.join(", ")}`);
            return normalized;
        },
        skip_empty_lines: true,
        bom: true,
        relax_column_count: false,
        trim: false,
    }) as Array<Record<string, string>>;

    return records.map((record) => Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, value ?? ""]),
    ) as unknown as T);
}

export function loadSales(inputDir: string): { sales: OldSale[]; items: OldSaleItem[] } {
    return {
        sales: loadCsv<OldSale>(path.join(inputDir, "atendimento.csv"), ["ateId", "ateCliente", "ateDataCompra", "ateTotal"]),
        items: loadCsv<OldSaleItem>(path.join(inputDir, "itensAtendimento.csv"), [
            "itemAtendimento", "itemProduto", "itemQtd", "itemTotalParcial", "itemObs",
        ]),
    };
}
