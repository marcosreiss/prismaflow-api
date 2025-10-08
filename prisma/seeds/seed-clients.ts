import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedClients(tenantId: string, branchId: string) {
  const data = Array.from({ length: 5 }).map((_, i) => ({
    name: `Cliente ${i + 1}`,
    email: `cliente${i + 1}@teste.com`,
    phone01: `11999999${100 + i}`,
    city: "São Paulo",
    uf: "SP",
    tenantId,
    branchId,
  }));

  await prisma.client.createMany({ data });
  console.log("👓 Clientes criados:", data.length);
}
