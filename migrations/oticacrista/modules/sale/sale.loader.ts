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

    const records = parse(fs.readFileSync(filePath, "utf8"), {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: false,
        trim: false,
    }) as Array<Record<string, string>>;

    const headers = records.length ? Object.keys(records[0]) : parse(fs.readFileSync(filePath, "utf8"), { to_line: 1, bom: true })[0] as string[];
    for (const header of requiredHeaders) {
        if (!headers.includes(header)) throw new Error(`Coluna obrigatória "${header}" não encontrada em ${filePath}.`);
    }

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
