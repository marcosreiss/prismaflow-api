import fs from "node:fs";
import path from "node:path";

export interface MigrationLogger {
    info(message: string): void;
    success(message: string): void;
    warning(message: string): void;
    error(message: string): void;
}

interface CreateLoggerOptions {
    entity: string;
    entityReportsDir: string;
    executionTimestamp?: string;
}

export function createMigrationLogger(
    options: CreateLoggerOptions
): MigrationLogger {
    const {
        entity,
        entityReportsDir,
        executionTimestamp,
    } = options;

    const logsDir = path.join(
        entityReportsDir,
        entity,
        "logs"
    );

    fs.mkdirSync(logsDir, {
        recursive: true,
    });

    const timestamp =
        executionTimestamp ??
        formatTimestamp(new Date());

    const logFilePath = path.join(
        logsDir,
        `${entity}-log-${timestamp}.txt`
    );

    fs.writeFileSync(
        logFilePath,
        "",
        "utf-8"
    );

    function write(
        level: string,
        message: string
    ): void {
        const timestamp = new Date()
            .toISOString()
            .substring(11, 19);

        const formatted =
            `[${timestamp}] [${level}] ${message}`;

        console.log(formatted);

        fs.appendFileSync(
            logFilePath,
            formatted + "\n",
            "utf-8"
        );
    }

    return {
        info(message: string) {
            write("INFO", message);
        },

        success(message: string) {
            write("SUCESSO", message);
        },

        warning(message: string) {
            write("AVISO", message);
        },

        error(message: string) {
            write("ERRO", message);
        },
    };
}

function formatTimestamp(date: Date): string {
    return date
        .toISOString()
        .replace("T", "-")
        .replace(/:/g, "-")
        .replace(/\..+/, "");
}