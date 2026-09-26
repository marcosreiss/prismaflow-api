export function formatTimestamp(date: Date): string {
    return date
        .toISOString()
        .replace("T", "-")
        .replace(/:/g, "-")
        .replace(/\..+/, "");
}

export function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return String(error);
}