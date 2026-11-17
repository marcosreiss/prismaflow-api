import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import type { ConvertedSale } from "./sale.converter";

export async function createSaleWithItems(sale: ConvertedSale): Promise<number> {
    return prisma.$transaction(async (transaction) => {
        const createdSale = await transaction.sale.create({
            data: {
                clientId: sale.clientId,
                saleDate: sale.saleDate,
                subtotal: sale.subtotal,
                discount: sale.discount,
                total: sale.total,
                notes: sale.notes,
                isActive: true,
                tenantId: migrationConfig.tenantId,
                branchId: migrationConfig.branchId,
                createdById: null,
                updatedById: null,
            },
        });

        if (sale.items.length > 0) {
            await transaction.itemProduct.createMany({
                data: sale.items.map((item) => ({
                    saleId: createdSale.id,
                    productId: item.productId,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    tenantId: migrationConfig.tenantId,
                    branchId: migrationConfig.branchId,
                    createdById: null,
                    updatedById: null,
                })),
            });
        }

        return createdSale.id;
    });
}
