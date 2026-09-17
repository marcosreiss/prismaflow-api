//migrations/oticacrista/08-2026/converters/product.converter.ts

import type { ProductCategory } from "@prisma/client";
import type { OldProduct } from "../loaders/product.loader";

export interface ConvertedProduct {
    oldId: number;
    name: string;
    brandOldId: number | null;
    costPrice: number;
    salePrice: number;
    markup: number;
    stockQuantity: number;
    category: ProductCategory | null;
    oldType: string;
}

function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

export function detectCategory(
    name: string,
): ProductCategory | null {
    const normalized = normalizeText(name);

    /*
     * FRAME
     */
    if (
        normalized.includes("ARMACAO") ||
        normalized.includes("OCULOS") ||
        normalized.includes("SOLAR")
    ) {
        return "FRAME";
    }

    /*
     * LENS
     */
    if (
        normalized.includes("LENTE") ||
        normalized.includes("VARILUX")
    ) {
        return "LENS";
    }

    /*
     * ACCESSORY
     */
    if (
        normalized.includes("COLORACAO") ||
        normalized.includes("RENEGOCIACAO") ||
        normalized.includes("ACORDO")
    ) {
        return "ACCESSORY";
    }

    /*
     * Qualquer outro caso
     * fica para decisão manual no script principal.
     */
    return null;
}

export function convertProduct(
    oldProduct: OldProduct,
): ConvertedProduct {
    return {
        oldId: oldProduct.prodId,
        name: oldProduct.prodNome.trim(),
        brandOldId: oldProduct.prodMarca,
        costPrice: Math.max(0, oldProduct.prodPrecoCompra),
        salePrice: Math.max(0, oldProduct.prodPrecoVenda),
        markup: oldProduct.prodPercentual,
        stockQuantity: Math.max(0, oldProduct.prodQtd),
        category: detectCategory(oldProduct.prodNome),
        oldType: oldProduct.prodTipo,
    };
}