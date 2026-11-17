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

export const MYSQL_TEXT_MAX_BYTES = 65_535;
export const MYSQL_INT_MAX = 2_147_483_647;

export function textUtf8Bytes(value: string): number {
    return Buffer.byteLength(value, "utf8");
}

export function parseLegacyId(value: string): number | null {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseCents(value: string): bigint | null {
    let text = value.trim().replace(/R\$|BRL/gi, "").replace(/\s/g, "");
    if (!text || !/^-?[\d.,]+$/.test(text)) return null;

    const negative = text.startsWith("-");
    if (text.slice(1).includes("-")) return null;
    if (negative) text = text.slice(1);
    if (!text || !/\d/.test(text)) return null;

    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");
    let decimalIndex = -1;
    let groupingSeparator: string | null = null;
    if (comma >= 0 && dot >= 0) {
        decimalIndex = Math.max(comma, dot);
        groupingSeparator = text[decimalIndex] === "," ? "." : ",";
    } else if (comma >= 0 || dot >= 0) {
        const separator = Math.max(comma, dot);
        const token = text[separator];
        const separatorCount = [...text].filter((char) => char === token).length;
        const decimals = text.length - separator - 1;
        const isGroupedThousands = decimals === 3 && text.slice(0, separator).length >= 1 && text.slice(0, separator).length <= 3;
        if (separatorCount > 1) {
            const groups = text.split(token);
            if (groups[0].length < 1 || groups[0].length > 3 || groups.slice(1).some((group) => group.length !== 3)) {
                const lastSeparator = text.lastIndexOf(token);
                decimalIndex = lastSeparator;
                groupingSeparator = token;
            } else {
                groupingSeparator = token;
            }
        } else if (!isGroupedThousands || text.slice(0, separator) === "0") {
            decimalIndex = separator;
        } else {
            groupingSeparator = token;
        }
    }

    const wholeRaw = decimalIndex < 0 ? text : text.slice(0, decimalIndex);
    const fractionText = decimalIndex < 0 ? "" : text.slice(decimalIndex + 1);
    if (fractionText && !/^\d+$/.test(fractionText)) return null;
    if (groupingSeparator) {
        const groups = wholeRaw.split(groupingSeparator);
        if (groups[0].length < 1 || groups[0].length > 3 || !/^\d+$/.test(groups[0]) || groups.slice(1).some((group) => !/^\d{3}$/.test(group))) return null;
    } else if (!/^\d+$/.test(wholeRaw)) {
        return null;
    }
    const wholeText = wholeRaw.replace(/[.,]/g, "") || "0";

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
    return year >= 1000 && year <= 9999 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? date
        : null;
}

function centsAsNumber(cents: bigint): number | null {
    const integer = Number(cents);
    if (!Number.isSafeInteger(integer)) return null;
    return integer / 100;
}

function formatCents(cents: bigint): string {
    const negative = cents < 0n;
    const absolute = negative ? -cents : cents;
    const whole = absolute / 100n;
    const fraction = String(absolute % 100n).padStart(2, "0");
    return `${negative ? "-" : ""}${whole}.${fraction}`;
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
    else if (!Number.isInteger(clientMapping.newId) || clientMapping.newId < 1 || clientMapping.newId > MYSQL_INT_MAX) {
        issues.push(`ID de produção inválido no client-mapping.csv para o cliente ${legacyClientId}.`);
    }
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
        else if (!Number.isInteger(product.newId) || product.newId < 1 || product.newId > MYSQL_INT_MAX) {
            issues.push(`ID de produção inválido no product-mapping.csv para o produto ${legacyProductId}.`);
        }
        if (quantity === null) issues.push(`Quantidade inválida para o produto ${item.itemProduto}: ${item.itemQtd}`);
        else if (quantity > MYSQL_INT_MAX) issues.push(`Quantidade excede o limite INT do banco para o produto ${item.itemProduto}.`);
        if (unitPriceCents === null || unitPriceCents < 0n) issues.push(`Valor parcial inválido para o produto ${item.itemProduto}: ${item.itemTotalParcial}`);

        if (quantity !== null && unitPriceCents !== null && unitPriceCents >= 0n) {
            subtotalCents += unitPriceCents * BigInt(quantity);
        }
        const unitPrice = unitPriceCents !== null && unitPriceCents >= 0n ? centsAsNumber(unitPriceCents) : null;
        if (unitPriceCents !== null && unitPrice === null) {
            issues.push(`Valor parcial excede a precisão numérica segura para o produto ${item.itemProduto}.`);
        }
        if (product && quantity !== null && unitPriceCents !== null && unitPriceCents >= 0n && legacyProductId !== null
            && unitPrice !== null && Number.isInteger(product.newId) && product.newId > 0 && product.newId <= MYSQL_INT_MAX) {
            items.push({
                productId: product.newId,
                quantity,
                unitPrice,
                legacyProductId,
            });
        }
    }

    if (totalCents !== null && subtotalCents < totalCents) {
        issues.push(`Subtotal calculado (${formatCents(subtotalCents)}) é menor que ateTotal (${formatCents(totalCents)}); o desconto seria negativo.`);
    }

    const notes = legacyItems.map((item) => {
        const productId = parseLegacyId(item.itemProduto);
        const productName = productId === null ? null : productMappings.get(productId)?.oldName;
        const label = productName?.trim() || `produto legado ${item.itemProduto}`;
        // Keep even blank and repeated observations, tied to their source item.
        return `${label} (ID legado ${item.itemProduto}): ${item.itemObs}`;
    }).join("\n") || null;
    if (notes !== null && textUtf8Bytes(notes) > MYSQL_TEXT_MAX_BYTES) {
        issues.push(`Sale.notes excede o limite de MySQL TEXT: ${textUtf8Bytes(notes)} bytes; máximo ${MYSQL_TEXT_MAX_BYTES}.`);
    }

    const subtotal = centsAsNumber(subtotalCents);
    const total = totalCents === null ? null : centsAsNumber(totalCents);
    if (subtotal === null) issues.push("Subtotal excede a precisão numérica segura suportada pelo schema.");
    if (totalCents !== null && total === null) issues.push("Total excede a precisão numérica segura suportada pelo schema.");

    const discountCents = totalCents === null ? null : subtotalCents - totalCents;
    if (discountCents !== null && discountCents < 0n) {
        issues.push("Desconto calculado negativo.");
    }
    const discount = discountCents === null || discountCents < 0n ? null : centsAsNumber(discountCents);
    if (discountCents !== null && discount === null && discountCents >= 0n) {
        issues.push("Desconto excede a precisão numérica segura suportada pelo schema.");
    }

    if (issues.length || legacyId === null || legacyClientId === null || !clientMapping
        || subtotal === null || total === null || totalCents === null
        || discount === null || discountCents === null) {
        return { sale: null, issues };
    }

    return {
        sale: {
            legacyId,
            legacyClientId,
            clientId: clientMapping.newId,
            saleDate,
            subtotalCents,
            discountCents,
            totalCents,
            subtotal,
            discount,
            total,
            notes,
            items,
        },
        issues,
    };
}
