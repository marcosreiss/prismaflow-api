// Responsável apenas por ler o CSV
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface OldBrand {
    marcaId: number;
    marcaNome: string;
}

export function loadBrands(): OldBrand[] {
    const filePath = path.resolve(
        process.cwd(),
        "migrations/oticacrista/08-2026/input/marca.csv"
    );

    const fileContent = fs.readFileSync(filePath, "utf-8");

    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
    });

    return records.map((record: any) => ({
        marcaId: Number(record.marcaId),
        marcaNome: record.marcaNome,
    }));
}