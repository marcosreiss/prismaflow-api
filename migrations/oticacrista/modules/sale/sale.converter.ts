import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import type { OldSale, OldSaleItem } from "./sale.loader";

export interface ConvertedItem {
    productId: number;
    quantity: number;
    unitPrice: number;
    legacyProductId: number;
}

export interface ConvertedSale {
    legacyId: number;
    legacyClientId: number;
    clientId: number;
    saleDate: Date | null;
    subtotalCents: bigint;
    discountCents: bigint;
    totalCents: bigint;
    subtotal: number;
    discount: number;
    total: number;
    notes: string | null;
    items: ConvertedItem[];
}

export function parseLegacyId(value: string): number | null {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseCents(value: string): bigint | null {
    let text = value.trim().replace(/[^\d,.-]/g, "");
    if (!text || !/^-?[\d.,]+$/.test(text)) return null;

    const negative = text.startsWith("-");
    text = text.replace(/-/g, "");
    if (!text || !/\d/.test(text)) return null;

    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");
    let decimalIndex = -1;
    if (comma >= 0 && dot >= 0) {
        decimalIndex = Math.max(comma, dot);
    } else if (comma >= 0 || dot >= 0) {
        const separator = Math.max(comma, dot);
        const decimals = text.length - separator - 1;
        const separators = [...text].filter((char) => char === "," || char === ".").length;
        if (decimals !== 3 || separators > 1) decimalIndex = separator;
    }

    const wholeText = (decimalIndex < 0 ? text : text.slice(0, decimalIndex)).replace(/[.,]/g, "") || "0";
    const fractionText = decimalIndex < 0 ? "" : text.slice(decimalIndex + 1).replace(/[.,]/g, "");
    if (!/^\d+$/.test(wholeText) || (fractionText && !/^\d+$/.test(fractionText))) return null;

    const twoDigits = `${fractionText}00`.slice(0, 2);
    let cents = BigInt(wholeText) * 100n + BigInt(twoDigits || "0");
    if (fractionText.length > 2 && Number(fractionText[2]) >= 5) cents++;
    return negative ? -cents : cents;
}

export function parseQuantity(value: string): number | null {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;
    const quantity = Number(normalized);
    return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function parseSaleDate(value: string): Date | null {
    const raw = value.trim();
    if (!raw) return null;

    const namedMonth = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
    let year: number;
    let month: number;
    let day: number;
    if (namedMonth) {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        month = months.indexOf(namedMonth[2].toUpperCase()) + 1;
        day = Number(namedMonth[1]);
        year = Number(namedMonth[3]);
    } else {
        const numeric = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!numeric) return null;
        year = Number(numeric[1]);
        month = Number(numeric[2]);
        day = Number(numeric[3]);
    }
    if (month < 1 || month > 12) return null;
    if (year < 100) year += year <= 25 ? 2000 : 1900;

    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? date
        : null;
}

function centsAsNumber(cents: bigint): number {
    const integer = Number(cents);
    if (!Number.isSafeInteger(integer)) throw new Error("Valor monetário excede a precisão segura suportada.");
    return integer / 100;
}

export function convertSale(
    sale: OldSale,
    legacyItems: OldSaleItem[],
    clientMapping: MappingRow | null,
    productMappings: Map<number, MappingRow>,
): { sale: ConvertedSale | null; issues: string[] } {
    const issues: string[] = [];
    const legacyId = parseLegacyId(sale.ateId);
    const legacyClientId = parseLegacyId(sale.ateCliente);
    const totalCents = parseCents(sale.ateTotal);
    const saleDate = parseSaleDate(sale.ateDataCompra);

    if (legacyId === null) issues.push(`ID de atendimento inválido: ${sale.ateId}`);
    if (legacyClientId === null) issues.push(`ID de cliente inválido: ${sale.ateCliente}`);
    else if (!clientMapping) issues.push(`Cliente legado ${legacyClientId} sem correspondência no client-mapping.csv.`);
    if (totalCents === null || totalCents < 0n) issues.push(`Total da venda inválido: ${sale.ateTotal}`);
    if (sale.ateDataCompra.trim() && !saleDate) issues.push(`Data da venda inválida: ${sale.ateDataCompra}`);

    let subtotalCents = 0n;
    const items: ConvertedItem[] = [];
    for (const item of legacyItems) {
        const legacyProductId = parseLegacyId(item.itemProduto);
        const product = legacyProductId === null ? undefined : productMappings.get(legacyProductId);
        const quantity = parseQuantity(item.itemQtd);
        const unitPriceCents = parseCents(item.itemTotalParcial);

        if (legacyProductId === null) issues.push(`ID de produto inválido: ${item.itemProduto}`);
        else if (!product) issues.push(`Produto legado ${legacyProductId} sem correspondência no product-mapping.csv.`);
        if (quantity === null) issues.push(`Quantidade inválida para o produto ${item.itemProduto}: ${item.itemQtd}`);
        if (unitPriceCents === null || unitPriceCents < 0n) issues.push(`Valor parcial inválido para o produto ${item.itemProduto}: ${item.itemTotalParcial}`);

        if (product && quantity !== null && unitPriceCents !== null && unitPriceCents >= 0n && legacyProductId !== null) {
            subtotalCents += unitPriceCents * BigInt(quantity);
            items.push({
                productId: product.newId,
                quantity,
                unitPrice: centsAsNumber(unitPriceCents),
                legacyProductId,
            });
        }
    }

    if (totalCents !== null && subtotalCents < totalCents) {
        issues.push(`Subtotal calculado (${centsAsNumber(subtotalCents).toFixed(2)}) é menor que ateTotal (${centsAsNumber(totalCents).toFixed(2)}); o desconto seria negativo.`);
    }

    if (issues.length || legacyId === null || legacyClientId === null || totalCents === null || !clientMapping) {
        return { sale: null, issues };
    }

    const discountCents = subtotalCents - totalCents;
    if (discountCents < 0n) return { sale: null, issues: ["Desconto calculado negativo."] };

    const notes = legacyItems.map((item) => {
        const productId = parseLegacyId(item.itemProduto);
        const productName = productId === null ? null : productMappings.get(productId)?.oldName;
        const label = productName?.trim() || `produto legado ${item.itemProduto}`;
        // Keep even blank and repeated observations, tied to their source item.
        return `${label} (ID legado ${item.itemProduto}): ${item.itemObs}`;
    }).join("\n") || null;

    return {
        sale: {
            legacyId,
            legacyClientId,
            clientId: clientMapping.newId,
            saleDate,
            subtotalCents,
            discountCents,
            totalCents,
            subtotal: centsAsNumber(subtotalCents),
            discount: centsAsNumber(discountCents),
            total: centsAsNumber(totalCents),
            notes,
            items,
        },
        issues,
    };
}
