import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedBrands(tenantId: string) {
  const data = ["RayVision", "OptiClear", "FocusPro", "SeeWell"].map(
    (name) => ({
      name,
      tenantId,
    })
  );

  await prisma.brand.createMany({ data, skipDuplicates: true });
  const brands = await prisma.brand.findMany({ where: { tenantId } });
  console.log(`🏷️ ${brands.length} marcas criadas`);
  return brands;
}
