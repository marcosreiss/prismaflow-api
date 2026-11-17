import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export interface OldPaymentSale {
    ateId: string;
    ateDataCompra: string;
    ateTotal: string;
    atePago: string;
    ateFormaPagamento: string;
    ateEntrada: string;
}

export interface OldInstallment {
    carId: string;
    carAtendimento: string;
    carParcelas: string;
    carValorParcela: string;
    carVencimento: string;
    carNumeroParcela: string;
    carParcelaStatus: string;
    carDataPagamento: string;
}

const INPUT_DIR = path.resolve(process.cwd(), "migrations/oticacrista/input");

function loadCsv<T>(filePath: string, requiredHeaders: string[]): T[] {
    if (!fs.existsSync(filePath)) throw new Error(`Arquivo de entrada não encontrado: ${filePath}`);
    const records = parse(fs.readFileSync(filePath, "utf8"), {
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

export function loadPayments(inputDir = INPUT_DIR): { sales: OldPaymentSale[]; installments: OldInstallment[] } {
    return {
        sales: loadCsv<OldPaymentSale>(path.join(inputDir, "atendimento.csv"), [
            "ateId", "ateDataCompra", "ateTotal", "atePago", "ateFormaPagamento", "ateEntrada",
        ]),
        installments: loadCsv<OldInstallment>(path.join(inputDir, "carne.csv"), [
            "carId", "carAtendimento", "carParcelas", "carValorParcela", "carVencimento",
            "carNumeroParcela", "carParcelaStatus", "carDataPagamento",
        ]),
    };
}
