import fs from "fs";
import path from "path";
import readline from "readline";

import { prisma } from "../../../src/config/prisma";

import { loadProducts } from "./loaders/product.loader";
import { convertProduct } from "./converters/product.converter";

import {
    saveProductMapping,
    type ProductMapping,
} from "./mapping/product.mapping";

/* =========================================================
 * CONFIGURAÇÃO
 * ========================================================= */

const TENANT_ID = "cmibvcyed00007m0118rkgft8";

/*
 * false = execução real
 * true  = apenas simulação
 */
const DRY_RUN = true;

/*
 * CSV antigo de produtos.
 *
 * Ajuste somente se o nome/local do seu arquivo for diferente.
 */
const INPUT_PATH = path.resolve(
    __dirname,
    "../../../../input/produto.csv",
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
    console.log(`Arquivo: ${INPUT_PATH}`);
    console.log("========================================\n");

    if (DRY_RUN) {
        console.log(
            "⚠️ DRY_RUN habilitado: nenhuma alteração será feita no banco.\n",
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

    const errors: unknown[] = [];

    let created = 0;
    let existing = 0;
    let pending = 0;

    for (const oldProduct of products) {
        try {
            const product = convertProduct(oldProduct);

            /*
             * SERVIÇO não será tratado como Product.
             */
            const normalizedType = product.oldType
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase()
                .trim();

            if (normalizedType === "SERVICO") {
                console.log(
                    `\n⏭️ [SERVIÇO] ${product.name} (old_id=${product.oldId})`,
                );

                mappings.push({
                    oldId: product.oldId,
                    newId: null,
                    status: "PENDING",
                    oldName: product.name,
                    newName: product.name,
                    brandOldId: product.brandOldId,
                    brandNewId: null,
                    category: null,
                });

                pending++;
                continue;
            }

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

                mappings.push({
                    oldId: product.oldId,
                    newId: null,
                    status: "CREATED",
                    oldName: product.name,
                    newName: product.name,
                    brandOldId,
                    brandNewId,
                    category,
                });

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
     * Mapping só é salvo se NÃO houver erros.
     *
     * Isso protege o último mapping válido.
     */
    if (errors.length === 0) {
        if (!DRY_RUN) {
            saveProductMapping(mappings);

            console.log(
                "\n✓ Mapping de produtos atualizado com sucesso.",
            );
        } else {
            console.log(
                "\n✓ DRY_RUN finalizado. Mapping não foi alterado.",
            );
        }
    } else {
        console.log(
            "\n⚠️ Existem erros. O mapping anterior NÃO será substituído.",
        );
    }

    /*
     * Relatório de erros
     */
    if (errors.length > 0) {
        saveJson(
            ERRORS_PATH,
            `02-product-errors-${createTimestamp()}.json`,
            errors,
        );
    }

    /*
     * Relatório da execução
     */
    saveJson(
        EXECUTIONS_PATH,
        `02-product-${createTimestamp()}.json`,
        {
            migration: "02-product",
            tenantId: TENANT_ID,
            dryRun: DRY_RUN,
            startedAt,
            finishedAt,
            durationMs:
                finishedAt.getTime() -
                startedAt.getTime(),
            total: products.length,
            created,
            existing,
            pending,
            errors: errors.length,
            mappingSaved:
                errors.length === 0 && !DRY_RUN,
        },
    );

    console.log("\n========================================");
    console.log("RESUMO");
    console.log("========================================");
    console.log(`Total:     ${products.length}`);
    console.log(`Created:   ${created}`);
    console.log(`Existing:  ${existing}`);
    console.log(`Pending:   ${pending}`);
    console.log(`Errors:    ${errors.length}`);
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