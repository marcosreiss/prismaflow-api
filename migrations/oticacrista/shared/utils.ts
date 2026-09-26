export function formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Fortaleza",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    })
        .format(date)
        .replace(" ", "-")
        .replace(/:/g, "-")
        .replace(",", "");
}

export function formatTime(date: Date): string {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).format(date);
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