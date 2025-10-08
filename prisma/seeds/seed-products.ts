import { PrismaClient, ProductCategory } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedProducts(
  tenantId: string,
  branchId: string,
  brandIds: number[]
) {
  const data = Array.from({ length: 10 }).map((_, i) => ({
    name: `Produto ${i + 1}`,
    description: `Descrição do produto ${i + 1}`,
    costPrice: parseFloat((Math.random() * 100).toFixed(2)),
    markup: 1.5,
    salePrice: parseFloat((Math.random() * 200 + 100).toFixed(2)),
    stockQuantity: Math.floor(Math.random() * 50),
    minimumStock: 5,
    category: i % 2 === 0 ? ProductCategory.FRAME : ProductCategory.LENS,
    tenantId,
    branchId,
    brandId: brandIds[Math.floor(Math.random() * brandIds.length)],
  }));

  await prisma.product.createMany({ data });
  console.log("🕶️ 10 produtos criados com sucesso!");
}
