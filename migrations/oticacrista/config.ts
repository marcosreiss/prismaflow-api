import dotenv from "dotenv";
import path from "node:path";

const envPath = path.resolve(
    process.cwd(),
    "migrations/oticacrista/.env"
);

dotenv.config({
    path: envPath,
});

function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Variável de ambiente obrigatória não definida: ${name}`
        );
    }

    return value;
}

function booleanEnv(name: string, defaultValue = false): boolean {
    const value = process.env[name];

    if (value === undefined) {
        return defaultValue;
    }

    return value.toLowerCase() === "true";
}

const projectRoot = process.cwd();

export const migrationConfig = {
    tenantId: requiredEnv("MIGRATION_TENANT_ID"),

    branchId: requiredEnv("MIGRATION_BRANCH_ID"),

    inputDir: path.resolve(
        projectRoot,
        process.env.MIGRATION_INPUT_DIR ||
        "./migrations/oticacrista/input"
    ),

    reportsDir: path.resolve(
        projectRoot,
        process.env.MIGRATION_REPORTS_DIR ||
        "./migrations/oticacrista/reports"
    ),

    dryRun: booleanEnv("MIGRATION_DRY_RUN", false),
} as const;