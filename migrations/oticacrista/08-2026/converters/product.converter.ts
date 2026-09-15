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
        normalized.includes("OCULOS")
    ) {
        return "FRAME";
    }

    /*
     * LENS
     */
    if (normalized.includes("LENTE")) {
        return "LENS";
    }

    /*
     * ACCESSORY e qualquer outro caso
     * ficam para decisão manual no script principal.
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