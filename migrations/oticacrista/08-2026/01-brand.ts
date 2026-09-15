import fs from "node:fs";
import path from "node:path";

import { prisma } from "../../../src/config/prisma";
import { loadBrands } from "./loaders/brand.loader";
import { convertBrand } from "./converters/brand.converter";
import {
    BrandMapping,
    saveBrandMapping,
} from "./mapping/brand.mapping";

const TENANT_ID = "cmibvcyed00007m0118rkgft8";

async function main() {
    const startedAt = new Date();

    console.log("=================================");
    console.log(" MIGRAÇÃO: BRAND");
    console.log("=================================");
    console.log(`Tenant: ${TENANT_ID}`);
    console.log("");

    const oldBrands = loadBrands();

    console.log(`Registros encontrados: ${oldBrands.length}`);
    console.log("");

    const mappings: BrandMapping[] = [];

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const oldBrand of oldBrands) {
        try {
            const brandData = convertBrand(oldBrand, TENANT_ID);

            const existingBrand = await prisma.brand.findUnique({
                where: {
                    tenantId_name: {
                        tenantId: TENANT_ID,
                        name: brandData.name,
                    },
                },
            });

            if (existingBrand) {
                existing++;

                mappings.push({
                    oldId: oldBrand.marcaId,
                    newId: existingBrand.id,
                    status: "EXISTING",
                    oldName: oldBrand.marcaNome,
                    newName: existingBrand.name,
                });

                console.log(
                    `[EXISTENTE] ${oldBrand.marcaId} → ${existingBrand.id} | ${oldBrand.marcaNome}`
                );

                continue;
            }

            const newBrand = await prisma.brand.create({
                data: brandData,
            });

            created++;

            mappings.push({
                oldId: oldBrand.marcaId,
                newId: newBrand.id,
                status: "CREATED",
                oldName: oldBrand.marcaNome,
                newName: newBrand.name,
            });

            console.log(
                `[CRIADO] ${oldBrand.marcaId} → ${newBrand.id} | ${oldBrand.marcaNome}`
            );
        } catch (error) {
            errors++;

            saveBrandError(oldBrand, error);

            console.error(
                `[ERRO] ${oldBrand.marcaId} | ${oldBrand.marcaNome}`
            );
            console.error(error);
        }
    }

    const finishedAt = new Date();

    const timestamp = formatTimestamp(finishedAt);

    saveBrandMapping(mappings, timestamp);

    saveExecutionReport({
        table: "Brand",
        tenantId: TENANT_ID,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        total: oldBrands.length,
        created,
        existing,
        errors,
    }, timestamp);

    console.log("");
    console.log("=================================");
    console.log(" MIGRAÇÃO FINALIZADA");
    console.log("=================================");
    console.log(`Total:     ${oldBrands.length}`);
    console.log(`Criados:   ${created}`);
    console.log(`Existentes:${existing}`);
    console.log(`Erros:     ${errors}`);
}

function saveBrandError(
    oldBrand: {
        marcaId: number;
        marcaNome: string;
    },
    error: unknown
) {
    const outputDir = path.resolve(
        process.cwd(),
        "migrations/oticacrista/08-2026/reports/errors"
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = formatTimestamp(new Date());

    const filePath = path.join(
        outputDir,
        `01-brand-errors-${timestamp}.json`
    );

    const errorData = {
        table: "Brand",
        oldId: oldBrand.marcaId,
        oldName: oldBrand.marcaNome,
        occurredAt: new Date().toISOString(),
        error: serializeError(error),
    };

    fs.writeFileSync(
        filePath,
        JSON.stringify(errorData, null, 2),
        "utf-8"
    );
}

function saveExecutionReport(
    report: {
        table: string;
        tenantId: string;
        startedAt: string;
        finishedAt: string;
        total: number;
        created: number;
        existing: number;
        errors: number;
    },
    timestamp: string
) {
    const outputDir = path.resolve(
        process.cwd(),
        "migrations/oticacrista/08-2026/reports/executions"
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(
        outputDir,
        `01-brand-execution-${timestamp}.json`
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify(report, null, 2),
        "utf-8"
    );
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return String(error);
}

function formatTimestamp(date: Date): string {
    return date
        .toISOString()
        .replace("T", "-")
        .replace(/:/g, "-")
        .replace(/\..+/, "");
}

main()
    .catch((error) => {
        console.error("Erro fatal na migração:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });