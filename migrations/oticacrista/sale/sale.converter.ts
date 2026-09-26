// migrations/oticacrista/08-2026/converters/sale.converter.ts

import { SaleSource } from "./atendimento.loader";

export interface SaleItemConverted {
    oldProductId: number;
    quantity: number;
    totalPartial: number;
    discount: number;
    totalGeneral: number;
    observation: string | null;
}

export interface CarneInstallmentConverted {
    oldId: number;
    installments: number;
    installmentAmount: number;
    dueDate: Date | null;
    sequence: number;
    status: string | null;
    paymentDate: Date | null;
}

export interface SaleConverted {
    oldId: number;
    oldClientId: number | null;

    saleDate: Date | null;
    dueDate: Date | null;

    legacyTotal: number;

    paymentMethod: string | null;
    paymentStatus: string | null;

    entryAmount: number;

    items: SaleItemConverted[];

    carne: CarneInstallmentConverted[];

    subtotal: number;
    discount: number;
    total: number;
    legacyItemsTotal: number;

    paidAmount: number;
    installmentsPaid: number;
    lastPaymentAt: Date | null;

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

    let parsed = normalized;

    if (parsed.includes(",") && parsed.includes(".")) {
        // Se a vírgula vem ANTES do ponto (ex: 1,100.00 -> americano)
        if (parsed.indexOf(",") < parsed.indexOf(".")) {
            parsed = parsed.replace(/,/g, ""); // Apenas remove as vírgulas de milhar
        } else {
            // Se o ponto vem ANTES da vírgula (ex: 1.100,00 -> brasileiro)
            parsed = parsed.replace(/\./g, "").replace(",", ".");
        }
    } else if (parsed.includes(",")) {
        // Apenas vírgula (ex: 40,00)
        parsed = parsed.replace(",", ".");
    }

    const number = Number(
        parsed.replace(/[^\d.-]/g, ""),
    );

    return Number.isFinite(number)
        ? number
        : 0;
}

function parseInteger(
    value: string | undefined | null,
): number {
    const number = Number.parseInt(
        clean(value),
        10,
    );

    return Number.isFinite(number)
        ? number
        : 0;
}

function parseDate(
    value: string | undefined | null,
): Date | null {
    const normalized = clean(value);

    if (!normalized) {
        return null;
    }

    /*
     * Formato legado:
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

    const month =
        months[match[2].toLowerCase()];

    if (month === undefined) {
        return null;
    }

    let year = Number(match[3]);

    /*
     * Regra definida para a migration:
     *
     * 00–25 -> 2000–2025
     * 26–99 -> 1926–1999
     */
    if (year < 100) {
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
    value: string | null,
): string | null {
    const normalized =
        clean(value).toUpperCase();

    return normalized || null;
}

function isPaidInstallment(
    status: string | null,
    paymentDate: Date | null,
): boolean {
    /*
     * A existência da data de pagamento é
     * o indicador mais confiável.
     *
     * O status também é considerado para
     * cobrir registros onde a data não foi
     * preenchida.
     */
    if (paymentDate) {
        return true;
    }

    if (!status) {
        return false;
    }

    const normalized =
        status.toLowerCase();

    return (
        normalized.includes("pago") ||
        normalized.includes("quitado") ||
        normalized.includes("conclu")
    );
}

function convertItems(
    source: SaleSource,
): SaleItemConverted[] {
    return source.itens.map((item) => ({
        oldProductId: parseInteger(
            item.itemProduto,
        ),

        quantity: parseInteger(
            item.itemQtd,
        ),

        totalPartial: parseMoney(
            item.itemTotalParcial,
        ),

        discount: parseMoney(
            item.itemDesc,
        ),

        totalGeneral: parseMoney(
            item.itemTotalGeral,
        ),

        observation:
            clean(item.itemObs) || null,
    }));
}

function convertCarne(
    source: SaleSource,
): CarneInstallmentConverted[] {
    return source.carne.map((item) => ({
        oldId: parseInteger(item.carId),

        installments: parseInteger(
            item.carParcelas,
        ),

        installmentAmount: parseMoney(
            item.carValorParcela,
        ),

        dueDate: parseDate(
            item.carVencimento,
        ),

        sequence: parseInteger(
            item.carNumeroParcela,
        ),

        status:
            clean(item.carParcelaStatus) ||
            null,

        paymentDate: parseDate(
            item.carDataPagamento,
        ),
    }));
}

export function convertSale(
    source: SaleSource,
): SaleConverted {
    const atendimento =
        source.atendimento;

    const items =
        convertItems(source);

    const carne =
        convertCarne(source);

    const subtotal = items.reduce(
        (sum, item) =>
            sum + item.totalPartial,
        0,
    );

    const discount = items.reduce(
        (sum, item) =>
            sum + item.discount,
        0,
    );

    const total =
        subtotal - discount;

    const legacyItemsTotal =
        items.reduce(
            (sum, item) =>
                sum + item.totalGeneral,
            0,
        );

    const paidCarne =
        carne.reduce(
            (sum, installment) =>
                sum +
                (isPaidInstallment(
                    installment.status,
                    installment.paymentDate,
                )
                    ? installment.installmentAmount
                    : 0),
            0,
        );

    const installmentsPaid =
        carne.filter((installment) =>
            isPaidInstallment(
                installment.status,
                installment.paymentDate,
            ),
        ).length;

    const paymentMethod =
        normalizePaymentMethod(
            atendimento.ateFormaPagamento,
        );

    const isCarne =
        paymentMethod === "CARNÊ" ||
        paymentMethod === "CARNE";

    const paymentStatus =
        clean(atendimento.atePago) ||
        null;

    const isPaidByStatus =
        paymentStatus
            ?.toLowerCase()
            .includes("pago com sucesso") ??
        false;

    const paidAmount = isCarne
        ? atendimento.ateEntrada
            ? parseMoney(
                atendimento.ateEntrada,
            ) + paidCarne
            : paidCarne
        : isPaidByStatus
            ? total
            : parseMoney(
                atendimento.ateEntrada,
            );

    const paymentDates =
        carne
            .map(
                (installment) =>
                    installment.paymentDate,
            )
            .filter(
                (date): date is Date =>
                    date !== null,
            );

    const lastPaymentAt =
        paymentDates.length > 0
            ? new Date(
                Math.max(
                    ...paymentDates.map(
                        (date) =>
                            date.getTime(),
                    ),
                ),
            )
            : isPaidByStatus
                ? parseDate(
                    atendimento.ateDataCompra,
                )
                : null;

    return {
        oldId: parseInteger(
            atendimento.ateId,
        ),

        oldClientId:
            clean(atendimento.ateCliente)
                ? parseInteger(
                    atendimento.ateCliente,
                )
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

        paymentMethod,

        paymentStatus,

        entryAmount: parseMoney(
            atendimento.ateEntrada,
        ),

        items,

        carne,

        subtotal,

        discount,

        total,

        legacyItemsTotal,

        paidAmount,

        installmentsPaid,

        lastPaymentAt,

        source,
    };
}

export function isCarnePayment(
    paymentMethod: string | null,
): boolean {
    const normalized =
        clean(paymentMethod).toUpperCase();

    return (
        normalized === "CARNÊ" ||
        normalized === "CARNE"
    );
}