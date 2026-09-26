// migrations/oticacrista/01-brand.ts

import { prisma } from "../../../src/config/prisma";

import { migrationConfig } from "../shared/config";
import { createMigrationLogger } from "../shared/logger";
import { formatTimestamp } from "../shared/utils";

import { loadBrands } from "./brand.loader";
import { convertBrand } from "./brand.converter";
import { persistBrand } from "./brand.persistence";
import {
    createBrandReport,
    type BrandMapping,
} from "./brand.report";

async function main() {
    const startedAt = new Date();

    const logger = createMigrationLogger({
        entity: "brand",
        entityReportsDir: "./migrations/oticacrista/brands/reports",
        executionTimestamp: formatTimestamp(startedAt),
    });

    const report = createBrandReport({
        reportsDir:
            "./migrations/oticacrista/brands/reports",
    });

    logger.info("=================================");
    logger.info("MIGRAÇÃO: BRAND");
    logger.info("=================================");
    logger.info(
        `Tenant: ${migrationConfig.tenantId}`
    );
    logger.info(
        `Branch: ${migrationConfig.branchId ?? "NÃO DEFINIDA"}`
    );
    logger.info(
        `DRY RUN: ${migrationConfig.dryRun
            ? "SIM"
            : "NÃO"
        }`
    );
    logger.info("");

    const oldBrands = loadBrands({
        inputDir: migrationConfig.inputDir,
    });

    logger.info(
        `Registros encontrados: ${oldBrands.length}`
    );
    logger.info("");

    const mappings: BrandMapping[] = [];

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const oldBrand of oldBrands) {
        try {
            const brandData = convertBrand(
                oldBrand,
                migrationConfig.tenantId
            );

            const result = await persistBrand(
                brandData,
                migrationConfig.dryRun
            );

            if (result.status === "EXISTING") {
                existing++;

                mappings.push({
                    oldId: oldBrand.marcaId,
                    newId: result.id,
                    status: "EXISTING",
                    oldName: oldBrand.marcaNome,
                    newName: result.name,
                });

                logger.info(
                    `[EXISTENTE] ${oldBrand.marcaId} → ${result.id} | ${oldBrand.marcaNome}`
                );

                continue;
            }

            created++;

            mappings.push({
                oldId: oldBrand.marcaId,
                newId: result.id,
                status: "CREATED",
                oldName: oldBrand.marcaNome,
                newName: result.name,
            });

            if (migrationConfig.dryRun) {
                logger.info(
                    `[DRY RUN - CRIARIA] ${oldBrand.marcaId} | ${oldBrand.marcaNome}`
                );
            } else {
                logger.info(
                    `[CRIADO] ${oldBrand.marcaId} → ${result.id} | ${oldBrand.marcaNome}`
                );
            }
        } catch (error) {
            errors++;

            report.saveError({
                brand: oldBrand,
                error,
            });

            logger.error(
                `[ERRO] ${oldBrand.marcaId} | ${oldBrand.marcaNome}`
            );

            logger.error(
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        }
    }

    const finishedAt = new Date();

    if (errors === 0) {
        report.saveMapping(mappings);

        logger.info(
            "Mapping atualizado com sucesso."
        );
    } else {
        logger.warning(
            "O mapping não foi atualizado porque ocorreram erros."
        );
    }

    const executionReport = {
        entity: "Brand",
        tenantId: migrationConfig.tenantId,
        dryRun: migrationConfig.dryRun,

        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),

        durationMs:
            finishedAt.getTime() -
            startedAt.getTime(),

        total: oldBrands.length,
        created,
        existing,
        errors,
    };

    report.saveExecution(executionReport);

    logger.info("");
    logger.info("=================================");
    logger.info("MIGRAÇÃO FINALIZADA");
    logger.info("=================================");
    logger.info(
        `Total:      ${oldBrands.length}`
    );
    logger.info(`Criados:    ${created}`);
    logger.info(`Existentes: ${existing}`);
    logger.info(`Erros:      ${errors}`);
}

main()
    .catch((error) => {
        console.error(
            "Erro fatal na migração:",
            error
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });