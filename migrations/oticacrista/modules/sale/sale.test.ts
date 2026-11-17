import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import { convertSale, MYSQL_TEXT_MAX_BYTES, parseCents, textUtf8Bytes } from "./sale.converter";
import { loadSales, type OldSale, type OldSaleItem } from "./sale.loader";
import { prepareSaleMigration } from "./sale.preflight";
import { persistSalesAtomically } from "./sale.persistence";
import { createSaleReport } from "./sale.report";

const oldSale = (overrides: Partial<OldSale> = {}): OldSale => ({
    ateId: "100",
    ateColaborador: "2",
    ateCliente: "1",
    ateDataCompra: "10-Feb-15",
    ateTotal: "10.00",
    ...overrides,
});

const oldItem = (overrides: Partial<OldSaleItem> = {}): OldSaleItem => ({
    itemAtendimento: "100",
    itemProduto: "7",
    itemQtd: "1",
    itemTotalParcial: "12.00",
    itemDesc: "",
    itemTotalGeral: "12.00",
    itemObs: "RX",
    ...overrides,
});

const mapping = (oldId: number, newId: number, oldName = "Produto"): MappingRow => ({
    oldId,
    newId,
    status: "CREATED",
    oldName,
    newName: oldName,
});

const clients = new Map([[1, mapping(1, 101, "Cliente")]]);
const products = new Map([[7, mapping(7, 701, "Produto")]]);

test("CSV loader validates headers and preserves itemObs exactly", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-loader-test-"));
    try {
        fs.writeFileSync(path.join(root, "atendimento.csv"), "ateId,ateCliente,ateDataCompra,ateTotal\n1,2,10-Feb-15,10.00\n", "utf8");
        fs.writeFileSync(path.join(root, "itensAtendimento.csv"), "itemAtendimento,itemProduto,itemQtd,itemTotalParcial,itemObs\n1,7,1,12.00,  nota original  \n", "utf8");
        const loaded = loadSales(root);
        assert.equal(loaded.sales.length, 1);
        assert.equal(loaded.items[0].itemObs, "  nota original  ");
        fs.writeFileSync(path.join(root, "itensAtendimento.csv"), "itemAtendimento,itemProduto,itemQtd\n1,7,1\n", "utf8");
        assert.throws(() => loadSales(root), /Colunas obrigatórias ausentes/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("parseCents handles comma and dot decimal formats without float arithmetic", () => {
    assert.equal(parseCents("960,00"), 96_000n);
    assert.equal(parseCents("1.234,56"), 123_456n);
    assert.equal(parseCents("700.00"), 70_000n);
    assert.equal(parseCents("12..3"), null);
    assert.equal(textUtf8Bytes("😀"), 4);
});

test("notes at the MySQL TEXT byte limit pass, and one byte over blocks", () => {
    const prefix = "Produto (ID legado 7): ";
    const exactObservation = "a".repeat(MYSQL_TEXT_MAX_BYTES - textUtf8Bytes(prefix));
    const exact = convertSale(oldSale(), [oldItem({ itemObs: exactObservation })], mapping(1, 101), products);
    assert.ok(exact.sale);
    assert.equal(textUtf8Bytes(exact.sale.notes ?? ""), MYSQL_TEXT_MAX_BYTES);

    const tooLong = convertSale(oldSale(), [oldItem({ itemObs: `${exactObservation}a` })], mapping(1, 101), products);
    assert.equal(tooLong.sale, null);
    assert.match(tooLong.issues.join(" "), /excede o limite de MySQL TEXT/);

    const multibyteObservation = "😀".repeat(Math.ceil((MYSQL_TEXT_MAX_BYTES - textUtf8Bytes(prefix)) / 4));
    const multibyte = convertSale(oldSale(), [oldItem({ itemObs: multibyteObservation })], mapping(1, 101), products);
    assert.ok(multibyte.sale);
    assert.equal(textUtf8Bytes(multibyte.sale.notes ?? ""), MYSQL_TEXT_MAX_BYTES);
    const multibyteTooLong = convertSale(oldSale(), [oldItem({ itemObs: `${multibyteObservation}a` })], mapping(1, 101), products);
    assert.equal(multibyteTooLong.sale, null);
    assert.match(multibyteTooLong.issues.join(" "), /excede o limite de MySQL TEXT/);
});

test("notes preserve blank and repeated item observations in source order", () => {
    const converted = convertSale(oldSale({ ateTotal: "30.00" }), [
        oldItem({ itemObs: "" }),
        oldItem({ itemObs: "RX repetido" }),
        oldItem({ itemObs: "RX repetido" }),
    ], mapping(1, 101), products);
    assert.ok(converted.sale);
    const lines = converted.sale.notes?.split("\n") ?? [];
    assert.equal(lines.length, 3);
    assert.match(lines[0], /ID legado 7\): $/);
    assert.equal(lines[1], lines[2]);
});

test("preflight blocks missing customer/product mappings, orphan items, duplicate IDs, and negative discount", () => {
    const result = prepareSaleMigration({
        sales: [
            oldSale({ ateId: "100", ateCliente: "999" }),
            oldSale({ ateId: "200", ateTotal: "15.00" }),
            oldSale({ ateId: "300" }),
            oldSale({ ateId: "300" }),
        ],
        items: [
            oldItem({ itemAtendimento: "100", itemProduto: "999" }),
            oldItem({ itemAtendimento: "9999" }),
        ],
        clients,
        products,
        tenantId: "tenant",
        branchId: "branch",
    });
    assert.equal(result.salesPending, 4);
    assert.equal(result.itemsWithoutSale, 1);
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Cliente legado 999 sem correspondência/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Produto legado 999 sem correspondência/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /desconto seria negativo/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /ID legado de atendimento duplicado/.test(reason))));
});

test("preflight rejects invalid dates, quantities, and oversized tenant/branch identifiers", () => {
    const result = prepareSaleMigration({
        sales: [oldSale({ ateDataCompra: "31-Feb-20" })],
        items: [oldItem({ itemQtd: "0" })],
        clients,
        products,
        tenantId: "t".repeat(192),
        branchId: "branch",
    });
    assert.equal(result.salesEligible, 0);
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Data da venda inválida/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Quantidade inválida/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.kind === "CONFIGURATION"));
});

test("preflight blocks mapping targets absent from the tenant and an invalid branch", () => {
    const result = prepareSaleMigration({
        sales: [oldSale()],
        items: [oldItem()],
        clients,
        products,
        knownClientIds: new Set(),
        knownProductIds: new Set(),
        branchExists: false,
        tenantId: "tenant",
        branchId: "branch",
    });
    assert.equal(result.salesEligible, 0);
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /não pertence ao tenantId/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Cliente de produção 101/.test(reason))));
    assert.ok(result.issues.some((issue) => issue.reasons.some((reason) => /Produto de produção 701/.test(reason))));
});

test("DRY_RUN and real mode share the same preflight result", () => {
    const input = {
        sales: [oldSale()],
        items: [oldItem()],
        clients,
        products,
        tenantId: "tenant",
        branchId: "branch",
    };
    const dryRunPreflight = prepareSaleMigration(input);
    const realRunPreflight = prepareSaleMigration(input);
    assert.deepEqual(dryRunPreflight, realRunPreflight);
    assert.equal(dryRunPreflight.salesEligible, 1);
    assert.equal(dryRunPreflight.itemsEligible, 1);
});

function transactionMock(failAt: "sale" | "item" | null = null) {
    const committed = { sales: [] as unknown[], items: [] as unknown[] };
    let nextId = 1000;
    let saleCalls = 0;
    const client = {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
            const staged = { sales: [] as unknown[], items: [] as unknown[] };
            const tx = {
                sale: {
                    create: async ({ data }: { data: unknown }) => {
                        saleCalls++;
                        if (failAt === "sale" && saleCalls === 2) throw new Error("mock sale failure");
                        staged.sales.push(data);
                        return { id: nextId++ };
                    },
                },
                itemProduct: {
                    createMany: async ({ data }: { data: unknown[] }) => {
                        if (failAt === "item") throw new Error("mock item failure");
                        staged.items.push(...data);
                        return { count: data.length };
                    },
                },
            };
            const result = await callback(tx);
            committed.sales.push(...staged.sales);
            committed.items.push(...staged.items);
            return result;
        },
    };
    return { client: client as unknown as PrismaClient, committed };
}

const prepared = () => prepareSaleMigration({
    sales: [oldSale()],
    items: [oldItem()],
    clients,
    products,
    tenantId: "tenant",
    branchId: "branch",
}).plans;

test("global transaction commits sales and items together and returns generated mapping IDs", async () => {
    const mock = transactionMock();
    const entries: Array<{ oldId: number; newId: number }> = [];
    const result = await persistSalesAtomically(mock.client, prepared(), { tenantId: "tenant", branchId: "branch" }, (entry) => {
        entries.push({ oldId: entry.oldId, newId: entry.newId });
    });
    assert.deepEqual(result, { createdSales: 1, createdItems: 1 });
    assert.equal(mock.committed.sales.length, 1);
    assert.equal(mock.committed.items.length, 1);
    assert.deepEqual(entries, [{ oldId: 100, newId: 1000 }]);
});

test("sale or item persistence failures reject the global transaction without committed rows", async (t) => {
    for (const failAt of ["sale", "item"] as const) {
        await t.test(`failure at ${failAt}`, async () => {
            const mock = transactionMock(failAt);
            const plans = failAt === "sale"
                ? [...prepared(), ...prepareSaleMigration({
                    sales: [oldSale({ ateId: "101" })],
                    items: [oldItem({ itemAtendimento: "101" })],
                    clients,
                    products,
                    tenantId: "tenant",
                    branchId: "branch",
                }).plans]
                : prepared();
            await assert.rejects(
                persistSalesAtomically(mock.client, plans, { tenantId: "tenant", branchId: "branch" }, () => undefined),
                new RegExp(`mock ${failAt} failure`),
            );
            assert.deepEqual(mock.committed, { sales: [], items: [] });
        });
    }
});

test("a mapping append failure aborts the global transaction", async () => {
    const mock = transactionMock();
    await assert.rejects(
        persistSalesAtomically(mock.client, prepared(), { tenantId: "tenant", branchId: "branch" }, () => {
            throw new Error("mapping write failed");
        }),
        /mapping write failed/,
    );
    assert.deepEqual(mock.committed, { sales: [], items: [] });
});

test("committed temporary mapping can be recovered without rerunning persistence", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-test-"));
    try {
        const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir: path.join(root, "mappings") });
        report.startMapping("run-test", 1);
        report.appendMapping({ oldId: 100, newId: 200, oldName: "Atendimento 100", newName: "Sale 200" });
        report.markCommitted();

        const result = await report.recoverPendingMapping();
        assert.equal(result.status, "RECOVERED");
        assert.match(fs.readFileSync(report.mappingPath, "utf8"), /100,200,CREATED/);
        assert.equal(fs.existsSync(report.temporaryPath), false);
        assert.equal(fs.existsSync(report.recoveryManifestPath), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("an interrupted commit window is reconciled by checking mapped sale IDs", async (t) => {
    await t.test("all generated IDs exist, so publish the complete mapping", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-commit-window-"));
        try {
            const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir: path.join(root, "mappings") });
            report.startMapping("run-committed", 1);
            report.appendMapping({ oldId: 100, newId: 200, oldName: "Atendimento 100", newName: "Sale 200" });
            const result = await report.recoverPendingMapping(async (ids) => new Set(ids));
            assert.equal(result.status, "RECOVERED");
            assert.match(fs.readFileSync(report.mappingPath, "utf8"), /100,200,CREATED/);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    await t.test("no generated IDs exist, so discard the rolled-back temporary mapping", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-rollback-window-"));
        try {
            const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir: path.join(root, "mappings") });
            report.startMapping("run-rolled-back", 1);
            const result = await report.recoverPendingMapping(async () => new Set());
            assert.equal(result.status, "NONE");
            assert.equal(fs.existsSync(report.temporaryPath), false);
            assert.equal(fs.existsSync(report.recoveryManifestPath), false);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    await t.test("partial existence blocks for manual reconciliation", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-partial-window-"));
        try {
            const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir: path.join(root, "mappings") });
            report.startMapping("run-partial", 2);
            report.appendMapping({ oldId: 100, newId: 200, oldName: "Atendimento 100", newName: "Sale 200" });
            report.appendMapping({ oldId: 101, newId: 201, oldName: "Atendimento 101", newName: "Sale 201" });
            const result = await report.recoverPendingMapping(async () => new Set([200]));
            assert.equal(result.status, "BLOCKED");
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

test("failed mapping publication leaves a recoverable manifest and blocks rerun", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-failure-"));
    try {
        const mappingsDir = path.join(root, "mappings");
        const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir });
        fs.mkdirSync(mappingsDir, { recursive: true });
        report.startMapping("run-test", 1);
        report.appendMapping({ oldId: 100, newId: 200, oldName: "Atendimento 100", newName: "Sale 200" });
        report.markCommitted();
        fs.mkdirSync(report.mappingPath);
        assert.throws(() => report.finalizeMapping());
        assert.equal(fs.existsSync(report.temporaryPath), true);

        fs.rmSync(report.mappingPath, { recursive: true, force: true });
        const recovered = await report.recoverPendingMapping();
        assert.equal(recovered.status, "RECOVERED");
        assert.match(fs.readFileSync(report.mappingPath, "utf8"), /100,200,CREATED/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a finalized sale mapping blocks a second run that could duplicate sales", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sale-mapping-no-rerun-"));
    try {
        const report = createSaleReport({ reportsDir: path.join(root, "reports"), mappingsDir: path.join(root, "mappings") });
        report.startMapping("run-complete", 1);
        report.appendMapping({ oldId: 100, newId: 200, oldName: "", newName: "" });
        report.markCommitted();
        report.finalizeMapping();
        const result = await report.recoverPendingMapping();
        assert.equal(result.status, "BLOCKED");
        assert.match(result.reason ?? "", /evitar duplicatas/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
