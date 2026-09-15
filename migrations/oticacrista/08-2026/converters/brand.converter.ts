// transformação do modelo antigo para o novo
import { OldBrand } from "../loaders/brand.loader";

export interface BrandData {
    name: string;
    tenantId: string;
    isActive: boolean;
    createdById: null;
    updatedById: null;
}

export function convertBrand(
    oldBrand: OldBrand,
    tenantId: string
): BrandData {
    return {
        name: oldBrand.marcaNome.trim(),
        tenantId,
        isActive: true,
        createdById: null,
        updatedById: null,
    };
}