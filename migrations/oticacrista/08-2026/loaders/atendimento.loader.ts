// migrations/oticacrista/08-2026/loaders/atendimento.loader.ts

import fs from "node:fs";
import path from "node:path";

export interface AtendimentoCsv {
    ateId: string;
    ateColaborador: string;
    ateCliente: string;
    ateDataCompra: string;
    ateDataVencimento: string;
    ateTotal: string;
    atePago: string;
    ateFormaPagamento: string;
    ateEntrada: string;
}

export interface CarneCsv {
    carId: string;
    carAtendimento: string;
    carParcelas: string;
    carValorParcela: string;
    carVencimento: string;
    carNumeroParcela: string;
    carParcelaStatus: string;
    carDataPagamento: string;
}

export interface ItemAtendimentoCsv {
    [key: string]: string;
}

export interface SaleSource {
    atendimento: AtendimentoCsv;
    carne: CarneCsv[];
    itens: ItemAtendimentoCsv[];
}

function clean(value: string | undefined | null): string {
    return (value ?? "").trim();
}

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }

            continue;
        }

        if (char === "," && !insideQuotes) {
            values.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}

function loadCsv<T extends Record<string, string>>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo CSV não encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");

    const lines = content
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
        return [];
    }

    const headers = parseCsvLine(lines[0]).map(clean);

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
            record[header] = clean(values[index]);
        });

        return record as T;
    });
}

function groupByAtendimento(
    carne: CarneCsv[],
): Map<string, CarneCsv[]> {
    const grouped = new Map<string, CarneCsv[]>();

    for (const parcela of carne) {
        const atendimentoId = clean(parcela.carAtendimento);

        if (!atendimentoId) {
            continue;
        }

        const current = grouped.get(atendimentoId) ?? [];
        current.push(parcela);
        grouped.set(atendimentoId, current);
    }

    return grouped;
}

function groupItemsByAtendimento(
    itens: ItemAtendimentoCsv[],
): Map<string, ItemAtendimentoCsv[]> {
    const grouped = new Map<string, ItemAtendimentoCsv[]>();

    /*
     * O campo de relacionamento do itensAtendimento.csv pode possuir
     * nomenclatura diferente conforme a exportação do Access.
     *
     * Procuramos o campo pelo nome conhecido antes de agrupar.
     */
    const possibleKeys = [
        "itaAtendimento",
        "itemAtendimento",
        "iteAtendimento",
        "atendimento",
    ];

    for (const item of itens) {
        const key = possibleKeys.find((field) => field in item);
        const atendimentoId = key ? clean(item[key]) : "";

        if (!atendimentoId) {
            continue;
        }

        const current = grouped.get(atendimentoId) ?? [];
        current.push(item);
        grouped.set(atendimentoId, current);
    }

    return grouped;
}

export function loadClientSalesSources(): SaleSource[] {
    const inputDir = path.resolve(
        __dirname,
        "../input",
    );

    const atendimentoPath = path.join(
        inputDir,
        "atendimento.csv",
    );

    const carnePath = path.join(
        inputDir,
        "carne.csv",
    );

    const itensAtendimentoPath = path.join(
        inputDir,
        "itensAtendimento.csv",
    );

    const atendimentos = loadCsv<AtendimentoCsv>(
        atendimentoPath,
    );

    const carne = loadCsv<CarneCsv>(
        carnePath,
    );

    const itensAtendimento = loadCsv<ItemAtendimentoCsv>(
        itensAtendimentoPath,
    );

    const carneByAtendimento = groupByAtendimento(carne);

    const itemsByAtendimento =
        groupItemsByAtendimento(itensAtendimento);

    return atendimentos.map((atendimento) => ({
        atendimento,
        carne:
            carneByAtendimento.get(atendimento.ateId) ?? [],
        itens:
            itemsByAtendimento.get(atendimento.ateId) ?? [],
    }));
}

export function loadAtendimentoSources(): SaleSource[] {
    return loadClientSalesSources();
}