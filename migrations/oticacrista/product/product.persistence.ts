// migrations/oticacrista/product/product.persistence.ts

import { prisma } from "../../../src/config/prisma";
import type { ConvertedProduct } from "./product.converter";
import type { ResolvedBrand } from "./product.matcher";

export interface PersistResult {
    status: "CREATED" | "EXISTING";
    id: number | null;
    name: string;
}

/**
 * Produto: procura por tenantId + name + brandId.
 * Sem marca definida cai no fallback "SEM MARCA" (resolvido pelo matcher).
 */
export async function persistProduct(
    product: ConvertedProduct,
    brand: ResolvedBrand,
    category: "FRAME" | "LENS" | "ACCESSORY",
    tenantId: string,
    dryRun: boolean,
): Promise<PersistResult> {
    const existing = await prisma.product.findFirst({
        where: {
            tenantId,
            name: product.name,
            brandId: brand.brandNewId,
        },
    });

    if (existing) {
        return {
            status: "EXISTING",
            id: existing.id,
            name: existing.name,
        };
    }

    if (dryRun) {
        return {
            status: "CREATED",
            id: null,
            name: product.name,
        };
    }

    const created = await prisma.product.create({
        data: {
            name: product.name,
            description: null,
            costPrice: product.costPrice,
            markup: product.markup,
            salePrice: product.salePrice,
            stockQuantity: product.stockQuantity,
            minimumStock: 0,
            category,
            isActive: true,
            tenantId,
            branchId: null,
            brandId: brand.brandNewId,
        },
    });

    return {
        status: "CREATED",
        id: created.id,
        name: created.name,
    };
}

/**
 * Serviço óptico: procura por tenantId + name (sem marca).
 */
export async function persistService(
    product: ConvertedProduct,
    tenantId: string,
    branchId: string,
    dryRun: boolean,
): Promise<PersistResult> {
    const existing = await prisma.opticalService.findFirst({
        where: {
            tenantId,
            name: product.name,
        },
    });

    if (existing) {
        return {
            status: "EXISTING",
            id: existing.id,
            name: existing.name,
        };
    }

    if (dryRun) {
        return {
            status: "CREATED",
            id: null,
            name: product.name,
        };
    }

    const created = await prisma.opticalService.create({
        data: {
            name: product.name,
            description: null,
            price: product.salePrice,
            isActive: true,
            tenantId,
            branchId,
        },
    });

    return {
        status: "CREATED",
        id: created.id,
        name: created.name,
    };
}