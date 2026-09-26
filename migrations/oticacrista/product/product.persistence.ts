// migrations/oticacrista/product/product.persistence.ts

import { prisma } from "../../../src/config/prisma";
import type { ConvertedProduct } from "./product.converter";
import type { ResolvedBrand } from "./product.matcher";

export interface PersistResult {
    status: "CREATED" | "EXISTING";
    id: number | null;
    name: string;
    category: string;
}

/**
 * Verifica se o produto já existe (tenantId + name + brandId).
 * Não cria nada — usado para decidir se vale a pena perguntar
 * a categoria manualmente antes de criar.
 */
export async function findExistingProduct(
    product: ConvertedProduct,
    brand: ResolvedBrand,
    tenantId: string,
): Promise<PersistResult | null> {
    const existing = await prisma.product.findFirst({
        where: {
            tenantId,
            name: product.name,
            brandId: brand.brandNewId,
        },
    });

    if (!existing) {
        return null;
    }

    return {
        status: "EXISTING",
        id: existing.id,
        name: existing.name,
        category: existing.category,
    };
}

/**
 * Cria o produto. Só deve ser chamado depois de confirmado que
 * o produto não existe (ver findExistingProduct) e que a categoria
 * já foi resolvida (automática ou manual).
 */
export async function createProduct(
    product: ConvertedProduct,
    brand: ResolvedBrand,
    category: "FRAME" | "LENS" | "ACCESSORY",
    tenantId: string,
    dryRun: boolean,
): Promise<PersistResult> {
    if (dryRun) {
        return {
            status: "CREATED",
            id: null,
            name: product.name,
            category,
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
        category,
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
            category: ""
        };
    }

    if (dryRun) {
        return {
            status: "CREATED",
            id: null,
            name: product.name,
            category: ""
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
        category: ""
    };
}