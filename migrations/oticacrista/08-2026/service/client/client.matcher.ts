// migrations/oticacrista/08-2026/service/client/client.matcher.ts
/**
 * Responsável por responder: esse cliente antigo corresponde a qual cliente novo?
 */

import type { Client } from "@prisma/client";

import type { ClientSource } from "../../loaders/pesCliente.loader";

import {
    convertClient,
    normalizeCpf,
    normalizeName,
    normalizePhone,
    normalizeRg,
} from "../../converters/client.converter";

import {
    getClientCandidates,
    normalizeClientDate,
    type ClientIndexes,
} from "./client.index";

export interface ClientMatchResult {
    client: Client | null;
    matchedBy:
    | "CPF"
    | "RG"
    | "BIRTH_DATE"
    | "PHONE"
    | "PENDING";
}

function findUnique(
    candidates:
        | Client[]
        | undefined,
): Client | null {
    if (
        !candidates ||
        candidates.length !== 1
    ) {
        return null;
    }

    return candidates[0];
}

export function findClientMatch(
    source: ClientSource,
    indexes: ClientIndexes,
): ClientMatchResult {
    const {
        pessoa,
        cliente,
    } = source;

    const name =
        normalizeName(
            pessoa.pesNome,
        );

    if (!name) {
        return {
            client: null,
            matchedBy: "PENDING",
        };
    }

    /*
     * 1. NOME + CPF
     */
    const cpf =
        normalizeCpf(
            pessoa.pesDoc,
        );

    if (cpf) {
        const candidates =
            getClientCandidates(
                indexes.cpfIndex,
                pessoa.pesNome,
                cpf,
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "CPF",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 2. NOME + RG
     */
    const rg =
        normalizeRg(
            cliente.cliRg,
        );

    if (rg) {
        const candidates =
            getClientCandidates(
                indexes.rgIndex,
                pessoa.pesNome,
                rg,
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "RG",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 3. NOME + DATA DE NASCIMENTO
     */
    const converted =
        convertClient(source);

    const birthDate =
        normalizeClientDate(
            converted.bornDate,
        );

    if (birthDate) {
        const candidates =
            getClientCandidates(
                indexes.birthDateIndex,
                pessoa.pesNome,
                birthDate,
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "BIRTH_DATE",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    /*
     * 4. NOME + CELULAR
     */
    const phone =
        normalizePhone(
            pessoa.pesCel,
        );

    if (phone) {
        const candidates =
            getClientCandidates(
                indexes.phoneIndex,
                pessoa.pesNome,
                phone,
            );

        const client =
            findUnique(candidates);

        if (client) {
            return {
                client,
                matchedBy: "PHONE",
            };
        }

        if (
            candidates &&
            candidates.length > 1
        ) {
            return {
                client: null,
                matchedBy: "PENDING",
            };
        }
    }

    return {
        client: null,
        matchedBy: "PENDING",
    };
}