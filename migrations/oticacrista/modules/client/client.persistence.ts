import type { Client } from "@prisma/client";
import { prisma } from "@/config/prisma";
import { migrationConfig } from "@migrations/oticacrista/shared/config";
import { addClientToIndexes, type ClientIndexes } from "./client.index";
import type { ConvertedClient } from "./client.converter";

export async function loadProductionClients(): Promise<Client[]> {
    return prisma.client.findMany({ where: { tenantId: migrationConfig.tenantId } });
}

export async function createClient(
    data: ConvertedClient,
    indexes: ClientIndexes,
): Promise<Client> {
    const created = await prisma.client.create({
        data: {
            ...data,
            tenantId: migrationConfig.tenantId,
            branchId: migrationConfig.branchId,
        },
    });
    addClientToIndexes(created, indexes);
    return created;
}
