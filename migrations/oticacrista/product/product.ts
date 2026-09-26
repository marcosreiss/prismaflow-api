// migrations/oticacrista/product/product.ts

import { prisma } from "../../../src/config/prisma";

import { migrationConfig } from "../shared/config";
import { createMigrationLogger } from "../shared/logger";
import { formatTimestamp } from "../shared/utils";
import { loadMapping } from "../shared/mapping";

import { loadProducts } from "./product.loader";
import { convertProduct } from "./product.converter";
import {
    resolveBrand,
    resolveCategory,
    closeMatcherPrompt,
} from "./product.matcher";
import {
    findExistingProduct,
    createProduct,
    persistService,
} from "./product.persistence";
import { createProductReport } from "./product.report";

async function main() {
    const startedAt = new Date();

    const logger = createMigrationLogger({
        entity: "product",
        entityReportsDir: "./migrations/oticacrista/product/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });

    const report = createProductReport({
        entityReportsDir: "./migrations/oticacrista/product/reports",
        mappingsDir: "./migrations/oticacrista/mappings",
    });

    logger.info("=================================");
    logger.info("MIGRAÇÃO: PRODUCT");
    logger.info("=================================");
    logger.info(`Tenant: ${migrationConfig.tenantId}`);
    logger.info(`Branch: ${migrationConfig.branchId ?? "NÃO DEFINIDA"}`);
    logger.info(`DRY RUN: ${migrationConfig.dryRun ? "SIM" : "NÃO"}`);
    logger.info("");

    const oldProducts = loadProducts({
        inputDir: migrationConfig.inputDir,
    });

    logger.info(`Registros encontrados: ${oldProducts.length}`);
    logger.info("");

    const brandMapping = loadMapping(
        "./migrations/oticacrista/mappings",
        "brand",
    );

    logger.info(`Marcas no mapping: ${brandMapping.size}`);
    logger.info("");

    if (!migrationConfig.dryRun) {
        report.startMappings();
    }

    let productsCreated = 0;
    let productsExisting = 0;
    let servicesCreated = 0;
    let servicesExisting = 0;
    let errors = 0;

    for (const oldProduct of oldProducts) {
        try {
            const converted = convertProduct(oldProduct);

            if (converted.kind === "SERVICE") {
                const result = await persistService(
                    converted,
                    migrationConfig.tenantId,
                    migrationConfig.branchId,
                    migrationConfig.dryRun,
                );

                if (result.status === "EXISTING") {
                    servicesExisting++;
                } else {
                    servicesCreated++;
                }

                if (!migrationConfig.dryRun) {
                    report.appendServiceMapping({
                        oldId: converted.oldId,
                        newId: result.id,
                        status: result.status,
                        oldName: converted.name,
                        newName: result.name,
                    });
                }

                logger.info(
                    `[SERVICE ${result.status}] ${converted.oldId} → ${result.id ?? "-"} | ${converted.name}`,
                );

                continue;
            }

            const brand = resolveBrand(converted, brandMapping);

            /*
             * Verifica primeiro se o produto já existe. Só perguntamos
             * a categoria manualmente quando o produto for de fato novo
             * — não há motivo para interromper a migração com uma
             * pergunta sobre um registro que já existe no banco atual.
             */
            const existingProduct = await findExistingProduct(
                converted,
                brand,
                migrationConfig.tenantId,
            );

            const result =
                existingProduct ??
                (await createProduct(
                    converted,
                    brand,
                    await resolveCategory(converted),
                    migrationConfig.tenantId,
                    migrationConfig.dryRun,
                ));

            if (result.status === "EXISTING") {
                productsExisting++;
            } else {
                productsCreated++;
            }

            if (!migrationConfig.dryRun) {
                report.appendProductMapping({
                    oldId: converted.oldId,
                    newId: result.id,
                    status: result.status,
                    oldName: converted.name,
                    newName: result.name,
                    brandOldId: brand.brandOldId,
                    brandNewId: brand.brandNewId,
                    category: result.category,
                });
            }

            logger.info(
                `[${result.status}] ${converted.oldId} → ${result.id ?? "-"} | ${converted.name} | marca=${brand.brandName}`,
            );
        } catch (error) {
            errors++;

            report.saveError({
                product: oldProduct,
                error,
            });

            logger.error(`[ERRO] ${oldProduct.prodId} | ${oldProduct.prodNome}`);
            logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    const finishedAt = new Date();

    if (migrationConfig.dryRun) {
        logger.info("DRY RUN finalizado. Nenhum mapping foi criado ou alterado.");
    } else if (errors === 0) {
        report.finalizeMappings();
        logger.info("Mappings de product e service atualizados com sucesso.");
    } else {
        report.discardMappings();
        logger.warning("Os mappings não foram atualizados porque ocorreram erros.");
    }

    /*
     * MigrationExecutionReport (shared/types.ts) exige "created" e
     * "existing" no nível raiz — mesmo contrato usado por brand.ts.
     * Como product tem duas sub-entidades (products e services),
     * somamos as duas nos campos raiz obrigatórios e mantemos o
     * detalhamento por sub-entidade em campos extras.
     */
    const executionReport = {
        entity: "Product",
        tenantId: migrationConfig.tenantId,
        dryRun: migrationConfig.dryRun,

        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),

        durationMs: finishedAt.getTime() - startedAt.getTime(),

        total: oldProducts.length,

        created: productsCreated + servicesCreated,
        existing: productsExisting + servicesExisting,
        errors,

        products: {
            created: productsCreated,
            existing: productsExisting,
        },

        services: {
            created: servicesCreated,
            existing: servicesExisting,
        },
    };

    report.saveExecution(executionReport);

    logger.info("");
    logger.info("=================================");
    logger.info("MIGRAÇÃO FINALIZADA");
    logger.info("=================================");
    logger.info(`Total:              ${oldProducts.length}`);
    logger.info(`Produtos criados:   ${productsCreated}`);
    logger.info(`Produtos existentes:${productsExisting}`);
    logger.info(`Serviços criados:   ${servicesCreated}`);
    logger.info(`Serviços existentes:${servicesExisting}`);
    logger.info(`Erros:              ${errors}`);
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        closeMatcherPrompt();
        await prisma.$disconnect();
    });