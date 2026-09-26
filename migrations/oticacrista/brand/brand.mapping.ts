// migrations/oticacrista/brands/brand.mapping.ts

import fs from "node:fs";
import path from "node:path";

export interface BrandMapping {
    oldId: number;
    newId: number | null;
    status: "CREATED" | "EXISTING";
    oldName: string;
    newName: string;
}

export function saveBrandMapping(
    mappings: BrandMapping[]
): void {
    const outputDir = path.resolve(
        process.cwd(),
        "migrations/oticacrista/reports/mappings"
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const finalPath = path.join(
        outputDir,
        "01-brand-mapping.csv"
    );

    /*
     * Escrevemos primeiro em um arquivo temporário.
     *
     * Somente depois que o conteúdo estiver completamente
     * escrito substituímos o mapping definitivo.
     */
    const tempPath = `${finalPath}.tmp`;

    const header = "old_id,new_id,status,old_name,new_name\n";

    const rows = mappings.map((mapping) => {
        return [
            mapping.oldId,
            mapping.newId ?? "",
            mapping.status,
            csvEscape(mapping.oldName),
            csvEscape(mapping.newName),
        ].join(",");
    });

    fs.writeFileSync(
        tempPath,
        header + rows.join("\n"),
        "utf-8"
    );

    fs.renameSync(tempPath, finalPath);

    console.log(`Mapeamento salvo em: ${finalPath}`);
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