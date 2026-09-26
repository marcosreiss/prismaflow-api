// migrations/oticacrista/08-2026/04-sale.ts

import fs from "node:fs";
import path from "node:path";

import {
    PaymentMethod,
    PaymentStatus,
    PrismaClient,
} from "@prisma/client";

import {
    loadAtendimentoSources,
} from "./loaders/atendimento.loader";

import {
    convertSale,
    isCarnePayment,
} from "./converters/sale.converter";

const prisma = new PrismaClient();

const BASE_DIR =
    path.resolve(__dirname);

const REPORTS_DIR =
    path.join(BASE_DIR, "reports");

const LOGS_DIR =
    path.join(REPORTS_DIR, "logs");

const ERRORS_DIR =
    path.join(REPORTS_DIR, "errors");

const EXECUTIONS_DIR =
    path.join(REPORTS_DIR, "executions");

const MAPPINGS_DIR =
    path.join(REPORTS_DIR, "mappings");

const MAPPING_PATH =
    path.join(
        MAPPINGS_DIR,
        "04-sale-mapping.csv",
    );

const TEMP_MAPPING_PATH =
    `${MAPPING_PATH}.tmp`;

const TENANT_ID =
    "cmibvcyed00007m0118rkgft8";

const BRANCH_ID =
    "cmibvcyed00017m014r66e39w";

const DRY_RUN = true;

const MONEY_TOLERANCE = 0.5;

interface MappingRecord {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
}

interface PendingRecord {
    oldId: number;
    reason: string;
    details?: unknown;
}

interface ErrorRecord {
    oldId: number | null;
    message: string;
    stack?: string;
}

interface ProductMapping {
    oldId: number;
    newId: number;
    status: string;
}

interface ServiceMapping {
    oldId: number;
    newId: number;
    status: string;
}

function ensureDirectories(): void {
    [
        REPORTS_DIR,
        LOGS_DIR,
        ERRORS_DIR,
        EXECUTIONS_DIR,
        MAPPINGS_DIR,
    ].forEach((directory) => {
        fs.mkdirSync(directory, {
            recursive: true,
        });
    });
}

function nowForFileName(): string {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

function writeLog(
    message: string,
): void {
    ensureDirectories();

    const date =
        new Date()
            .toISOString()
            .slice(0, 10);

    const filePath =
        path.join(
            LOGS_DIR,
            `04-sale-${date}.log`,
        );

    fs.appendFileSync(
        filePath,
        `[${new Date().toISOString()}] ${message}\n`,
        "utf8",
    );
}

function nearlyEqual(
    a: number,
    b: number,
): boolean {
    return (
        Math.abs(a - b) <=
        MONEY_TOLERANCE
    );
}

function readMappingFile<T>(
    filePath: string,
): T[] {
    if (!fs.existsSync(filePath)) {
        return [];
    }

    const lines =
        fs
            .readFileSync(
                filePath,
                "utf8",
            )
            .split(/\r?\n/)
            .filter(Boolean);

    if (lines.length <= 1) {
        return [];
    }

    return lines
        .slice(1)
        .map((line) => {
            const fields =
                line.split(",");

            return {
                oldId: Number(fields[0]),
                newId: Number(fields[1]),
                status: fields[2],
            } as T;
        })
        .filter(
            (record) =>
                Number.isFinite(
                    (record as { oldId: number })
                        .oldId,
                ),
        );
}

function createTempMapping(): void {
    ensureDirectories();

    fs.writeFileSync(
        TEMP_MAPPING_PATH,
        "old_id,new_id,status\n",
        "utf8",
    );
}

function appendMapping(
    mapping: MappingRecord,
): void {
    fs.appendFileSync(
        TEMP_MAPPING_PATH,
        `${mapping.oldId},${mapping.newId ?? ""},${mapping.status}\n`,
        "utf8",
    );
}

function finalizeMapping(): void {
    if (
        fs.existsSync(
            MAPPING_PATH,
        )
    ) {
        fs.unlinkSync(
            MAPPING_PATH,
        );
    }

    fs.renameSync(
        TEMP_MAPPING_PATH,
        MAPPING_PATH,
    );
}

function discardTempMapping(): void {
    if (
        fs.existsSync(
            TEMP_MAPPING_PATH,
        )
    ) {
        fs.unlinkSync(
            TEMP_MAPPING_PATH,
        );
    }
}

function mapPaymentMethod(
    legacyMethod: string | null,
): PaymentMethod | null {
    const method =
        (
            legacyMethod ?? ""
        ).trim().toUpperCase();

    switch (method) {
        case "DINHEIRO":
        case "MONEY":
            return PaymentMethod.MONEY;

        case "DÉBITO":
        case "DEBIT":
            return PaymentMethod.DEBIT;

        case "CRÉDITO":
        case "CREDITO":
        case "CREDIT":
            return PaymentMethod.CREDIT;

        case "CARNÊ":
        case "CARNE":
        case "CARNET":
            return PaymentMethod.INSTALLMENT;

        case "PIX":
            return PaymentMethod.PIX;

        default:
            return null;
    }
}

function calculatePaymentStatus(
    paidAmount: number,
    total: number,
): PaymentStatus {
    if (
        nearlyEqual(
            paidAmount,
            total,
        ) ||
        paidAmount > total
    ) {
        return PaymentStatus.CONFIRMED;
    }

    return PaymentStatus.PENDING;
}

function loadProductMappings(): ProductMapping[] {
    return readMappingFile<ProductMapping>(
        path.join(
            MAPPINGS_DIR,
            "02-product-mapping.csv",
        ),
    );
}

function loadServiceMappings(): ServiceMapping[] {
    return readMappingFile<ServiceMapping>(
        path.join(
            MAPPINGS_DIR,
            "02-service-mapping.csv",
        ),
    );
}

function resolveClientId(
    oldClientId: number,
): number | null {
    const mappings =
        readMappingFile<{
            oldId: number;
            newId: number;
            status: string;
        }>(
            path.join(
                MAPPINGS_DIR,
                "03-client-mapping.csv",
            ),
        );

    const mapping =
        mappings.find(
            (item) =>
                item.oldId === oldClientId,
        );

    return mapping?.newId ?? null;
}

function resolveProductId(
    oldProductId: number,
    mappings: ProductMapping[],
): number | null {
    const mapping =
        mappings.find(
            (item) =>
                item.oldId === oldProductId,
        );

    return mapping?.newId ?? null;
}

function resolveServiceId(
    oldProductId: number,
    mappings: ServiceMapping[],
): number | null {
    const mapping =
        mappings.find(
            (item) =>
                item.oldId === oldProductId,
        );

    return mapping?.newId ?? null;
}

function writePendingReport(
    records: PendingRecord[],
): void {
    fs.writeFileSync(
        path.join(
            ERRORS_DIR,
            `04-sale-pending-${nowForFileName()}.json`,
        ),
        JSON.stringify(
            records,
            null,
            2,
        ),
        "utf8",
    );
}

function writeErrorReport(
    records: ErrorRecord[],
): void {
    fs.writeFileSync(
        path.join(
            ERRORS_DIR,
            `04-sale-errors-${nowForFileName()}.json`,
        ),
        JSON.stringify(
            records,
            null,
            2,
        ),
        "utf8",
    );
}

function writeExecutionReport(
    data: Record<string, unknown>,
): void {
    fs.writeFileSync(
        path.join(
            EXECUTIONS_DIR,
            `04-sale-${nowForFileName()}.json`,
        ),
        JSON.stringify(
            data,
            null,
            2,
        ),
        "utf8",
    );
}

async function main(): Promise<void> {
    ensureDirectories();

    writeLog(
        `Iniciando migration 04-sale | DRY_RUN=${DRY_RUN}`,
    );

    const sources =
        loadAtendimentoSources();

    const productMappings =
        loadProductMappings();

    const serviceMappings =
        loadServiceMappings();

    const pending: PendingRecord[] = [];
    const errors: ErrorRecord[] = [];

    let created = 0;
    let existing = 0;

    let totalItems = 0;
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalSales = 0;
    let totalPaid = 0;

    let financialInconsistencies = 0;

    createTempMapping();

    try {
        for (const source of sources) {
            const sale =
                convertSale(source);

            try {
                /*
                 * ---------------------------------------------------------
                 * 1. VALIDAÇÕES BÁSICAS
                 * ---------------------------------------------------------
                 */

                if (!sale.oldId) {
                    pending.push({
                        oldId: 0,
                        reason:
                            "VENDA_SEM_ID",
                    });

                    continue;
                }

                if (!sale.oldClientId) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "VENDA_SEM_CLIENTE",
                    });

                    continue;
                }

                const clientId =
                    resolveClientId(
                        sale.oldClientId,
                    );

                if (!clientId) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "CLIENTE_NAO_MIGRADO",
                        details: {
                            oldClientId:
                                sale.oldClientId,
                        },
                    });

                    continue;
                }

                /*
                 * ---------------------------------------------------------
                 * 2. VALIDAÇÃO DOS ITENS
                 * ---------------------------------------------------------
                 */

                if (sale.items.length === 0) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "VENDA_SEM_ITENS",
                    });

                    continue;
                }

                const unresolvedProducts =
                    sale.items.filter(
                        (item) => {
                            const productId =
                                resolveProductId(
                                    item.oldProductId,
                                    productMappings,
                                );

                            const serviceId =
                                resolveServiceId(
                                    item.oldProductId,
                                    serviceMappings,
                                );

                            return (
                                !productId &&
                                !serviceId
                            );
                        },
                    );

                if (
                    unresolvedProducts.length > 0
                ) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "ITEM_SEM_MAPPING",
                        details: {
                            products:
                                unresolvedProducts,
                        },
                    });

                    continue;
                }

                /*
                 * ---------------------------------------------------------
                 * 3. VALIDAÇÃO FINANCEIRA DA SALE
                 * ---------------------------------------------------------
                 */

                const calculatedTotal =
                    sale.total;

                if (
                    !nearlyEqual(
                        calculatedTotal,
                        sale.legacyTotal,
                    )
                ) {
                    financialInconsistencies++;

                    writeLog(
                        `INCONSISTÊNCIA FINANCEIRA ` +
                        `venda=${sale.oldId} ` +
                        `calculado=${calculatedTotal.toFixed(2)} ` +
                        `ateTotal=${sale.legacyTotal.toFixed(2)}`,
                    );
                }

                if (
                    !nearlyEqual(
                        calculatedTotal,
                        sale.legacyItemsTotal,
                    )
                ) {
                    financialInconsistencies++;

                    writeLog(
                        `INCONSISTÊNCIA NOS ITENS ` +
                        `venda=${sale.oldId} ` +
                        `calculado=${calculatedTotal.toFixed(2)} ` +
                        `itemTotalGeral=${sale.legacyItemsTotal.toFixed(2)}`,
                    );
                }

                /*
                 * ---------------------------------------------------------
                 * 4. EXISTÊNCIA
                 * ---------------------------------------------------------
                 *
                 * Sale não possui legacyId no schema atual.
                 *
                 * Portanto usamos uma combinação conservadora:
                 *
                 * clientId + saleDate + total + tenant + branch
                 *
                 * Se houver mais de uma candidata, não escolhemos
                 * arbitrariamente: a venda fica PENDING.
                 */

                const candidates =
                    await prisma.sale.findMany({
                        where: {
                            tenantId:
                                TENANT_ID,
                            branchId:
                                BRANCH_ID,
                            clientId,
                            saleDate:
                                sale.saleDate,
                            total: {
                                gte:
                                    sale.total -
                                    MONEY_TOLERANCE,
                                lte:
                                    sale.total +
                                    MONEY_TOLERANCE,
                            },
                        },
                        select: {
                            id: true,
                        },
                    });

                if (candidates.length > 1) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "MULTIPLAS_SALES_CANDIDATAS",
                        details: {
                            candidates,
                            clientId,
                            saleDate:
                                sale.saleDate,
                            total:
                                sale.total,
                        },
                    });

                    continue;
                }

                if (candidates.length === 1) {
                    const newId =
                        candidates[0].id;

                    existing++;

                    appendMapping({
                        oldId: sale.oldId,
                        newId,
                        status: "EXISTING",
                    });

                    continue;
                }

                /*
                 * ---------------------------------------------------------
                 * 5. DRY RUN
                 * ---------------------------------------------------------
                 */

                if (DRY_RUN) {
                    created++;

                    appendMapping({
                        oldId: sale.oldId,
                        newId: null,
                        status: "CREATED",
                    });

                    totalItems +=
                        sale.items.length;

                    totalSubtotal +=
                        sale.subtotal;

                    totalDiscount +=
                        sale.discount;

                    totalSales +=
                        sale.total;

                    totalPaid +=
                        sale.paidAmount;

                    continue;
                }

                /*
                 * ---------------------------------------------------------
                 * 6. PERSISTÊNCIA
                 * ---------------------------------------------------------
                 *
                 * Sale + Items + Payment + Methods +
                 * Installments são criados dentro da mesma
                 * transação.
                 */

                const createdSale =
                    await prisma.$transaction(
                        async (tx) => {
                            const createdSale =
                                await tx.sale.create({
                                    data: {
                                        clientId,

                                        saleDate:
                                            sale.saleDate,

                                        subtotal:
                                            sale.subtotal,

                                        discount:
                                            sale.discount,

                                        total:
                                            sale.total,

                                        notes:
                                            sale.items
                                                .map(
                                                    (item) =>
                                                        item.observation,
                                                )
                                                .filter(Boolean)
                                                .join("\n") ||
                                            null,

                                        isActive:
                                            true,

                                        tenantId:
                                            TENANT_ID,

                                        branchId:
                                            BRANCH_ID,
                                    },
                                });

                            /*
                             * ---------------------------------------------------
                             * ITENS
                             * ---------------------------------------------------
                             */

                            for (const item of sale.items) {
                                const productId =
                                    resolveProductId(
                                        item.oldProductId,
                                        productMappings,
                                    );

                                const serviceId =
                                    resolveServiceId(
                                        item.oldProductId,
                                        serviceMappings,
                                    );

                                if (productId) {
                                    const quantity =
                                        item.quantity > 0
                                            ? item.quantity
                                            : 1;

                                    const unitPrice =
                                        item.totalPartial /
                                        quantity;

                                    await tx.itemProduct.create({
                                        data: {
                                            saleId:
                                                createdSale.id,

                                            productId,

                                            unitPrice,

                                            quantity,

                                            tenantId:
                                                TENANT_ID,

                                            branchId:
                                                BRANCH_ID,
                                        },
                                    });

                                    continue;
                                }

                                if (serviceId) {
                                    await tx.itemOpticalService.create({
                                        data: {
                                            saleId:
                                                createdSale.id,

                                            serviceId,

                                            unitPrice:
                                                item.totalPartial,

                                            tenantId:
                                                TENANT_ID,

                                            branchId:
                                                BRANCH_ID,
                                        },
                                    });

                                    continue;
                                }

                                throw new Error(
                                    `Item ${item.oldProductId} ` +
                                    `não possui mapping durante a transação.`,
                                );
                            }

                            /*
                             * ---------------------------------------------------
                             * PAYMENT
                             * ---------------------------------------------------
                             *
                             * Uma Sale possui exatamente um Payment.
                             *
                             * O desconto dos itens já está na Sale.
                             * Portanto:
                             *
                             * payment.discount = 0
                             * payment.subtotal = sale.total
                             * payment.total = sale.total
                             */

                            const paymentStatus =
                                calculatePaymentStatus(
                                    sale.paidAmount,
                                    sale.total,
                                );

                            const payment =
                                await tx.payment.create({
                                    data: {
                                        saleId:
                                            createdSale.id,

                                        status:
                                            paymentStatus,

                                        subtotal:
                                            sale.total,

                                        discount: 0,

                                        total:
                                            sale.total,

                                        paidAmount:
                                            sale.paidAmount,

                                        installmentsPaid:
                                            sale.installmentsPaid,

                                        lastPaymentAt:
                                            sale.lastPaymentAt,

                                        isActive:
                                            true,

                                        tenantId:
                                            TENANT_ID,

                                        branchId:
                                            BRANCH_ID,
                                    },
                                });

                            /*
                             * ---------------------------------------------------
                             * PAYMENT METHOD ITEM
                             * ---------------------------------------------------
                             */

                            const method =
                                mapPaymentMethod(
                                    sale.paymentMethod,
                                );

                            if (!method) {
                                throw new Error(
                                    `Forma de pagamento não mapeada: ` +
                                    `${sale.paymentMethod ?? "(vazia)"}`,
                                );
                            }

                            const isCarne =
                                isCarnePayment(
                                    sale.paymentMethod,
                                );

                            const methodItem =
                                await tx.paymentMethodItem.create({
                                    data: {
                                        paymentId:
                                            payment.id,

                                        method,

                                        amount:
                                            sale.total,

                                        installments:
                                            isCarne
                                                ? sale.carne.length
                                                : null,

                                        firstDueDate:
                                            isCarne
                                                ? (
                                                    sale.carne[0]
                                                        ?.dueDate ??
                                                    sale.dueDate
                                                )
                                                : null,

                                        isPaid:
                                            nearlyEqual(
                                                sale.paidAmount,
                                                sale.total,
                                            ) ||
                                            sale.paidAmount >
                                            sale.total,

                                        paidAt:
                                            sale.lastPaymentAt,

                                        tenantId:
                                            TENANT_ID,

                                        branchId:
                                            BRANCH_ID,
                                    },
                                });

                            /*
                             * ---------------------------------------------------
                             * PAYMENT INSTALLMENTS
                             * ---------------------------------------------------
                             *
                             * Somente carnê gera parcelas.
                             *
                             * A entrada não é criada como parcela porque
                             * ela já está representada em Payment.paidAmount.
                             */
                            if (isCarne) {
                                for (const installment of sale.carne) {
                                    const paid =
                                        installment.paymentDate !==
                                        null ||
                                        (
                                            installment.status ??
                                            ""
                                        )
                                            .toLowerCase()
                                            .includes("pago");

                                    await tx.paymentInstallment.create({
                                        data: {
                                            paymentMethodItemId:
                                                methodItem.id,

                                            sequence:
                                                installment.sequence,

                                            amount:
                                                installment.installmentAmount,

                                            paidAmount:
                                                paid
                                                    ? installment.installmentAmount
                                                    : 0,

                                            dueDate:
                                                installment.dueDate,

                                            paidAt:
                                                installment.paymentDate,

                                            isActive:
                                                true,

                                            tenantId:
                                                TENANT_ID,

                                            branchId:
                                                BRANCH_ID,
                                        },
                                    });
                                }
                            }

                            return createdSale;
                        },
                    );

                created++;

                appendMapping({
                    oldId: sale.oldId,
                    newId: createdSale.id,
                    status: "CREATED",
                });

                totalItems +=
                    sale.items.length;

                totalSubtotal +=
                    sale.subtotal;

                totalDiscount +=
                    sale.discount;

                totalSales +=
                    sale.total;

                totalPaid +=
                    sale.paidAmount;

                writeLog(
                    `CREATED venda antiga=${sale.oldId} ` +
                    `nova=${createdSale.id}`,
                );
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : String(error);

                const stack =
                    error instanceof Error
                        ? error.stack
                        : undefined;

                errors.push({
                    oldId:
                        sale.oldId || null,
                    message,
                    stack,
                });

                writeLog(
                    `ERROR venda=${sale.oldId}: ${message}`,
                );
            }
        }

        /*
         * Mapping só substitui o anterior se
         * toda a execução estiver livre de ERROR.
         *
         * PENDING não impede o mapping.
         */
        if (errors.length === 0) {
            finalizeMapping();
        } else {
            discardTempMapping();
        }

        writePendingReport(
            pending,
        );

        writeErrorReport(
            errors,
        );

        writeExecutionReport({
            migration:
                "04-sale",

            executedAt:
                new Date().toISOString(),

            dryRun:
                DRY_RUN,

            total:
                sources.length,

            created,
            existing,

            pending:
                pending.length,

            errors:
                errors.length,

            totalItems,

            subtotal:
                totalSubtotal,

            discount:
                totalDiscount,

            salesTotal:
                totalSales,

            paidAmount:
                totalPaid,

            financialInconsistencies,

            mappingSaved:
                errors.length === 0,
        });

        writeLog(
            `Finalizada migration 04-sale | ` +
            `total=${sources.length} ` +
            `created=${created} ` +
            `existing=${existing} ` +
            `pending=${pending.length} ` +
            `errors=${errors.length}`,
        );
    } catch (error) {
        discardTempMapping();

        writeLog(
            `FATAL: ${error instanceof Error
                ? error.stack ??
                error.message
                : String(error)
            }`,
        );

        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(() => {
    process.exit(1);
});