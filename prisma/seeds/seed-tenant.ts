import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedTenant() {
  const existing = await prisma.tenant.findFirst({
    where: { name: "PrismaFlow Ótica" },
  });

  if (existing) {
    console.log("✅ Tenant já existe:", existing.name);
    return existing;
  }

  const tenant = await prisma.tenant.create({
    data: { name: "PrismaFlow Ótica" },
  });

  console.log("✅ Tenant criado:", tenant.name);
  return tenant;
}
