import type { Client } from "@prisma/client";
import { isComparable, normalizeDigits, normalizeName, normalizeRg } from "./client.converter";
import type { ClientSource } from "./client.loader";
import type { ClientIndexes } from "./client.index";

export type MatchCriterion = "CPF" | "RG_NOME" | "TELEFONE_NOME";

export interface ClientMatch {
    client: Client | null;
    matchedBy: MatchCriterion | null;
    ambiguous: boolean;
    reason: string | null;
}

function uniqueClients(clients: Client[]): Client[] {
    return [...new Map(clients.map((client) => [client.id, client])).values()];
}

export function findClientMatch(source: ClientSource, indexes: ClientIndexes): ClientMatch {
    const name = normalizeName(source.pesNome);
    const checks: Array<{ criterion: MatchCriterion; candidates: Client[] }> = [];

    const cpf = normalizeDigits(source.pesDoc);
    if (cpf) checks.push({ criterion: "CPF", candidates: indexes.byCpf.get(cpf) ?? [] });

    const rg = normalizeRg(source.cliRg);
    if (rg && name) checks.push({ criterion: "RG_NOME", candidates: indexes.byRgAndName.get(`${rg}|${name}`) ?? [] });

    const phones = [source.pesCel, source.pesTel]
        .filter(isComparable)
        .map(normalizeDigits)
        .filter((phone): phone is string => !!phone);
    if (name && phones.length) {
        const candidates = phones.flatMap((phone) => indexes.byPhoneAndName.get(`${phone}|${name}`) ?? []);
        checks.push({ criterion: "TELEFONE_NOME", candidates: uniqueClients(candidates) });
    }

    const matches = checks
        .map(({ criterion, candidates }) => ({ criterion, candidates: uniqueClients(candidates) }))
        .filter(({ candidates }) => candidates.length > 0);

    const ambiguousCriteria = matches.filter(({ candidates }) => candidates.length > 1);
    if (ambiguousCriteria.length) {
        return {
            client: null,
            matchedBy: null,
            ambiguous: true,
            reason: `Mais de um cliente corresponde a: ${ambiguousCriteria.map(({ criterion }) => criterion).join(", ")}.`,
        };
    }

    const matchedIds = new Set(matches.flatMap(({ candidates }) => candidates.map(({ id }) => id)));
    if (matchedIds.size > 1) {
        return {
            client: null,
            matchedBy: null,
            ambiguous: true,
            reason: `Critérios diferentes apontam para clientes distintos (${matches.map(({ criterion, candidates }) => `${criterion}=${candidates[0].id}`).join("; ")}).`,
        };
    }

    if (!matchedIds.size) return { client: null, matchedBy: null, ambiguous: false, reason: null };
    const match = matches.find(({ candidates }) => candidates.length === 1)!;
    return { client: match.candidates[0], matchedBy: match.criterion, ambiguous: false, reason: null };
}
