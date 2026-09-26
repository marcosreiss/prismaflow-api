// migrations/oticacrista/08-2026/02-product.ts

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { prisma } from "../../src/config/prisma";

import { loadProducts } from "./loaders/product.loader";
import { convertProduct } from "./converters/product.converter";

import {
    saveProductMapping,
    type ProductMapping,
} from "./mapping/product.mapping";

import {
    saveServiceMapping,
    type ServiceMapping,
} from "./mapping/service.mapping";

/* =========================================================
 * CONFIGURAÇÃO
 * ========================================================= */

const TENANT_ID = "cmibvcyed00007m0118rkgft8";

const BRANCH_ID = "cmibvcyed00017m014r66e39w";

/*
 * false = execução real
 * true  = apenas simulação
 */
const DRY_RUN = false;

/*
 * CSV antigo de produtos.
 *
 * Ajuste somente se o nome/local do seu arquivo for diferente.
 */
const INPUT_PATH = path.resolve(
    __dirname,
    "./input/produto.csv",
);

const REPORTS_PATH = path.resolve(
    __dirname,
    "reports",
);

const EXECUTIONS_PATH = path.join(
    REPORTS_PATH,
    "executions",
);

const ERRORS_PATH = path.join(
    REPORTS_PATH,
    "errors",
);

/* =========================================================
 * TERMINAL
 * ========================================================= */

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

/* =========================================================
 * CATEGORIA MANUAL
 * ========================================================= */

async function askCategory(
    productName: string,
): Promise<"FRAME" | "LENS" | "ACCESSORY"> {
    console.log("\n----------------------------------------");
    console.log("CATEGORIA NÃO IDENTIFICADA");
    console.log("----------------------------------------");
    console.log(`Produto: ${productName}`);
    console.log("");
    console.log("[1] FRAME");
    console.log("[2] LENS");
    console.log("[3] ACCESSORY");

    while (true) {
        const answer = await ask("Escolha a categoria: ");

        switch (answer) {
            case "1":
                return "FRAME";

            case "2":
                return "LENS";

            case "3":
                return "ACCESSORY";

            default:
                console.log(
                    "Opção inválida. Digite 1, 2 ou 3.",
                );
        }
    }
}

/* =========================================================
 * MARCAS
 * ========================================================= */

interface BrandMappingRow {
    oldId: number;
    newId: number;
    oldName: string;
    newName: string;
}

function loadBrandMapping(): Map<number, BrandMappingRow> {
    const mappingPath = path.resolve(
        __dirname,
        "reports/mappings/01-brand-mapping.csv",
    );

    if (!fs.existsSync(mappingPath)) {
        throw new Error(
            `Mapping de marcas não encontrado:\n${mappingPath}`,
        );
    }

    const content = fs.readFileSync(
        mappingPath,
        "utf-8",
    );

    const lines = content
        .split(/\r?\n/)
        .filter(Boolean);

    const map = new Map<number, BrandMappingRow>();

    for (const line of lines.slice(1)) {
        const values = parseCsvLine(line);

        const oldId = Number(values[0]);
        const newId = Number(values[1]);

        if (
            !Number.isInteger(oldId) ||
            !Number.isInteger(newId)
        ) {
            continue;
        }

        map.set(oldId, {
            oldId,
            newId,
            oldName: values[3] ?? "",
            newName: values[4] ?? "",
        });
    }

    return map;
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            result.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}

/* =========================================================
 * RELATÓRIOS
 * ========================================================= */

function createTimestamp(): string {
    const now = new Date();

    return now
        .toISOString()
        .replace(/[:.]/g, "-");
}

function saveJson(
    directory: string,
    filename: string,
    data: unknown,
): void {
    fs.mkdirSync(directory, { recursive: true });

    fs.writeFileSync(
        path.join(directory, filename),
        JSON.stringify(data, null, 2),
        "utf-8",
    );
}

/* =========================================================
 * MAIN
 * ========================================================= */

async function main(): Promise<void> {
    const startedAt = new Date();

    console.log("\n========================================");
    console.log("MIGRAÇÃO DE PRODUTOS");
    console.log("========================================");
    console.log(`DRY_RUN: ${DRY_RUN}`);
    console.log(`Tenant: ${TENANT_ID}`);
    console.log(`Branch: ${BRANCH_ID}`);
    console.log(`Arquivo: ${INPUT_PATH}`);
    console.log("========================================\n");

    if (DRY_RUN) {
        console.log(
            "⚠️ DRY_RUN habilitado: nenhuma alteração será feita no banco ou nos mappings.\n",
        );
    } else {
        console.log(
            "⚠️ EXECUÇÃO REAL: alterações serão feitas no banco.\n",
        );
    }

    const products = loadProducts(INPUT_PATH);

    console.log(
        `Produtos carregados: ${products.length}\n`,
    );

    const brandMapping = loadBrandMapping();

    console.log(
        `Marcas no mapping: ${brandMapping.size}\n`,
    );

    const mappings: ProductMapping[] = [];

    const serviceMappings: ServiceMapping[] = [];

    const errors: unknown[] = [];
    const pendingRecords: unknown[] = [];

    let created = 0;
    let existing = 0;

    let servicesCreated = 0;
    let servicesExisting = 0;

    let pending = 0;

    for (const oldProduct of products) {
        try {
            const product = convertProduct(oldProduct);

            /*
             * =================================================
             * SERVIÇOS
             * =================================================
             *
             * Registros SERVICO são migrados para OpticalService,
             * não para Product.
             */

            const normalizedType = product.oldType
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();

            if (normalizedType === "SERVICO") {
                console.log(
                    `\n🔧 [SERVIÇO] ${product.name} (old_id=${product.oldId})`,
                );

                /*
                 * Procura serviço existente por:
                 *
                 * tenantId + name
                 */
                const existingService =
                    await prisma.opticalService.findFirst({
                        where: {
                            tenantId: TENANT_ID,
                            name: product.name,
                        },
                    });

                if (existingService) {
                    console.log(
                        `✓ SERVICE EXISTING | ${product.name} | new_id=${existingService.id}`,
                    );

                    serviceMappings.push({
                        oldId: product.oldId,
                        newId: existingService.id,
                        status: "EXISTING",
                        oldName: product.name,
                        newName: existingService.name,
                    });

                    servicesExisting++;

                    continue;
                }

                /*
                 * DRY_RUN:
                 *
                 * Simula a criação, mas NÃO cria registro
                 * e NÃO adiciona nada ao mapping.
                 */
                if (DRY_RUN) {
                    console.log(
                        `→ SERVICE CREATE [DRY_RUN] | ${product.name} | price=${product.salePrice}`,
                    );

                    servicesCreated++;

                    continue;
                }

                /*
                 * Execução real:
                 * cria o OpticalService.
                 */
                const createdService =
                    await prisma.opticalService.create({
                        data: {
                            name: product.name,
                            description: null,
                            price: product.salePrice,
                            isActive: true,
                            tenantId: TENANT_ID,
                            branchId: BRANCH_ID,
                        },
                    });

                console.log(
                    `✓ SERVICE CREATED | ${product.name} | new_id=${createdService.id}`,
                );

                serviceMappings.push({
                    oldId: product.oldId,
                    newId: createdService.id,
                    status: "CREATED",
                    oldName: product.name,
                    newName: createdService.name,
                });

                servicesCreated++;

                continue;
            }

            /*
             * =================================================
             * PRODUTOS
             * =================================================
             */

            /*
             * Categoria automática ou manual.
             */
            let category = product.category;

            if (!category) {
                category = await askCategory(product.name);

                console.log(
                    `Categoria escolhida: ${category}\n`,
                );
            }

            /*
             * Marca.
             *
             * Caso não tenha marca:
             * procura o old_id 1, que no mapping corresponde
             * à "SEM MARCA".
             */
            const brandOldId = product.brandOldId ?? 1;

            const brand = brandMapping.get(brandOldId);

            if (!brand) {
                throw new Error(
                    `Marca antiga ${brandOldId} não encontrada no 01-brand-mapping.csv.`,
                );
            }

            const brandNewId = brand.newId;

            /*
             * Procura produto existente por:
             *
             * tenantId + name + brandId
             */
            const existingProduct =
                await prisma.product.findFirst({
                    where: {
                        tenantId: TENANT_ID,
                        name: product.name,
                        brandId: brandNewId,
                    },
                });

            if (existingProduct) {
                console.log(
                    `✓ EXISTING | ${product.name} | marca=${brand.newName} | new_id=${existingProduct.id}`,
                );

                mappings.push({
                    oldId: product.oldId,
                    newId: existingProduct.id,
                    status: "EXISTING",
                    oldName: product.name,
                    newName: existingProduct.name,
                    brandOldId,
                    brandNewId,
                    category,
                });

                existing++;
                continue;
            }

            /*
             * Produto novo.
             */
            if (DRY_RUN) {
                console.log(
                    `→ CREATE [DRY_RUN] | ${product.name} | marca=${brand.newName} | categoria=${category}`,
                );

                /*
                 * IMPORTANTE:
                 *
                 * No DRY_RUN não adicionamos mapping.
                 */
                created++;

                continue;
            }

            const createdProduct =
                await prisma.product.create({
                    data: {
                        name: product.name,
                        description: null,
                        costPrice: product.costPrice,
                        markup: product.markup,
                        salePrice: product.salePrice,
                        stockQuantity: product.stockQuantity,
                        minimumStock: 0,
                        category,
                        isActive: true,
                        tenantId: TENANT_ID,
                        branchId: null,
                        brandId: brandNewId,
                    },
                });

            console.log(
                `✓ CREATED | ${product.name} | marca=${brand.newName} | categoria=${category} | new_id=${createdProduct.id}`,
            );

            mappings.push({
                oldId: product.oldId,
                newId: createdProduct.id,
                status: "CREATED",
                oldName: product.name,
                newName: createdProduct.name,
                brandOldId,
                brandNewId,
                category,
            });

            created++;
        } catch (error) {
            console.error(
                `✗ ERROR | old_id=${oldProduct.prodId} | ${oldProduct.prodNome}`,
            );

            console.error(error);

            errors.push({
                oldId: oldProduct.prodId,
                name: oldProduct.prodNome,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });
        }
    }

    const finishedAt = new Date();

    /*
     * =========================================================
     * MAPPINGS
     * =========================================================
     *
     * Mapping só é salvo em execução REAL.
     *
     * DRY_RUN:
     * - não cria
     * - não altera
     * - não sobrescreve
     * - não cria arquivo temporário
     *
     * Execução real:
     * - salva somente se não houver erros
     * - preserva o último mapping válido em caso de erro
     */

    if (errors.length === 0) {
        if (!DRY_RUN) {
            saveProductMapping(mappings);

            saveServiceMapping(serviceMappings);

            console.log(
                "\n✓ Mapping de produtos atualizado com sucesso.",
            );

            console.log(
                "✓ Mapping de serviços atualizado com sucesso.",
            );
        } else {
            console.log(
                "\n✓ DRY_RUN finalizado. Nenhum mapping foi criado ou alterado.",
            );
        }
    } else {
        console.log(
            "\n⚠️ Existem erros. Os mappings anteriores NÃO serão substituídos.",
        );
    }

    /*
     * =========================================================
     * RELATÓRIO DE ERROS / PENDING
     * =========================================================
     */

    if (errors.length > 0 || pendingRecords.length > 0) {
        saveJson(
            ERRORS_PATH,
            `02-product-errors-${createTimestamp()}.json`,
            {
                pending: pendingRecords,
                errors,
            },
        );
    }

    /*
     * =========================================================
     * RELATÓRIO DA EXECUÇÃO
     * =========================================================
     */

    saveJson(
        EXECUTIONS_PATH,
        `02-product-${createTimestamp()}.json`,
        {
            migration: "02-product",
            tenantId: TENANT_ID,
            branchId: BRANCH_ID,
            dryRun: DRY_RUN,
            startedAt,
            finishedAt,
            durationMs:
                finishedAt.getTime() -
                startedAt.getTime(),

            total: products.length,

            products: {
                created,
                existing,
            },

            services: {
                created: servicesCreated,
                existing: servicesExisting,
            },

            pending,

            errors: errors.length,

            productMappingSaved:
                errors.length === 0 && !DRY_RUN,

            serviceMappingSaved:
                errors.length === 0 && !DRY_RUN,
        },
    );

    /*
     * =========================================================
     * RESUMO
     * =========================================================
     */

    console.log("\n========================================");
    console.log("RESUMO");
    console.log("========================================");

    console.log(`Total:              ${products.length}`);

    console.log("");
    console.log("PRODUTOS");
    console.log(`Created:            ${created}`);
    console.log(`Existing:           ${existing}`);

    console.log("");
    console.log("SERVIÇOS");
    console.log(`Created:            ${servicesCreated}`);
    console.log(`Existing:           ${servicesExisting}`);

    console.log("");
    console.log(`Pending:            ${pending}`);
    console.log(`Errors:             ${errors.length}`);

    console.log("");
    console.log(
        `Product mapping:    ${errors.length === 0 && !DRY_RUN
            ? "SALVO"
            : "NÃO SALVO"
        }`,
    );

    console.log(
        `Service mapping:    ${errors.length === 0 && !DRY_RUN
            ? "SALVO"
            : "NÃO SALVO"
        }`,
    );

    console.log("========================================\n");
}

/* =========================================================
 * FINALIZAÇÃO
 * ========================================================= */

main()
    .catch((error) => {
        console.error("\nERRO FATAL:");
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        rl.close();
        await prisma.$disconnect();
    });