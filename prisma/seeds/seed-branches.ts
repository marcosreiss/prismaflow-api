import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedBranch(tenantId: string) {
  const existing = await prisma.branch.findFirst({
    where: {
      tenantId,
      name: "Matriz Central",
    },
  });

  if (existing) {
    console.log("🏢 Branch já existe:", existing.name);
    return existing;
  }

  const branch = await prisma.branch.create({
    data: {
      name: "Matriz Central",
      tenantId,
    },
  });

  console.log("🏢 Branch criada:", branch.name);
  return branch;
}
