import path from "node:path";
import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { loadMapping } from "@migrations/oticacrista/shared/mapping";
import { createMigrationLogger } from "@migrations/oticacrista/shared/logger";
import { formatTimestamp } from "@migrations/oticacrista/shared/utils";
import { convertSale, parseLegacyId } from "./sale.converter";
import { loadSales, type OldSale, type OldSaleItem } from "./sale.loader";
import { createSaleWithItems } from "./sale.persistence";
import { createSaleReport } from "./sale.report";

const MAPPINGS_DIR = path.resolve(process.cwd(), "migrations/oticacrista/mappings");

interface SalePlan {
    source: OldSale;
    items: OldSaleItem[];
    legacyId: number | null;
    converted: ReturnType<typeof convertSale>["sale"];
    issues: string[];
}

function isFinancialIssue(issue: string): boolean {
    return /subtotal calculado|total da venda inválido|valor parcial inválido|quantidade inválida|desconto calculado negativo/i.test(issue);
}

async function main(): Promise<void> {
    const startedAt = new Date();
    const logger = createMigrationLogger({
        entity: "sale",
        entityReportsDir: "./migrations/oticacrista/modules/sale/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });
    const report = createSaleReport();

    let created = 0;
    let pending = 0;
    let errors = 0;
    let itemsCreated = 0;
    let clientsWithoutMapping = 0;
    let productsWithoutMapping = 0;
    let financialInconsistencies = 0;
    let itemsWithoutSale = 0;
    let totalItems = 0;
    let mappingFinalized = false;
    let inputSales: OldSale[] = [];
    let inputItems: OldSaleItem[] = [];

    try {
        logger.info("MIGRAÇÃO: SALE + ITEM PRODUCT");
        logger.info(`Tenant: ${migrationConfig.tenantId}`);
        logger.info(`Branch: ${migrationConfig.branchId}`);
        logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);

        const loaded = loadSales(migrationConfig.inputDir);
        inputSales = loaded.sales;
        inputItems = loaded.items;
        totalItems = inputItems.length;

        const clientMapping = loadMapping(MAPPINGS_DIR, "client");
        const productMapping = loadMapping(MAPPINGS_DIR, "product");
        const salesById = new Map<number, OldSale[]>();
        for (const sale of inputSales) {
            const legacyId = parseLegacyId(sale.ateId);
            if (legacyId === null) continue;
            const sameId = salesById.get(legacyId) ?? [];
            sameId.push(sale);
            salesById.set(legacyId, sameId);
        }

        const itemsBySale = new Map<number, OldSaleItem[]>();
        const orphanItems: OldSaleItem[] = [];
        for (const item of inputItems) {
            const legacySaleId = parseLegacyId(item.itemAtendimento);
            if (legacySaleId === null || !salesById.has(legacySaleId)) {
                orphanItems.push(item);
                itemsWithoutSale++;
                report.saveOrphanItem(item, legacySaleId === null
                    ? `ID de atendimento inválido: ${item.itemAtendimento}`
                    : `Atendimento legado ${legacySaleId} não existe em atendimento.csv.`);
                continue;
            }
            const group = itemsBySale.get(legacySaleId) ?? [];
            group.push(item);
            itemsBySale.set(legacySaleId, group);
        }

        const plans: SalePlan[] = [];
        for (const source of inputSales) {
            const legacyId = parseLegacyId(source.ateId);
            const saleItems = legacyId === null ? [] : itemsBySale.get(legacyId) ?? [];
            const legacyClientId = parseLegacyId(source.ateCliente);
            const mappedClient = legacyClientId === null ? undefined : clientMapping.get(legacyClientId);
            if (legacyClientId !== null && !mappedClient) clientsWithoutMapping++;

            const converted = convertSale(source, saleItems, mappedClient ?? null, productMapping);
            const issues = [...converted.issues];
            if (legacyId !== null && (salesById.get(legacyId)?.length ?? 0) > 1) {
                issues.push(`ID legado de atendimento duplicado: ${legacyId}.`);
            }
            for (const item of saleItems) {
                const legacyProductId = parseLegacyId(item.itemProduto);
                if (legacyProductId === null || !productMapping.has(legacyProductId)) productsWithoutMapping++;
            }
            financialInconsistencies += issues.filter(isFinancialIssue).length;

            const plan: SalePlan = { source, items: saleItems, legacyId, converted: converted.sale, issues };
            plans.push(plan);
            if (issues.length) {
                pending++;
                report.saveSaleIssue(source, saleItems, issues, "PENDING");
                logger.warning(`[PENDENTE] atendimento ${source.ateId}: ${issues.join(" | ")}`);
            }
        }

        logger.info(`Atendimentos analisados: ${inputSales.length}`);
        logger.info(`Itens analisados: ${totalItems}`);
        logger.info(`Itens sem atendimento: ${orphanItems.length}`);
        logger.info(`Atendimentos pendentes: ${pending}`);

        if (!migrationConfig.dryRun) report.startMapping();

        for (let index = 0; index < plans.length; index++) {
            const plan = plans[index];
            if (plan.issues.length || !plan.converted || plan.legacyId === null) continue;

            try {
                if (migrationConfig.dryRun) {
                    created++;
                    itemsCreated += plan.converted.items.length;
                    logger.info(`[${index + 1}/${plans.length}] CRIARIA atendimento ${plan.legacyId} (${plan.converted.items.length} itens)`);
                    continue;
                }

                const newSaleId = await createSaleWithItems(plan.converted);
                created++;
                itemsCreated += plan.converted.items.length;
                report.appendMapping({
                    oldId: plan.legacyId,
                    newId: newSaleId,
                    oldName: `Atendimento ${plan.legacyId}`,
                    newName: `Sale ${newSaleId}`,
                });
                logger.info(`[${index + 1}/${plans.length}] CRIADA venda ${plan.legacyId} → ${newSaleId} (${plan.converted.items.length} itens)`);
            } catch (error) {
                errors++;
                const message = error instanceof Error ? error.message : String(error);
                report.saveSaleIssue(plan.source, plan.items, [message], "ERROR", error);
                logger.error(`[ERRO] atendimento ${plan.legacyId}: ${message}`);
            }
        }

        if (migrationConfig.dryRun) {
            logger.info("DRY RUN finalizado. Nenhuma venda, item ou mapping foi persistido.");
        } else if (pending === 0 && errors === 0) {
            report.finalizeMapping();
            mappingFinalized = true;
            logger.success("Mapping de vendas atualizado.");
        } else {
            report.discardMapping();
            logger.warning("Mapping de vendas não finalizado: existem vendas pendentes ou com erro.");
        }

        const finishedAt = new Date();
        report.saveExecution({
            entity: "Sale",
            tenantId: migrationConfig.tenantId,
            dryRun: migrationConfig.dryRun,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            total: inputSales.length,
            created,
            existing: 0,
            errors,
            pending,
            itemsAnalyzed: totalItems,
            itemsCreated,
            itemsWithoutSale,
            clientsWithoutMapping,
            productsWithoutMapping,
            financialInconsistencies,
            mappingFile: report.mappingPath,
            mappingFinalized,
        });
        logger.info(`Resumo: vendas=${inputSales.length}, criadas=${created}, pendentes=${pending}, erros=${errors}, itens=${totalItems}, itens criados=${itemsCreated}, itens sem venda=${itemsWithoutSale}`);
    } catch (error) {
        if (!migrationConfig.dryRun) report.discardMapping();
        throw error;
    }
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração de vendas:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
