// migrations/oticacrista/brands/brand.loader.ts

// Responsável apenas por ler o CSV
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface OldBrand {
    marcaId: number;
    marcaNome: string;
}

export interface LoadBrandsOptions {
    inputDir: string;
}

export function loadBrands(
    options: LoadBrandsOptions
): OldBrand[] {
    const filePath = path.join(
        options.inputDir,
        "marca.csv"
    );

    const fileContent = fs.readFileSync(
        filePath,
        "utf-8"
    );

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