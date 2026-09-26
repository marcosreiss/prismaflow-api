import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function getArgument(
    flag: string
): string | undefined {
    const index = process.argv.indexOf(flag);

    if (index === -1) {
        return undefined;
    }

    return process.argv[index + 1];
}

const tenant = getArgument("-t");
const entity = getArgument("-e");

if (!tenant || !entity) {
    console.error(
        "Uso: npm run migration -- -t <tenant> -e <entity>"
    );

    console.error(
        "Exemplo: npm run migration -- -t oticacrista -e brand"
    );

    process.exit(1);
}

const migrationDir = path.resolve(
    process.cwd(),
    "migrations",
    tenant
);

const migrationFile = path.join(
    migrationDir,
    `01-${entity}.ts`
);

if (!fs.existsSync(migrationDir)) {
    console.error(
        `Migração não encontrada: ${migrationDir}`
    );

    process.exit(1);
}

if (!fs.existsSync(migrationFile)) {
    console.error(
        `Entidade não encontrada: ${migrationFile}`
    );

    process.exit(1);
}

console.log("");
console.log("=================================");
console.log(" EXECUTOR DE MIGRAÇÃO");
console.log("=================================");
console.log(`Migração: ${tenant}`);
console.log(`Entidade: ${entity}`);
console.log(`Arquivo:  ${migrationFile}`);
console.log("");

const result = spawnSync(
    "npx",
    [
        "tsx",
        migrationFile,
    ],
    {
        stdio: "inherit",
        shell: true,
    }
);

if (result.error) {
    console.error(
        "Erro ao executar a migração:",
        result.error
    );

    process.exit(1);
}

process.exit(
    result.status ?? 1
);