// migrations/oticacrista/08-2026/04-sale.ts

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
    loadAtendimentoSources,
    SaleSource,
} from "./loaders/atendimento.loader";

import { convertSale } from "./converters/sale.converter";
import {
    convertSaleItem,
    ItemSaleConverted,
} from "./converters/item-sale.converter";

const prisma = new PrismaClient();

const BASE_DIR = path.resolve(
    __dirname,
);

const REPORTS_DIR = path.join(
    BASE_DIR,
    "reports",
);

const LOGS_DIR = path.join(
    REPORTS_DIR,
    "logs",
);

const ERRORS_DIR = path.join(
    REPORTS_DIR,
    "errors",
);

const EXECUTIONS_DIR = path.join(
    REPORTS_DIR,
    "executions",
);

const MAPPINGS_DIR = path.join(
    REPORTS_DIR,
    "mappings",
);

const MAPPING_PATH = path.join(
    MAPPINGS_DIR,
    "04-sale-mapping.csv",
);

const TEMP_MAPPING_PATH =
    `${MAPPING_PATH}.tmp`;

const TENANT_ID =
    "cmibvcyed00007m0118rkgft8";

const BRANCH_ID =
    "cmibvcyed00017m014r66e39w";

const DRY_RUN =
    process.env.DRY_RUN !== "false";

const MONEY_TOLERANCE = 0.5;

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

interface SaleMapping {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
}

function ensureReportDirectories(): void {
    for (const directory of [
        REPORTS_DIR,
        LOGS_DIR,
        ERRORS_DIR,
        EXECUTIONS_DIR,
        MAPPINGS_DIR,
    ]) {
        fs.mkdirSync(directory, {
            recursive: true,
        });
    }
}

function timestamp(): string {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

function writeLog(
    message: string,
): void {
    ensureReportDirectories();

    const logPath = path.join(
        LOGS_DIR,
        `04-sale-${new Date()
            .toISOString()
            .slice(0, 10)}.log`,
    );

    const line =
        `[${new Date().toISOString()}] ${message}\n`;

    fs.appendFileSync(
        logPath,
        line,
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

function createTempMapping(): void {
    ensureReportDirectories();

    fs.writeFileSync(
        TEMP_MAPPING_PATH,
        "old_id,new_id,status\n",
        "utf8",
    );
}

function appendMapping(
    mapping: SaleMapping,
): void {
    fs.appendFileSync(
        TEMP_MAPPING_PATH,
        `${mapping.oldId},${mapping.newId ?? ""},${mapping.status}\n`,
        "utf8",
    );
}

function finalizeMapping(): void {
    fs.renameSync(
        TEMP_MAPPING_PATH,
        MAPPING_PATH,
    );
}

function discardTempMapping(): void {
    if (
        fs.existsSync(TEMP_MAPPING_PATH)
    ) {
        fs.unlinkSync(TEMP_MAPPING_PATH);
    }
}

function calculateItems(
    source: SaleSource,
): {
    items: ItemSaleConverted[];
    subtotal: number;
    discount: number;
    total: number;
    legacyItemTotal: number;
} {
    const items = source.itens.map(
        convertSaleItem,
    );

    const subtotal = items.reduce(
        (sum, item) =>
            sum + item.totalPartial,
        0,
    );

    const discount = items.reduce(
        (sum, item) =>
            sum + item.discount,
        0,
    );

    const total =
        subtotal - discount;

    const legacyItemTotal =
        items.reduce(
            (sum, item) =>
                sum + item.totalGeneral,
            0,
        );

    return {
        items,
        subtotal,
        discount,
        total,
        legacyItemTotal,
    };
}

function isPaidCarne(
    status: string | null,
): boolean {
    if (!status) {
        return false;
    }

    return status
        .toLowerCase()
        .includes("pago");
}

function calculatePaidAmount(
    sale: ReturnType<typeof convertSale>,
): number {
    const method =
        sale.paymentMethod?.toUpperCase() ?? "";

    /*
     * Carnê:
     *
     * paidAmount =
     * entrada + parcelas efetivamente pagas.
     */
    if (method === "CARNÊ") {
        const paidInstallments =
            sale.carne.reduce(
                (sum, parcela) =>
                    sum +
                    (isPaidCarne(
                        parcela.status,
                    )
                        ? parcela.installmentAmount
                        : 0),
                0,
            );

        return (
            sale.entryAmount +
            paidInstallments
        );
    }

    /*
     * Nos demais métodos, o legado informa
     * explicitamente que o pagamento foi
     * concluído com sucesso.
     */
    const status =
        sale.paymentStatus?.toLowerCase() ??
        "";

    if (
        status.includes("pago com sucesso")
    ) {
        return sale.legacyTotal;
    }

    /*
     * Caso não seja possível determinar
     * o pagamento pelo status, usamos a
     * entrada como valor conhecido.
     */
    return sale.entryAmount;
}

function writePendingReport(
    pending: PendingRecord[],
): void {
    const reportPath = path.join(
        ERRORS_DIR,
        `04-sale-pending-${timestamp()}.json`,
    );

    fs.writeFileSync(
        reportPath,
        JSON.stringify(
            pending,
            null,
            2,
        ),
        "utf8",
    );
}

function writeErrorReport(
    errors: ErrorRecord[],
): void {
    const reportPath = path.join(
        ERRORS_DIR,
        `04-sale-errors-${timestamp()}.json`,
    );

    fs.writeFileSync(
        reportPath,
        JSON.stringify(
            errors,
            null,
            2,
        ),
        "utf8",
    );
}

function writeExecutionReport(
    data: Record<string, unknown>,
): void {
    const reportPath = path.join(
        EXECUTIONS_DIR,
        `04-sale-${timestamp()}.json`,
    );

    fs.writeFileSync(
        reportPath,
        JSON.stringify(
            data,
            null,
            2,
        ),
        "utf8",
    );
}

async function main(): Promise<void> {
    ensureReportDirectories();

    writeLog(
        `Iniciando migration 04-sale | DRY_RUN=${DRY_RUN}`,
    );

    const sources =
        loadAtendimentoSources();

    const mappings: SaleMapping[] = [];
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
                if (!sale.oldId) {
                    pending.push({
                        oldId: 0,
                        reason:
                            "ATENDIMENTO_SEM_ID",
                    });

                    continue;
                }

                /*
                 * Toda venda precisa possuir cliente
                 * relacionado ao mapping da migration 03.
                 */
                if (!sale.oldClientId) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "VENDA_SEM_CLIENTE",
                    });

                    continue;
                }

                const clientMappingPath =
                    path.join(
                        MAPPINGS_DIR,
                        "03-client-mapping.csv",
                    );

                if (
                    !fs.existsSync(
                        clientMappingPath,
                    )
                ) {
                    throw new Error(
                        "03-client-mapping.csv não encontrado.",
                    );
                }

                const clientMappings =
                    fs
                        .readFileSync(
                            clientMappingPath,
                            "utf8",
                        )
                        .split(/\r?\n/)
                        .slice(1)
                        .filter(Boolean);

                const clientMapping =
                    clientMappings.find(
                        (line) =>
                            line.startsWith(
                                `${sale.oldClientId},`,
                            ),
                    );

                if (!clientMapping) {
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

                const clientFields =
                    clientMapping.split(",");

                const clientId =
                    Number(clientFields[1]);

                if (!clientId) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "CLIENTE_SEM_NEW_ID",
                        details: {
                            oldClientId:
                                sale.oldClientId,
                        },
                    });

                    continue;
                }

                const itemData =
                    calculateItems(source);

                totalItems +=
                    itemData.items.length;

                totalSubtotal +=
                    itemData.subtotal;

                totalDiscount +=
                    itemData.discount;

                totalSales +=
                    itemData.total;

                /*
                 * Regra financeira definida:
                 *
                 * sale.total =
                 * subtotal - desconto
                 *
                 * E comparamos contra:
                 * 1. ateTotal
                 * 2. SUM(itemTotalGeral)
                 */
                const totalFromItems =
                    itemData.total;

                const totalFromAtendimento =
                    sale.legacyTotal;

                const totalFromLegacyItems =
                    itemData.legacyItemTotal;

                if (
                    !nearlyEqual(
                        totalFromItems,
                        totalFromAtendimento,
                    )
                ) {
                    financialInconsistencies++;

                    writeLog(
                        `INCONSISTÊNCIA venda ${sale.oldId}: ` +
                        `calculado=${totalFromItems.toFixed(2)} ` +
                        `ateTotal=${totalFromAtendimento.toFixed(2)}`,
                    );
                }

                if (
                    !nearlyEqual(
                        totalFromItems,
                        totalFromLegacyItems,
                    )
                ) {
                    financialInconsistencies++;

                    writeLog(
                        `INCONSISTÊNCIA itens venda ${sale.oldId}: ` +
                        `calculado=${totalFromItems.toFixed(2)} ` +
                        `itemTotalGeral=${totalFromLegacyItems.toFixed(2)}`,
                    );
                }

                /*
                 * Verificação de itens sem produto.
                 *
                 * O mapping 02-product contém tanto
                 * produtos quanto serviços.
                 */
                const productMappingPath =
                    path.join(
                        MAPPINGS_DIR,
                        "02-product-mapping.csv",
                    );

                const serviceMappingPath =
                    path.join(
                        MAPPINGS_DIR,
                        "02-service-mapping.csv",
                    );

                const productMappings =
                    fs.existsSync(
                        productMappingPath,
                    )
                        ? fs
                            .readFileSync(
                                productMappingPath,
                                "utf8",
                            )
                            .split(/\r?\n/)
                            .slice(1)
                            .filter(Boolean)
                        : [];

                const serviceMappings =
                    fs.existsSync(
                        serviceMappingPath,
                    )
                        ? fs
                            .readFileSync(
                                serviceMappingPath,
                                "utf8",
                            )
                            .split(/\r?\n/)
                            .slice(1)
                            .filter(Boolean)
                        : [];

                const unresolvedItems =
                    itemData.items.filter(
                        (item) => {
                            const product =
                                productMappings.find(
                                    (line) =>
                                        line.startsWith(
                                            `${item.oldProductId},`,
                                        ),
                                );

                            const service =
                                serviceMappings.find(
                                    (line) =>
                                        line.startsWith(
                                            `${item.oldProductId},`,
                                        ),
                                );

                            return (
                                !product &&
                                !service
                            );
                        },
                    );

                if (
                    unresolvedItems.length > 0
                ) {
                    pending.push({
                        oldId: sale.oldId,
                        reason:
                            "ITEM_SEM_MAPPING",
                        details: {
                            items:
                                unresolvedItems,
                        },
                    });

                    continue;
                }

                /*
                 * Verifica se a Sale já existe.
                 *
                 * Não criamos duplicata.
                 */
                const existingSale =
                    await prisma.sale.findFirst({
                        where: {
                            tenantId: TENANT_ID,
                            branchId: BRANCH_ID,
                            legacyId: sale.oldId,
                        },
                    });

                if (existingSale) {
                    existing++;

                    mappings.push({
                        oldId: sale.oldId,
                        newId: existingSale.id,
                        status: "EXISTING",
                    });

                    appendMapping({
                        oldId: sale.oldId,
                        newId: existingSale.id,
                        status: "EXISTING",
                    });

                    continue;
                }

                /*
                 * DRY_RUN percorre exatamente o mesmo
                 * fluxo lógico, mas não persiste.
                 */
                if (DRY_RUN) {
                    created++;

                    mappings.push({
                        oldId: sale.oldId,
                        newId: null,
                        status: "CREATED",
                    });

                    appendMapping({
                        oldId: sale.oldId,
                        newId: null,
                        status: "CREATED",
                    });

                    continue;
                }

                /*
                 * A criação efetiva da Sale será feita
                 * somente após fecharmos os campos
                 * exatos dos models atuais.
                 *
                 * Este bloco propositalmente não cria
                 * dados com schema presumido.
                 */
                throw new Error(
                    "Schema de criação da Sale ainda precisa ser conectado aos campos exatos do model atual.",
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
                    `ERROR venda ${sale.oldId}: ${message}`,
                );
            }
        }

        if (errors.length === 0) {
            finalizeMapping();
        } else {
            discardTempMapping();
        }

        totalPaid = sources.reduce(
            (sum, source) =>
                sum +
                calculatePaidAmount(
                    convertSale(source),
                ),
            0,
        );

        writePendingReport(pending);
        writeErrorReport(errors);

        writeExecutionReport({
            migration: "04-sale",
            dryRun: DRY_RUN,
            executedAt:
                new Date().toISOString(),

            total: sources.length,

            created,
            existing,

            pending: pending.length,
            errors: errors.length,

            totalItems,
            subtotal: totalSubtotal,
            discount: totalDiscount,
            salesTotal: totalSales,
            paidAmount: totalPaid,

            financialInconsistencies,

            mappingSaved:
                errors.length === 0,
        });

        writeLog(
            `Migration finalizada | total=${sources.length} ` +
            `created=${created} existing=${existing} ` +
            `pending=${pending.length} errors=${errors.length}`,
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    writeLog(
        `FATAL: ${error instanceof Error
            ? error.stack ?? error.message
            : String(error)
        }`,
    );

    process.exit(1);
});