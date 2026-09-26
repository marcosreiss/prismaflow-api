// migrations/oticacrista/client/client.persistence.ts

import type { Client, PrismaClient } from "@prisma/client";

import type { ClientConverted } from "./client.converter";
import { normalizeCpf } from "./client.converter";
import { addClientToIndexes, type ClientIndexes } from "./client.index";

export interface CreateClientParams {
    prisma: PrismaClient;
    data: ClientConverted;
    tenantId: string;
    branchId: string;
    indexes: ClientIndexes;
    dryRun: boolean;
}

export interface PersistResult {
    status: "CREATED";
    client: Client | null;
}

/**
 * Procura um cliente pelo CPF dentro do tenant. Usado para detectar
 * conflito de CPF (ver findCpfConflict) e para o caso de "pessoa órfã"
 * onde o CPF é o único dado confiável disponível.
 */
export async function findClientByCpf(
    prisma: PrismaClient,
    cpf: string | null | undefined,
    tenantId: string,
): Promise<Client | null> {
    const normalizedCpf = normalizeCpf(cpf);

    if (!normalizedCpf) {
        return null;
    }

    return prisma.client.findFirst({
        where: {
            tenantId,
            cpf: normalizedCpf,
        },
    });
}

/**
 * Cria o cliente e atualiza os índices em memória imediatamente
 * (ver client.index.ts) para que registros seguintes do mesmo loop
 * consigam encontrar este cliente em vez de criar um duplicado.
 *
 * Em DRY_RUN, não persiste — apenas retorna client: null, sinalizando
 * ao orquestrador que a criação teria ocorrido.
 */
export async function createClient(
    params: CreateClientParams,
): Promise<PersistResult> {
    const { prisma, data, tenantId, branchId, indexes, dryRun } = params;

    if (dryRun) {
        return { status: "CREATED", client: null };
    }

    const client = await prisma.client.create({
        data: {
            name: data.name,
            nickname: data.nickname,
            cpf: data.cpf,
            rg: data.rg,
            bornDate: data.bornDate,
            gender: data.gender,
            fatherName: data.fatherName,
            motherName: data.motherName,
            spouse: data.spouse,
            email: data.email,
            company: data.company,
            occupation: data.occupation,
            street: data.street,
            number: data.number,
            neighborhood: data.neighborhood,
            city: data.city,
            uf: data.uf,
            cep: data.cep,
            complement: data.complement,
            isBlacklisted: data.isBlacklisted,
            obs: data.obs,
            phone01: data.phone01,
            phone02: data.phone02,
            phone03: data.phone03,
            reference01: data.reference01,
            reference02: data.reference02,
            reference03: data.reference03,
            isActive: true,
            tenantId,
            branchId,
        },
    });

    addClientToIndexes(client, indexes);

    return { status: "CREATED", client };
}