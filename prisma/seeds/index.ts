import { PrismaClient } from "@prisma/client";
import { seedBranch } from "./seed-branches";
import { seedBrands } from "./seed-brands";
import { seedClients } from "./seed-clients";
import { seedOpticalServices } from "./seed-optical-services";
import { seedProducts } from "./seed-products";
import { seedTenant } from "./seed-tenant";
import { seedUser } from "./seed-users";

const prisma = new PrismaClient();

async function main() {
  const tenant = await seedTenant();
  const branch = await seedBranch(tenant.id);
  await seedUser(tenant.id, branch.id);
  const brands = await seedBrands(tenant.id);
  await seedProducts(
    tenant.id,
    branch.id,
    brands.map((b) => b.id)
  );
  await seedOpticalServices(tenant.id, branch.id);
  await seedClients(tenant.id, branch.id);

  console.log("🌱 SEED FINALIZADO COM SUCESSO!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => prisma.$disconnect());
