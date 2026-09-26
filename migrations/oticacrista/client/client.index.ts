// migrations/oticacrista/client/client.index.ts

import type { Client } from "@prisma/client";

import {
    normalizeCpf,
    normalizeName,
    normalizePhone,
    normalizeRg,
} from "./client.converter";

export interface ClientIndexes {
    cpfIndex: Map<string, Client[]>;
    rgIndex: Map<string, Client[]>;
    birthDateIndex: Map<string, Client[]>;
    phoneIndex: Map<string, Client[]>;
}

function buildKey(name: string, value: string): string {
    return `${normalizeName(name)}|${value}`;
}

function addToIndex(
    index: Map<string, Client[]>,
    key: string,
    client: Client,
): void {
    const current = index.get(key);

    if (current) {
        current.push(client);
        return;
    }

    index.set(key, [client]);
}

function normalizeDate(value: Date | null): string | null {
    if (!value) {
        return null;
    }

    return value.toISOString().slice(0, 10);
}

/**
 * Constrói os índices em memória a partir dos clientes já existentes
 * no banco (chamado uma vez, no início da execução).
 */
export function buildClientIndexes(clients: Client[]): ClientIndexes {
    const indexes: ClientIndexes = {
        cpfIndex: new Map(),
        rgIndex: new Map(),
        birthDateIndex: new Map(),
        phoneIndex: new Map(),
    };

    for (const client of clients) {
        addClientToIndexes(client, indexes);
    }

    return indexes;
}

/**
 * Adiciona um cliente (recém-criado ou já existente) aos índices.
 *
 * Importante: isso é chamado também depois de CADA criação durante o
 * loop da migração — não só na carga inicial. Isso garante que, se o
 * CSV de origem tiver registros duplicados (ex.: mesma pessoa com dois
 * oldId diferentes), o segundo registro encontre o primeiro que acabou
 * de ser criado nesta mesma execução, em vez de criar um duplicado.
 */
export function addClientToIndexes(
    client: Client,
    indexes: ClientIndexes,
): void {
    if (client.cpf) {
        const cpf = normalizeCpf(client.cpf);

        if (cpf) {
            addToIndex(indexes.cpfIndex, buildKey(client.name, cpf), client);
        }
    }

    if (client.rg) {
        const rg = normalizeRg(client.rg);

        if (rg) {
            addToIndex(indexes.rgIndex, buildKey(client.name, rg), client);
        }
    }

    if (client.bornDate) {
        const date = normalizeDate(client.bornDate);

        if (date) {
            addToIndex(
                indexes.birthDateIndex,
                buildKey(client.name, date),
                client,
            );
        }
    }

    for (const phone of [client.phone01, client.phone02, client.phone03]) {
        const normalized = normalizePhone(phone);

        if (!normalized) {
            continue;
        }

        addToIndex(indexes.phoneIndex, buildKey(client.name, normalized), client);
    }
}

export function normalizeClientDate(value: Date | null): string | null {
    return normalizeDate(value);
}

export function getClientCandidates(
    index: Map<string, Client[]>,
    name: string,
    value: string,
): Client[] | undefined {
    return index.get(buildKey(name, value));
}