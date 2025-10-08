import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function seedOpticalServices(tenantId: string, branchId: string) {
  const data = [
    { name: "Ajuste de armação", price: 30 },
    { name: "Troca de plaquetas", price: 20 },
    { name: "Montagem de lentes", price: 60 },
  ].map((s) => ({ ...s, tenantId, branchId }));

  await prisma.opticalService.createMany({ data });
  console.log("🧾 Serviços óticos criados:", data.length);
}
