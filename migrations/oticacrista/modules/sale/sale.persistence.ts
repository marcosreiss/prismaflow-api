import type { PrismaClient } from "@prisma/client";
import type { PreparedSale } from "./sale.preflight";

export interface SaleMappingEntry {
    oldId: number;
    newId: number;
    oldName: string | null;
    newName: string | null;
}

export interface SaleTransactionResult {
    createdSales: number;
    createdItems: number;
}

export interface MappingTargetValidation {
    clientIds: Set<number>;
    productIds: Set<number>;
    branchExists: boolean;
}

export async function validateMappingTargets(
    client: Pick<PrismaClient, "client" | "product" | "branch">,
    tenantId: string,
    branchId: string,
    clientIds: number[],
    productIds: number[],
): Promise<MappingTargetValidation> {
    const [clients, products, branch] = await Promise.all([
        clientIds.length
            ? client.client.findMany({ where: { tenantId, id: { in: [...new Set(clientIds)] } }, select: { id: true } })
            : Promise.resolve([]),
        productIds.length
            ? client.product.findMany({ where: { tenantId, id: { in: [...new Set(productIds)] } }, select: { id: true } })
            : Promise.resolve([]),
        client.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true } }),
    ]);
    return {
        clientIds: new Set(clients.map(({ id }) => id)),
        productIds: new Set(products.map(({ id }) => id)),
        branchExists: branch !== null,
    };
}

export async function findPersistedSaleIds(
    client: Pick<PrismaClient, "sale">,
    tenantId: string,
    saleIds: number[],
): Promise<Set<number>> {
    if (saleIds.length === 0) return new Set();
    const rows = await client.sale.findMany({
        where: { tenantId, id: { in: saleIds } },
        select: { id: true },
    });
    return new Set(rows.map(({ id }) => id));
}

export async function persistSalesAtomically(
    client: Pick<PrismaClient, "$transaction">,
    plans: PreparedSale[],
    context: { tenantId: string; branchId: string },
    appendMapping: (entry: SaleMappingEntry) => void,
): Promise<SaleTransactionResult> {
    return client.$transaction(async (transaction) => {
        const itemRows: Array<{
            saleId: number;
            productId: number;
            unitPrice: number;
            quantity: number;
            tenantId: string;
            branchId: string;
            createdById: null;
            updatedById: null;
        }> = [];

        for (const plan of plans) {
            const sale = await transaction.sale.create({
                data: {
                    clientId: plan.converted.clientId,
                    saleDate: plan.converted.saleDate,
                    subtotal: plan.converted.subtotal,
                    discount: plan.converted.discount,
                    total: plan.converted.total,
                    notes: plan.converted.notes,
                    isActive: true,
                    tenantId: context.tenantId,
                    branchId: context.branchId,
                    createdById: null,
                    updatedById: null,
                },
            });

            appendMapping({
                oldId: plan.legacyId,
                newId: sale.id,
                oldName: null,
                newName: null,
            });

            for (const item of plan.converted.items) {
                itemRows.push({
                    saleId: sale.id,
                    productId: item.productId,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    tenantId: context.tenantId,
                    branchId: context.branchId,
                    createdById: null,
                    updatedById: null,
                });
            }
        }

        if (itemRows.length > 0) {
            const result = await transaction.itemProduct.createMany({ data: itemRows });
            if (result.count !== itemRows.length) {
                throw new Error(`Persistidos ${result.count} de ${itemRows.length} itens; transação cancelada.`);
            }
        }

        return { createdSales: plans.length, createdItems: itemRows.length };
    }, {
        maxWait: 10_000,
        // 2,094 atendimento rows require sequential generated IDs plus one batched item insert.
        timeout: 300_000,
    });
}
