import { prisma } from "../../../src/config/prisma";
import type { BrandData } from "./brand.converter";

export interface PersistBrandResult {
    status: "CREATED" | "EXISTING";
    id: number | null;
    name: string;
}

export async function persistBrand(
    brandData: BrandData,
    dryRun: boolean
): Promise<PersistBrandResult> {
    const existingBrand = await prisma.brand.findUnique({
        where: {
            tenantId_name: {
                tenantId: brandData.tenantId,
                name: brandData.name,
            },
        },
    });

    if (existingBrand) {
        return {
            status: "EXISTING",
            id: existingBrand.id,
            name: existingBrand.name,
        };
    }

    if (dryRun) {
        return {
            status: "CREATED",
            id: null,
            name: brandData.name,
        };
    }

    const newBrand = await prisma.brand.create({
        data: brandData,
    });

    return {
        status: "CREATED",
        id: newBrand.id,
        name: newBrand.name,
    };
}