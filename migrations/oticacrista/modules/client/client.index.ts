import type { Client } from "@prisma/client";
import { normalizeDigits, normalizeName, normalizeRg } from "./client.converter";

export interface ClientIndexes {
    byCpf: Map<string, Client[]>;
    byRgAndName: Map<string, Client[]>;
    byPhoneAndName: Map<string, Client[]>;
}

function add(index: Map<string, Client[]>, key: string | null, client: Client): void {
    if (!key) return;
    const values = index.get(key) ?? [];
    if (!values.some((value) => value.id === client.id)) values.push(client);
    index.set(key, values);
}

function nameKey(name: string | null): string | null {
    return name ? name : null;
}

function compoundKey(value: string | null, name: string | null): string | null {
    return value && name ? `${value}|${name}` : null;
}

export function buildClientIndexes(clients: Client[]): ClientIndexes {
    const indexes: ClientIndexes = { byCpf: new Map(), byRgAndName: new Map(), byPhoneAndName: new Map() };
    for (const client of clients) addClientToIndexes(client, indexes);
    return indexes;
}

export function addClientToIndexes(client: Client, indexes: ClientIndexes): void {
    const name = nameKey(normalizeName(client.name));
    add(indexes.byCpf, normalizeDigits(client.cpf), client);
    add(indexes.byRgAndName, compoundKey(normalizeRg(client.rg), name), client);
    for (const phone of [client.phone01, client.phone02, client.phone03]) {
        add(indexes.byPhoneAndName, compoundKey(normalizeDigits(phone), name), client);
    }
}
