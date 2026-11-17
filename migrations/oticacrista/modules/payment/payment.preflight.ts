import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import type { OldInstallment, OldPaymentSale } from "./payment.loader";
import { convertPayments, type PaymentConversionResult, type PersistedSaleSnapshot } from "./payment.converter";

export interface PaymentPreflight extends PaymentConversionResult {
    salesAnalyzed: number;
    methodsByType: Record<string, number>;
    totalAmount: number;
    paidAmount: number;
    openAmount: number;
}

export function preparePaymentMigration(args: {
    sales: OldPaymentSale[];
    installments: OldInstallment[];
    saleMapping: Map<number, MappingRow>;
    persistedSales: Map<number, PersistedSaleSnapshot>;
    branchId: string;
}): PaymentPreflight {
    const conversion = convertPayments(args);
    const methodsByType: Record<string, number> = {};
    let totalCents = 0n;
    let paidCents = 0n;
    for (const plan of conversion.plans) {
        totalCents += BigInt(Math.round(plan.total * 100));
        paidCents += BigInt(Math.round(plan.paidAmount * 100));
        for (const method of plan.methods) methodsByType[method.method] = (methodsByType[method.method] ?? 0) + 1;
    }
    return {
        ...conversion,
        salesAnalyzed: args.sales.length,
        methodsByType,
        totalAmount: Number(totalCents) / 100,
        paidAmount: Number(paidCents) / 100,
        openAmount: Number(totalCents - paidCents) / 100,
    };
}
