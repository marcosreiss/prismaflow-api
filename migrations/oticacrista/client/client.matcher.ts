// migrations/oticacrista/client/client.matcher.ts

import type { Client } from "@prisma/client";

import type { ClientSource } from "./client.loader";
import {
    normalizeCpf,
    normalizeName,
    normalizePhone,
    normalizeRg,
    parseDate,
} from "./client.converter";
import {
    getClientCandidates,
    normalizeClientDate,
    type ClientIndexes,
} from "./client.index";

export type MatchCriterion = "CPF" | "RG" | "BIRTH_DATE" | "PHONE";

export interface ClientMatchResult {
    client: Client | null;
    /**
     * Critério que resultou no match, ou "PENDING" quando nenhum
     * critério encontrou correspondência segura (0 ou 2+ candidatos).
     */
    matchedBy: MatchCriterion | "PENDING";
    /**
     * Preenchido apenas quando matchedBy = "PENDING" e pelo menos um
     * critério encontrou candidatos ambíguos (2+) — ajuda a entender,
     * no relatório, por que o registro não pôde ser resolvido.
     */
    ambiguousBy: MatchCriterion[];
}

function findUnique(candidates: Client[] | undefined): Client | null {
    if (!candidates || candidates.length !== 1) {
        return null;
    }

    return candidates[0];
}

/**
 * Estratégia de matching em cascata: CPF+nome → RG+nome →
 * data de nascimento+nome → celular+nome.
 *
 * Cada critério com 0 candidatos simplesmente passa para o próximo.
 * Cada critério com 2+ candidatos (ambíguo) também passa para o
 * próximo — a ambiguidade é registrada em `ambiguousBy`, mas não
 * interrompe a busca, pois um critério mais forte adiante pode
 * resolver o que este não resolveu.
 *
 * Só retorna PENDING quando todos os critérios se esgotarem sem
 * uma correspondência única.
 */
export function findClientMatch(
    source: ClientSource,
    indexes: ClientIndexes,
): ClientMatchResult {
    const { pessoa, cliente } = source;

    const ambiguousBy: MatchCriterion[] = [];

    const name = normalizeName(pessoa.pesNome);

    if (!name) {
        return { client: null, matchedBy: "PENDING", ambiguousBy };
    }

    /*
     * 1. NOME + CPF
     */
    const cpf = normalizeCpf(pessoa.pesDoc);

    if (cpf) {
        const candidates = getClientCandidates(indexes.cpfIndex, pessoa.pesNome, cpf);
        const client = findUnique(candidates);

        if (client) {
            return { client, matchedBy: "CPF", ambiguousBy };
        }

        if (candidates && candidates.length > 1) {
            ambiguousBy.push("CPF");
        }
    }

    /*
     * 2. NOME + RG
     */
    const rg = normalizeRg(cliente.cliRg);

    if (rg) {
        const candidates = getClientCandidates(indexes.rgIndex, pessoa.pesNome, rg);
        const client = findUnique(candidates);

        if (client) {
            return { client, matchedBy: "RG", ambiguousBy };
        }

        if (candidates && candidates.length > 1) {
            ambiguousBy.push("RG");
        }
    }

    /*
     * 3. NOME + DATA DE NASCIMENTO
     */
    const bornDate = parseDate(pessoa.pesDataNasc);
    const birthDate = normalizeClientDate(bornDate);

    if (birthDate) {
        const candidates = getClientCandidates(
            indexes.birthDateIndex,
            pessoa.pesNome,
            birthDate,
        );

        const client = findUnique(candidates);

        if (client) {
            return { client, matchedBy: "BIRTH_DATE", ambiguousBy };
        }

        if (candidates && candidates.length > 1) {
            ambiguousBy.push("BIRTH_DATE");
        }
    }

    /*
     * 4. NOME + CELULAR
     */
    const phone = normalizePhone(pessoa.pesCel);

    if (phone) {
        const candidates = getClientCandidates(
            indexes.phoneIndex,
            pessoa.pesNome,
            phone,
        );

        const client = findUnique(candidates);

        if (client) {
            return { client, matchedBy: "PHONE", ambiguousBy };
        }

        if (candidates && candidates.length > 1) {
            ambiguousBy.push("PHONE");
        }
    }

    return { client: null, matchedBy: "PENDING", ambiguousBy };
}