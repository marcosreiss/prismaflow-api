export interface MigrationError {
    name: string;
    message: string;
    stack?: string;
}

export interface MigrationExecutionReport {
    entity: string;
    tenantId: string;
    dryRun: boolean;

    startedAt: string;
    finishedAt: string;
    durationMs: number;

    total: number;
    created: number;
    existing: number;
    errors: number;
}

export interface MigrationContext {
    tenantId: string;
    branchId: string | null;
    dryRun: boolean;
}