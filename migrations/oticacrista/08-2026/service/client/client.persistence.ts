import type {
    Client,
    PrismaClient,
} from "@prisma/client";

import type { ClientConverted } from "../../converters/client.converter";

import {
    addClientToIndexes,
    type ClientIndexes,
} from "./client.index";

export interface CreateClientParams {
    prisma: PrismaClient;
    data: ClientConverted;
    tenantId: string;
    branchId: string;
    indexes: ClientIndexes;
}

/**
 * Procura um cliente pelo CPF dentro do tenant.
 *
 * O CPF é normalizado antes da consulta para manter
 * o mesmo padrão utilizado pelo converter da migração.
 */
export async function findClientByCpf(
    prisma: PrismaClient,
    cpf: string | null | undefined,
    tenantId: string,
): Promise<Client | null> {
    if (!cpf) {
        return null;
    }

    const normalizedCpf = cpf.replace(/\D/g, "");

    if (!normalizedCpf) {
        return null;
    }

    const client = await prisma.client.findFirst({
        where: {
            tenantId,
            cpf: normalizedCpf,
        },
    });

    return client;
}

export async function createClient(
    params: CreateClientParams,
): Promise<Client> {
    const {
        prisma,
        data,
        tenantId,
        branchId,
        indexes,
    } = params;

    const client =
        await prisma.client.create({
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

    return client;
}