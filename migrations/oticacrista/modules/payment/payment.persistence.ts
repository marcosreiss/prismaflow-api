import type { Prisma, PrismaClient } from "@prisma/client";
import type { ConvertedPayment, PersistedSaleSnapshot } from "./payment.converter";

type PaymentLookupClient = Pick<PrismaClient, "sale">;
type PaymentTransactionClient = Pick<PrismaClient, "$transaction">;

export async function findPaymentSaleSnapshots(
    client: PaymentLookupClient,
    tenantId: string,
    saleIds: number[],
): Promise<Map<number, PersistedSaleSnapshot>> {
    if (saleIds.length === 0) return new Map();
    const rows = await client.sale.findMany({
        where: { tenantId, id: { in: saleIds } },
        select: { id: true, total: true, branchId: true, payment: { select: { id: true } } },
    });
    return new Map(rows.map((row) => [row.id, {
        id: row.id,
        total: row.total,
        branchId: row.branchId,
        hasPayment: row.payment !== null,
    }]));
}

export interface PaymentPersistenceResult {
    createdPayments: number;
    createdMethods: number;
    createdInstallments: number;
}

export async function persistPaymentsAtomically(
    client: PaymentTransactionClient,
    plans: ConvertedPayment[],
    context: { tenantId: string; branchId: string },
): Promise<PaymentPersistenceResult> {
    return client.$transaction(async (transaction: Prisma.TransactionClient) => {
        let createdMethods = 0;
        let createdInstallments = 0;
        for (const plan of plans) {
            await transaction.payment.create({
                data: {
                    saleId: plan.saleId,
                    status: plan.status,
                    subtotal: plan.subtotal,
                    discount: plan.discount,
                    total: plan.total,
                    paidAmount: plan.paidAmount,
                    installmentsPaid: plan.installmentsPaid,
                    lastPaymentAt: plan.lastPaymentAt,
                    tenantId: context.tenantId,
                    branchId: context.branchId,
                    methods: {
                        create: plan.methods.map((method) => {
                            createdMethods++;
                            createdInstallments += method.installmentItems.length;
                            return {
                                method: method.method,
                                amount: method.amount,
                                installments: method.installments,
                                firstDueDate: method.firstDueDate,
                                isPaid: method.isPaid,
                                paidAt: method.paidAt,
                                tenantId: context.tenantId,
                                branchId: context.branchId,
                                ...(method.installmentItems.length > 0 ? {
                                    installmentItems: {
                                        create: method.installmentItems.map((installment) => ({
                                            sequence: installment.sequence,
                                            amount: installment.amount,
                                            paidAmount: installment.paidAmount,
                                            dueDate: installment.dueDate,
                                            paidAt: installment.paidAt,
                                            tenantId: context.tenantId,
                                            branchId: context.branchId,
                                        })),
                                    },
                                } : {}),
                            };
                        }),
                    },
                },
            });
        }
        return { createdPayments: plans.length, createdMethods, createdInstallments };
    }, {
        maxWait: 10_000,
        // Dataset contains about 2,094 payment aggregates and 3,917 installments.
        timeout: 900_000,
    });
}
