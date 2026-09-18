// migrations/oticacrista/08-2026/converters/sale.converter.ts

import { SaleSource } from "../loaders/atendimento.loader";

export interface SaleConverted {
    oldId: number;
    oldClientId: number | null;

    saleDate: Date | null;
    dueDate: Date | null;

    legacyTotal: number;

    paymentMethod: string | null;
    paymentStatus: string | null;

    entryAmount: number;

    installments: number;

    items: Record<string, string>[];

    carne: {
        id: number;
        installments: number;
        installmentAmount: number;
        dueDate: Date | null;
        installmentNumber: number;
        status: string | null;
        paymentDate: Date | null;
    }[];

    source: SaleSource;
}

function clean(value: string | undefined | null): string {
    return (value ?? "").trim();
}

function parseMoney(
    value: string | undefined | null,
): number {
    const normalized = clean(value);

    if (!normalized) {
        return 0;
    }

    /*
     * Legacy Access uses Brazilian monetary formatting:
     * 1.234,56
     * 960,00
     * 0,00
     */
    const parsed = normalized
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "");

    const number = Number(parsed);

    return Number.isFinite(number) ? number : 0;
}

function parseInteger(
    value: string | undefined | null,
): number {
    const number = Number.parseInt(clean(value), 10);

    return Number.isFinite(number) ? number : 0;
}

function parseDate(
    value: string | undefined | null,
): Date | null {
    const normalized = clean(value);

    if (!normalized) {
        return null;
    }

    /*
     * Dates from the legacy database may appear as:
     *
     * 10-Feb-15
     * 23-Sep-16
     * 09-Apr-22
     */
    const match = normalized.match(
        /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/,
    );

    if (!match) {
        return null;
    }

    const day = Number(match[1]);

    const months: Record<string, number> = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
    };

    const month = months[match[2].toLowerCase()];

    if (month === undefined) {
        return null;
    }

    let year = Number(match[3]);

    if (year < 100) {
        /*
         * Regra definida para a migration:
         *
         * 00–25 -> 2000–2025
         * 26–99 -> 1926–1999
         */
        year =
            year <= 25
                ? 2000 + year
                : 1900 + year;
    }

    const date = new Date(
        year,
        month,
        day,
    );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function normalizePaymentMethod(
    value: string | undefined | null,
): string | null {
    const normalized = clean(value);

    if (!normalized) {
        return null;
    }

    return normalized.toUpperCase();
}

function normalizePaymentStatus(
    value: string | undefined | null,
): string | null {
    const normalized = clean(value);

    return normalized || null;
}

function convertCarne(source: SaleSource) {
    return source.carne.map((parcela) => ({
        id: parseInteger(parcela.carId),

        installments: parseInteger(
            parcela.carParcelas,
        ),

        installmentAmount: parseMoney(
            parcela.carValorParcela,
        ),

        dueDate: parseDate(
            parcela.carVencimento,
        ),

        installmentNumber: parseInteger(
            parcela.carNumeroParcela,
        ),

        status:
            clean(parcela.carParcelaStatus) || null,

        paymentDate: parseDate(
            parcela.carDataPagamento,
        ),
    }));
}

export function convertSale(
    source: SaleSource,
): SaleConverted {
    const atendimento = source.atendimento;

    return {
        oldId: parseInteger(atendimento.ateId),

        oldClientId: atendimento.ateCliente
            ? parseInteger(atendimento.ateCliente)
            : null,

        saleDate: parseDate(
            atendimento.ateDataCompra,
        ),

        dueDate: parseDate(
            atendimento.ateDataVencimento,
        ),

        legacyTotal: parseMoney(
            atendimento.ateTotal,
        ),

        paymentMethod: normalizePaymentMethod(
            atendimento.ateFormaPagamento,
        ),

        paymentStatus: normalizePaymentStatus(
            atendimento.atePago,
        ),

        entryAmount: parseMoney(
            atendimento.ateEntrada,
        ),

        installments: source.carne.length
            ? Math.max(
                ...source.carne.map((parcela) =>
                    parseInteger(
                        parcela.carNumeroParcela,
                    ),
                ),
            )
            : 0,

        items: source.itens,

        carne: convertCarne(source),

        source,
    };
}