import type { MappingRow } from "@migrations/oticacrista/shared/mapping";
import { convertSale, MYSQL_INT_MAX, parseCents, parseLegacyId, parseQuantity } from "./sale.converter";
import type { OldSale, OldSaleItem } from "./sale.loader";

export interface PreparedSale {
    source: OldSale;
    items: OldSaleItem[];
    legacyId: number;
    converted: NonNullable<ReturnType<typeof convertSale>["sale"]>;
}

export interface PreflightIssue {
    kind: "SALE" | "ORPHAN_ITEM" | "CONFIGURATION";
    legacyId: string;
    reasons: string[];
    sourceSale?: OldSale;
    relatedItems?: OldSaleItem[];
    sourceItem?: OldSaleItem;
}

export interface SalePreflight {
    plans: PreparedSale[];
    issues: PreflightIssue[];
    salesAnalyzed: number;
    salesEligible: number;
    salesPending: number;
    itemsAnalyzed: number;
    itemsEligible: number;
    itemsWithoutSale: number;
    clientsWithoutMapping: number;
    productsWithoutMapping: number;
    financialInconsistencies: number;
    oversizedTexts: number;
}

function financialIssue(reason: string): boolean {
    return /subtotal calculado|total da venda inválido|valor parcial inválido|quantidade inválida|desconto calculado negativo|precisão numérica segura/i.test(reason);
}

function tooLargeText(reason: string): boolean {
    return /excede o limite de MySQL TEXT/i.test(reason);
}

export function prepareSaleMigration(args: {
    sales: OldSale[];
    items: OldSaleItem[];
    clients: Map<number, MappingRow>;
    products: Map<number, MappingRow>;
    tenantId: string;
    branchId: string;
    knownClientIds?: Set<number>;
    knownProductIds?: Set<number>;
    branchExists?: boolean;
}): SalePreflight {
    const { sales, items, clients, products, tenantId, branchId, knownClientIds, knownProductIds, branchExists } = args;
    const issues: PreflightIssue[] = [];
    const salesById = new Map<number, OldSale[]>();
    let clientsWithoutMapping = 0;
    let productsWithoutMapping = 0;
    let financialInconsistencies = 0;
    let oversizedTexts = 0;

    if ([...tenantId].length > 191) {
        issues.push({ kind: "CONFIGURATION", legacyId: "tenantId", reasons: ["tenantId excede 191 caracteres, limite VARCHAR(191) do schema MySQL."] });
    }
    if ([...branchId].length > 191) {
        issues.push({ kind: "CONFIGURATION", legacyId: "branchId", reasons: ["branchId excede 191 caracteres, limite VARCHAR(191) do schema MySQL."] });
    }
    if (branchExists === false) {
        issues.push({ kind: "CONFIGURATION", legacyId: "branchId", reasons: ["branchId não existe ou não pertence ao tenantId configurado."] });
    }

    for (const sale of sales) {
        const id = parseLegacyId(sale.ateId);
        if (id === null) continue;
        const sameId = salesById.get(id) ?? [];
        sameId.push(sale);
        salesById.set(id, sameId);
    }

    const itemsBySale = new Map<number, OldSaleItem[]>();
    for (const item of items) {
        const saleId = parseLegacyId(item.itemAtendimento);
        if (saleId === null || !salesById.has(saleId)) {
            const reasons = [saleId === null ? `ID de atendimento inválido: ${item.itemAtendimento}` : `Atendimento legado ${saleId} não existe em atendimento.csv.`];
            const productId = parseLegacyId(item.itemProduto);
            const productMapping = productId === null ? undefined : products.get(productId);
            if (productId === null || !productMapping) {
                productsWithoutMapping++;
                reasons.push(productId === null
                    ? `ID de produto inválido: ${item.itemProduto}`
                    : `Produto legado ${productId} sem correspondência no product-mapping.csv.`);
            } else if (!Number.isInteger(productMapping.newId) || productMapping.newId < 1 || productMapping.newId > MYSQL_INT_MAX) {
                productsWithoutMapping++;
                reasons.push(`ID de produção inválido no product-mapping.csv para o produto ${productId}.`);
            } else if (knownProductIds && !knownProductIds.has(productMapping.newId)) {
                productsWithoutMapping++;
                reasons.push(`Produto de produção ${productMapping.newId} do mapping não existe no tenant ${tenantId}.`);
            }
            const quantity = parseQuantity(item.itemQtd);
            if (quantity === null) {
                reasons.push(`Quantidade inválida para o produto ${item.itemProduto}: ${item.itemQtd}`);
            } else if (quantity > MYSQL_INT_MAX) {
                reasons.push(`Quantidade excede o limite INT do banco para o produto ${item.itemProduto}.`);
            }
            const unitPriceCents = parseCents(item.itemTotalParcial);
            if (unitPriceCents === null || unitPriceCents < 0n) {
                reasons.push(`Valor parcial inválido para o produto ${item.itemProduto}: ${item.itemTotalParcial}`);
            } else if (!Number.isSafeInteger(Number(unitPriceCents))) {
                reasons.push(`Valor parcial excede a precisão numérica segura para o produto ${item.itemProduto}.`);
            }
            financialInconsistencies += reasons.filter(financialIssue).length;
            issues.push({
                kind: "ORPHAN_ITEM",
                legacyId: item.itemAtendimento,
                reasons,
                sourceItem: item,
            });
            continue;
        }
        const group = itemsBySale.get(saleId) ?? [];
        group.push(item);
        itemsBySale.set(saleId, group);
    }

    const plans: PreparedSale[] = [];
    let salesPending = 0;
    for (const source of sales) {
        const legacyId = parseLegacyId(source.ateId);
        const relatedItems = legacyId === null ? [] : itemsBySale.get(legacyId) ?? [];
        const legacyClientId = parseLegacyId(source.ateCliente);
        const clientMapping = legacyClientId === null ? undefined : clients.get(legacyClientId);
        const clientTargetMissing = Boolean(clientMapping && knownClientIds && !knownClientIds.has(clientMapping.newId));
        if (legacyClientId !== null && (!clientMapping || !Number.isInteger(clientMapping.newId)
            || clientMapping.newId < 1 || clientMapping.newId > MYSQL_INT_MAX || clientTargetMissing)) clientsWithoutMapping++;

        let converted: ReturnType<typeof convertSale>;
        try {
            converted = convertSale(source, relatedItems, clientMapping ?? null, products);
        } catch (error) {
            converted = {
                sale: null,
                issues: [`Erro de conversão: ${error instanceof Error ? error.message : String(error)}`],
            };
        }

        const reasons = [...converted.issues];
        if (clientTargetMissing && legacyClientId !== null && clientMapping) {
            reasons.push(`Cliente de produção ${clientMapping.newId} do mapping não existe no tenant ${tenantId}.`);
        }
        if (legacyId !== null && (salesById.get(legacyId)?.length ?? 0) > 1) {
            reasons.push(`ID legado de atendimento duplicado: ${legacyId}.`);
        }
        for (const item of relatedItems) {
            const productId = parseLegacyId(item.itemProduto);
            const productMapping = productId === null ? undefined : products.get(productId);
            const productTargetMissing = Boolean(productMapping && knownProductIds && !knownProductIds.has(productMapping.newId));
            if (productId === null || !productMapping || !Number.isInteger(productMapping.newId)
                || productMapping.newId < 1 || productMapping.newId > MYSQL_INT_MAX || productTargetMissing) productsWithoutMapping++;
            if (productTargetMissing && productMapping) {
                reasons.push(`Produto de produção ${productMapping.newId} do mapping não existe no tenant ${tenantId}.`);
            }
        }
        financialInconsistencies += reasons.filter(financialIssue).length;
        oversizedTexts += reasons.filter(tooLargeText).length;

        if (reasons.length || legacyId === null || !converted.sale) {
            salesPending++;
            issues.push({ kind: "SALE", legacyId: source.ateId, reasons, sourceSale: source, relatedItems });
            continue;
        }

        if (converted.sale.clientId > MYSQL_INT_MAX || converted.sale.items.some((item) => item.productId > MYSQL_INT_MAX)) {
            salesPending++;
            issues.push({
                kind: "SALE",
                legacyId: source.ateId,
                reasons: ["Chave estrangeira excede o limite INT assinado do MySQL."],
                sourceSale: source,
                relatedItems,
            });
            continue;
        }
        plans.push({ source, items: relatedItems, legacyId, converted: converted.sale });
    }

    return {
        plans,
        issues,
        salesAnalyzed: sales.length,
        salesEligible: plans.length,
        salesPending,
        itemsAnalyzed: items.length,
        itemsEligible: plans.reduce((count, plan) => count + plan.items.length, 0),
        itemsWithoutSale: issues.filter((issue) => issue.kind === "ORPHAN_ITEM").length,
        clientsWithoutMapping,
        productsWithoutMapping,
        financialInconsistencies,
        oversizedTexts,
    };
}
