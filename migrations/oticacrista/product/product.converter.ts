// migrations/oticacrista/product/product.converter.ts

import type { ProductCategory } from "@prisma/client";
import type { OldProduct } from "./product.loader";

export type ConvertedKind = "PRODUCT" | "SERVICE";

export interface ConvertedProduct {
    oldId: number;
    kind: ConvertedKind;
    name: string;
    brandOldId: number | null;
    costPrice: number;
    salePrice: number;
    markup: number;
    stockQuantity: number;
    category: ProductCategory | null;
}

function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

/**
 * Detecção automática de categoria por palavras-chave no nome.
 * Retorna null quando não é possível decidir automaticamente —
 * nesse caso a decisão final é manual (ver product.matcher.ts).
 */
export function detectCategory(name: string): ProductCategory | null {
    const normalized = normalizeText(name);

    if (
        normalized.includes("ARMACAO") ||
        normalized.includes("OCULOS") ||
        normalized.includes("SOLAR")
    ) {
        return "FRAME";
    }

    if (normalized.includes("LENTE") || normalized.includes("VARILUX")) {
        return "LENS";
    }

    if (
        normalized.includes("COLORACAO") ||
        normalized.includes("RENEGOCIACAO") ||
        normalized.includes("ACORDO") ||
        normalized.includes("Produto Indisponivel") ||
        normalized.includes("SALDO DEVEDOR 2014") ||
        normalized.includes("ATUALIZAR PRODUTO1") ||
        normalized.includes("ATUALIZAR PRODUTO2") ||
        normalized.includes("ATUALIZAR PRODUTO4")
    ) {
        return "ACCESSORY";
    }

    return null;
}

function detectKind(prodTipo: string): ConvertedKind {
    return normalizeText(prodTipo) === "SERVICO" ? "SERVICE" : "PRODUCT";
}

export function convertProduct(
    oldProduct: OldProduct,
): ConvertedProduct {
    return {
        oldId: oldProduct.prodId,
        kind: detectKind(oldProduct.prodTipo),
        name: oldProduct.prodNome.trim(),
        brandOldId: oldProduct.prodMarca,
        costPrice: Math.max(0, oldProduct.prodPrecoCompra),
        salePrice: Math.max(0, oldProduct.prodPrecoVenda),
        markup: oldProduct.prodPercentual,
        stockQuantity: Math.max(0, oldProduct.prodQtd),
        category: detectCategory(oldProduct.prodNome),
    };
}