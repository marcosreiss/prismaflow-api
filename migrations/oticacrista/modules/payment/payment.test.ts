import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import { convertPayments, parseCents, parseLegacyDate } from "./payment.converter";
import { loadPayments } from "./payment.loader";
import { persistPaymentsAtomically } from "./payment.persistence";

const sourceSale = (overrides: Record<string, string> = {}) => ({
    ateId: "123",
    ateDataCompra: "10-Feb-24",
    ateTotal: "100,00",
    atePago: "Pago com sucesso em dinheiro",
    ateFormaPagamento: "DINHEIRO",
    ateEntrada: "0,00",
    ...overrides,
});

const sourceInstallment = (overrides: Record<string, string> = {}) => ({
    carId: "1",
    carAtendimento: "123",
    carParcelas: "2",
    carValorParcela: "R$ 50.00",
    carVencimento: "10-Mar-24",
    carNumeroParcela: "1",
    carParcelaStatus: "Pago com sucesso",
    carDataPagamento: "09-Mar-24",
    ...overrides,
});

const mapping = (oldId: number, newId: number): MappingRow => ({
    oldId,
    newId,
    status: "CREATED",
    oldName: `Atendimento ${oldId}`,
    newName: `Sale ${newId}`,
});

const mappedSale = (overrides: Partial<{ total: number | null; branchId: string; hasPayment: boolean }> = {}) => ({
    id: 900,
    total: 100,
    branchId: "branch-1",
    hasPayment: false,
    ...overrides,
});

const convert = (
    sales: ReturnType<typeof sourceSale>[],
    installments: ReturnType<typeof sourceInstallment>[] = [],
    options: { mapping?: Map<number, MappingRow>; persisted?: Map<number, ReturnType<typeof mappedSale>> } = {},
) => convertPayments({
    sales,
    installments,
    saleMapping: options.mapping ?? new Map([[123, mapping(123, 900)]]),
    persistedSales: options.persisted ?? new Map([[900, mappedSale()]]),
    branchId: "branch-1",
});

test("loader reads the named source files, validates headers, and preserves cells", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "payment-loader-test-"));
    try {
        fs.writeFileSync(path.join(root, "atendimento.csv"), "ateId,ateDataCompra,ateTotal,atePago,ateFormaPagamento,ateEntrada\n123,10-Feb-24,100.00,ok,DINHEIRO,\n", "utf8");
        fs.writeFileSync(path.join(root, "carne.csv"), "carId,carAtendimento,carParcelas,carValorParcela,carVencimento,carNumeroParcela,carParcelaStatus,carDataPagamento\n1,123,1,100.00,10-Mar-24,1,Pago com sucesso,09-Mar-24\n", "utf8");
        const loaded = loadPayments(root);
        assert.equal(loaded.sales[0]?.ateEntrada, "");
        assert.equal(loaded.installments[0]?.carValorParcela, "100.00");
        fs.writeFileSync(path.join(root, "carne.csv"), "carId,carAtendimento\n1,123\n", "utf8");
        assert.throws(() => loadPayments(root), /Colunas obrigatórias ausentes/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("money parsing uses exact cents and legacy dates reject invalid calendar days", () => {
    assert.equal(parseCents("R$ 1,234.56"), 123_456n);
    assert.equal(parseCents("1.234,56"), 123_456n);
    assert.equal(parseCents("12..3"), null);
    assert.equal(parseLegacyDate("29-Feb-24")?.toISOString(), "2024-02-29T00:00:00.000Z");
    assert.equal(parseLegacyDate("31-Feb-24"), null);
});

test("entry only creates an independent paid MONEY method and confirms payment", () => {
    const result = convert([sourceSale({ ateTotal: "50.00", ateEntrada: "50.00", ateFormaPagamento: "", atePago: "0" })], [], {
        persisted: new Map([[900, mappedSale({ total: 50 })]]),
    });
    assert.equal(result.issues.length, 0);
    assert.equal(result.plans.length, 1);
    const payment = result.plans[0]!;
    assert.equal(payment.methods.length, 1);
    assert.equal(payment.methods[0]?.method, "MONEY");
    assert.equal(payment.methods[0]?.isEntry, true);
    assert.equal(payment.methods[0]?.installments, 1);
    assert.equal(payment.paidAmount, 50);
    assert.equal(payment.installmentsPaid, 0);
    assert.equal(payment.status, "CONFIRMED");
});

test("entry plus carné keeps methods separate and tracks confirmed and pending installments", () => {
    const result = convert(
        [sourceSale({ ateTotal: "100.00", ateEntrada: "20.00", ateFormaPagamento: "CARNÊ", atePago: "Carnê aberto" })],
        [
            sourceInstallment({ carId: "10", carParcelas: "2", carValorParcela: "40.00", carNumeroParcela: "1", carParcelaStatus: "Pago com atraso" }),
            sourceInstallment({ carId: "11", carParcelas: "2", carValorParcela: "40.00", carNumeroParcela: "2", carVencimento: "10-Apr-24", carParcelaStatus: "Vencida", carDataPagamento: "" }),
        ],
    );
    assert.equal(result.issues.length, 0);
    const payment = result.plans[0]!;
    assert.deepEqual(payment.methods.map((method) => [method.method, method.amount, method.isEntry]), [["MONEY", 20, true], ["INSTALLMENT", 80, false]]);
    assert.equal(payment.paidAmount, 60);
    assert.equal(payment.installmentsPaid, 1);
    assert.equal(payment.lastPaymentAt?.toISOString(), "2024-03-09T00:00:00.000Z");
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.methods[1]?.paidAt, null);
});

test("entry plus credit records operator installments but treats full principal as paid", () => {
    const result = convert([sourceSale({
        ateTotal: "100.00",
        ateEntrada: "10.00",
        ateFormaPagamento: "CRÉDITO",
        atePago: "Pago com sucesso no catão de crédito em 6 parcelas",
    })]);
    assert.equal(result.issues.length, 0);
    const payment = result.plans[0]!;
    assert.equal(payment.methods[0]?.method, "MONEY");
    assert.equal(payment.methods[1]?.method, "CREDIT");
    assert.equal(payment.methods[1]?.amount, 90);
    assert.equal(payment.methods[1]?.installments, 6);
    assert.equal(payment.methods[1]?.installmentItems.length, 0);
    assert.equal(payment.paidAmount, 100);
    assert.equal(payment.status, "CONFIRMED");
});

test("cash and debit principal amounts are fully received without source installments", () => {
    for (const method of ["DINHEIRO", "DÉBITO"]) {
        const result = convert([sourceSale({ ateFormaPagamento: method })]);
        assert.equal(result.issues.length, 0);
        assert.equal(result.plans[0]?.paidAmount, 100);
        assert.equal(result.plans[0]?.methods[0]?.isPaid, true);
        assert.equal(result.plans[0]?.methods[0]?.paidAt?.toISOString(), "2024-02-10T00:00:00.000Z");
    }
});

test("carné fully paid and rounded by one source cent preserves parcel values and reports warning", () => {
    const result = convert(
        [sourceSale({ ateFormaPagamento: "CARNÊ", atePago: "Carnê concluído", ateTotal: "850.00" })],
        [1, 2, 3].map((sequence) => sourceInstallment({
            carId: String(sequence),
            carParcelas: "3",
            carValorParcela: "283.33",
            carNumeroParcela: String(sequence),
            carParcelaStatus: sequence === 3 ? "Pago com atraso" : "Pago com sucesso",
            carVencimento: `${String(sequence + 9).padStart(2, "0")}-Mar-24`,
            carDataPagamento: `${String(sequence + 9).padStart(2, "0")}-Mar-24`,
        })),
        { persisted: new Map([[900, mappedSale({ total: 850 })]]) },
    );
    assert.equal(result.issues.length, 0);
    assert.equal(result.roundingWarnings.length, 1);
    const payment = result.plans[0]!;
    assert.equal(payment.methods[0]?.amount, 850);
    assert.equal(payment.methods[0]?.installmentItems.reduce((sum, item) => sum + item.amount, 0), 849.99);
    assert.equal(payment.methods[0]?.isPaid, true);
    assert.equal(payment.paidAmount, 849.99);
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.installmentsPaid, 3);
});

test("carne-concluido status confirms installment and partial schedule stays pending", () => {
    const result = convert(
        [sourceSale({ ateFormaPagamento: "CARNÊ", atePago: "Carnê aberto" })],
        [
            sourceInstallment({ carId: "1", carParcelas: "2", carValorParcela: "50.00", carNumeroParcela: "1", carParcelaStatus: "Carnê concluído" }),
            sourceInstallment({ carId: "2", carParcelas: "2", carValorParcela: "50.00", carNumeroParcela: "2", carParcelaStatus: "Aberta", carDataPagamento: "" }),
        ],
    );
    assert.equal(result.issues.length, 0);
    assert.equal(result.installmentsConfirmed, 1);
    assert.equal(result.installmentsPending, 1);
    assert.equal(result.plans[0]?.status, "PENDING");
});

test("exactly paid carné sets Payment confirmed and lastPaymentAt to the latest paid parcel", () => {
    const result = convert(
        [sourceSale({ ateFormaPagamento: "CARNÊ", atePago: "Carnê concluído" })],
        [
            sourceInstallment({ carId: "1", carParcelas: "2", carValorParcela: "50.00", carNumeroParcela: "1", carDataPagamento: "11-Mar-24" }),
            sourceInstallment({ carId: "2", carParcelas: "2", carValorParcela: "50.00", carNumeroParcela: "2", carVencimento: "10-Apr-24", carDataPagamento: "12-Apr-24", carParcelaStatus: "Pago com atraso" }),
        ],
    );
    assert.equal(result.issues.length, 0);
    assert.equal(result.plans[0]?.paidAmount, 100);
    assert.equal(result.plans[0]?.status, "CONFIRMED");
    assert.equal(result.plans[0]?.installmentsPaid, 2);
    assert.equal(result.plans[0]?.lastPaymentAt?.toISOString(), "2024-04-12T00:00:00.000Z");
});

test("preflight reports missing mappings, missing sales, existing payments, invalid totals, unknown methods and statuses", () => {
    const missingMapping = convert([sourceSale()], [], { mapping: new Map(), persisted: new Map() });
    assert.match(missingMapping.issues.flatMap((issue) => issue.reasons).join(" "), /não possui mapping/);
    const missingSale = convert([sourceSale()], [], { persisted: new Map() });
    assert.match(missingSale.issues.flatMap((issue) => issue.reasons).join(" "), /não existe no tenant/);
    const existing = convert([sourceSale()], [], { persisted: new Map([[900, mappedSale({ hasPayment: true })]]) });
    assert.match(existing.issues.flatMap((issue) => issue.reasons).join(" "), /já possui Payment/);
    const incompatible = convert([sourceSale({ ateEntrada: "110.00" })]);
    assert.match(incompatible.issues.flatMap((issue) => issue.reasons).join(" "), /supera o total/);
    const unknownMethod = convert([sourceSale({ ateFormaPagamento: "PIX" })]);
    assert.match(unknownMethod.issues.flatMap((issue) => issue.reasons).join(" "), /desconhecida ou vazia/);
    const unknownStatus = convert([sourceSale({ ateFormaPagamento: "CARNÊ" })], [sourceInstallment({ carParcelaStatus: "Em análise" })]);
    assert.match(unknownStatus.issues.flatMap((issue) => issue.reasons).join(" "), /Status de parcela desconhecido/);
});

test("preflight checks installment count, sequence, dates and amount compatibility", () => {
    const result = convert([sourceSale({ ateFormaPagamento: "CARNÊ" })], [
        sourceInstallment({ carParcelas: "3", carNumeroParcela: "1", carVencimento: "31-Feb-24" }),
        sourceInstallment({ carId: "2", carParcelas: "3", carNumeroParcela: "1", carDataPagamento: "", carParcelaStatus: "Aberta" }),
    ]);
    const errors = result.issues.flatMap((issue) => issue.reasons).join(" ");
    assert.match(errors, /declara 3 parcelas, mas possui 2 linhas/);
    assert.match(errors, /Sequência de parcela duplicada/);
    assert.match(errors, /carVencimento inválido/);
    assert.match(errors, /diverge do saldo destinado ao carnê/);
});

test("out-of-scope legacy IDs are excluded without attempting mapping or recovery", () => {
    const result = convert([
        sourceSale({ ateId: "10023", ateFormaPagamento: "UNKNOWN" }),
        sourceSale({ ateId: "10188", ateFormaPagamento: "UNKNOWN" }),
    ], [sourceInstallment({ carAtendimento: "10023" })], { mapping: new Map(), persisted: new Map() });
    assert.equal(result.excluded, 2);
    assert.equal(result.issues.length, 0);
    assert.equal(result.plans.length, 0);
});

test("global transaction commits aggregate trees or rejects the whole transaction", async (t) => {
    const plan = convert([sourceSale()]).plans;
    await t.test("commit", async () => {
        let committed = false;
        const client = {
            $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
                const tx = { payment: { create: async () => ({ id: 1 }) } };
                const result = await callback(tx);
                committed = true;
                return result;
            },
        } as unknown as Pick<PrismaClient, "$transaction">;
        const result = await persistPaymentsAtomically(client, plan, { tenantId: "tenant-1", branchId: "branch-1" });
        assert.equal(committed, true);
        assert.deepEqual(result, { createdPayments: 1, createdMethods: 1, createdInstallments: 0 });
    });
    await t.test("rollback on nested persistence error", async () => {
        let committed = false;
        const client = {
            $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
                const staged: unknown[] = [];
                const tx = { payment: { create: async (args: unknown) => { staged.push(args); throw new Error("mock nested failure"); } } };
                const result = await callback(tx);
                committed = true;
                return result;
            },
        } as unknown as Pick<PrismaClient, "$transaction">;
        await assert.rejects(() => persistPaymentsAtomically(client, plan, { tenantId: "tenant-1", branchId: "branch-1" }), /mock nested failure/);
        assert.equal(committed, false);
    });
});
