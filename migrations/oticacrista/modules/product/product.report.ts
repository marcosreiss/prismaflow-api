// migrations/oticacrista/product/product.report.ts

import fs from "node:fs";
import path from "node:path";

import { createMappingWriter } from "@migrations/oticacrista/shared/mapping";
import { formatTimestamp, serializeError } from "@migrations/oticacrista/shared/utils";
import type { MigrationExecutionReport } from "@migrations/oticacrista/shared/types";
import type { OldProduct } from "./product.loader";

const PRODUCT_MAPPING_HEADER =
    "old_id,new_id,status,old_name,new_name,brand_old_id,brand_new_id,category";

const SERVICE_MAPPING_HEADER =
    "old_id,new_id,status,old_name,new_name";

export interface ProductMappingRow {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
    brandOldId: number;
    brandNewId: number;
    category: string;
}

export interface ServiceMappingRow {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
}

interface SaveProductErrorOptions {
    product: OldProduct;
    error: unknown;
}

interface ProductReportOptions {
    entityReportsDir: string;
    mappingsDir: string;
}

export function createProductReport(options: ProductReportOptions) {
    const errorsDir = path.join(options.entityReportsDir, "errors");
    const executionsDir = path.join(options.entityReportsDir, "executions");

    fs.mkdirSync(errorsDir, { recursive: true });
    fs.mkdirSync(executionsDir, { recursive: true });

    const productMapping = createMappingWriter(options.mappingsDir, "product");
    const serviceMapping = createMappingWriter(options.mappingsDir, "service");

    /*
     * Escrita incremental: chamado uma vez, antes do loop,
     * apenas quando dryRun = false.
     */
    function startMappings(): void {
        productMapping.create(PRODUCT_MAPPING_HEADER);
        serviceMapping.create(SERVICE_MAPPING_HEADER);
    }

    function appendProductMapping(row: ProductMappingRow): void {
        productMapping.append([
            row.oldId,
            row.newId,
            row.status,
            row.oldName,
            row.newName,
            row.brandOldId,
            row.brandNewId,
            row.category,
        ]);
    }

    function appendServiceMapping(row: ServiceMappingRow): void {
        serviceMapping.append([
            row.oldId,
            row.newId,
            row.status,
            row.oldName,
            row.newName,
        ]);
    }

    function finalizeMappings(): void {
        productMapping.finalize();
        serviceMapping.finalize();
    }

    function discardMappings(): void {
        productMapping.discard();
        serviceMapping.discard();
    }

    function saveError({ product, error }: SaveProductErrorOptions): void {
        const timestamp = formatTimestamp(new Date());

        const fileName = `product-error-${product.prodId}-${timestamp}.json`;

        const errorData = {
            entity: "Product",
            oldId: product.prodId,
            oldName: product.prodNome,
            occurredAt: new Date().toISOString(),
            error: serializeError(error),
        };

        fs.writeFileSync(
            path.join(errorsDir, fileName),
            JSON.stringify(errorData, null, 2),
            "utf-8",
        );
    }

    function saveExecution(report: MigrationExecutionReport): void {
        const timestamp = formatTimestamp(new Date(report.finishedAt));

        const fileName = `product-execution-${timestamp}.json`;

        fs.writeFileSync(
            path.join(executionsDir, fileName),
            JSON.stringify(report, null, 2),
            "utf-8",
        );
    }

    return {
        startMappings,
        appendProductMapping,
        appendServiceMapping,
        finalizeMappings,
        discardMappings,
        saveError,
        saveExecution,
    };
}