// gerar o CSV de correspondência
import fs from "node:fs";
import path from "node:path";

export interface BrandMapping {
    oldId: number;
    newId: number;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
}

export function saveBrandMapping(
    mappings: BrandMapping[],
    timestamp: string
): void {
    const outputDir = path.resolve(
        process.cwd(),
        "migrations/oticacrista/08-2026/reports/mappings"
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const filePath = path.join(
        outputDir,
        `01-brand-mapping-${timestamp}.csv`
    );

    const header = "old_id,new_id,status,old_name,new_name\n";

    const rows = mappings.map((mapping) => {
        return [
            mapping.oldId,
            mapping.newId,
            mapping.status,
            csvEscape(mapping.oldName),
            csvEscape(mapping.newName),
        ].join(",");
    });

    fs.writeFileSync(filePath, header + rows.join("\n"), "utf-8");

    console.log(`Mapeamento salvo em: ${filePath}`);
}

function csvEscape(value: string): string {
    if (
        value.includes(",") ||
        value.includes('"') ||
        value.includes("\n")
    ) {
        return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
}