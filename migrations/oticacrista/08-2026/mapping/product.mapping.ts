//migrations/oticacrista/08-2026/mapping/product.mapping.ts

import fs from "fs";
import path from "path";

export interface ProductMapping {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING" | "PENDING";
    oldName: string;
    newName: string;
    brandOldId: number | null;
    brandNewId: number | null;
    category: string | null;
}

const MAPPING_PATH = path.resolve(
    __dirname,
    "../reports/mappings/02-product-mapping.csv",
);

function escapeCsv(value: string | number | null): string {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);

    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
    ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

export function saveProductMapping(
    mappings: ProductMapping[],
): void {
    const directory = path.dirname(MAPPING_PATH);

    fs.mkdirSync(directory, { recursive: true });

    const header =
        "old_id,new_id,status,old_name,new_name,brand_old_id,brand_new_id,category";

    const rows = mappings.map((mapping) =>
        [
            mapping.oldId,
            mapping.newId,
            mapping.status,
            mapping.oldName,
            mapping.newName,
            mapping.brandOldId,
            mapping.brandNewId,
            mapping.category,
        ]
            .map(escapeCsv)
            .join(","),
    );

    const content = [header, ...rows].join("\n");

    const temporaryPath = `${MAPPING_PATH}.tmp`;

    fs.writeFileSync(temporaryPath, content, "utf-8");

    fs.renameSync(temporaryPath, MAPPING_PATH);
}

export function getProductMappingPath(): string {
    return MAPPING_PATH;
}