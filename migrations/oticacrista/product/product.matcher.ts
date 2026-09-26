// migrations/oticacrista/product/product.matcher.ts

import readline from "node:readline";

import type { MappingRow } from "../shared/mapping";
import type { ConvertedProduct } from "./product.converter";

/* =========================================================
 * MARCA
 * ========================================================= */

const NO_BRAND_OLD_ID = 1;

export interface ResolvedBrand {
    brandOldId: number;
    brandNewId: number;
    brandName: string;
}

/**
 * Resolve a marca do produto no mapping já migrado de Brand.
 * Produto sem marca definida cai no old_id 1 ("SEM MARCA").
 */
export function resolveBrand(
    product: ConvertedProduct,
    brandMapping: Map<number, MappingRow>,
): ResolvedBrand {
    const brandOldId = product.brandOldId ?? NO_BRAND_OLD_ID;

    const brand = brandMapping.get(brandOldId);

    if (!brand) {
        throw new Error(
            `Marca antiga ${brandOldId} não encontrada no mapping de brand.`,
        );
    }

    return {
        brandOldId,
        brandNewId: brand.newId,
        brandName: brand.newName,
    };
}

/* =========================================================
 * CATEGORIA MANUAL
 * ========================================================= *
 *
 * Quando o converter não identifica a categoria automaticamente,
 * a decisão exige julgamento humano (não há regra determinística
 * segura no nome do produto) — por isso a pergunta acontece aqui,
 * de forma pontual, e não no orquestrador nem no converter.
 */

let rl: readline.Interface | null = null;

function getReadline(): readline.Interface {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    return rl;
}

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        getReadline().question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

export async function resolveCategory(
    product: ConvertedProduct,
): Promise<"FRAME" | "LENS" | "ACCESSORY"> {
    if (product.category) {
        return product.category as "FRAME" | "LENS" | "ACCESSORY";
    }

    console.log("\n----------------------------------------");
    console.log("CATEGORIA NÃO IDENTIFICADA");
    console.log("----------------------------------------");
    console.log(`Produto: ${product.name}`);
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
                console.log("Opção inválida. Digite 1, 2 ou 3.");
        }
    }
}

export function closeMatcherPrompt(): void {
    rl?.close();
    rl = null;
}