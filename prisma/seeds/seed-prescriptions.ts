import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Cria receitas (prescriptions) de teste associadas aos primeiros clientes.
 * Cada cliente recebe uma receita diferente, se ainda não tiver.
 */
export async function seedPrescriptions(tenantId: string, branchId: string) {
  const clients = await prisma.client.findMany({
    where: { tenantId },
    take: 5,
  });

  if (!clients.length) {
    console.log("⚠️ Nenhum cliente encontrado. Execute seed-clients primeiro.");
    return;
  }

  for (const client of clients) {
    const existing = await prisma.prescription.findFirst({
      where: { clientId: client.id },
    });

    if (existing) {
      console.log(`🩺 Receita já existe para ${client.name}`);
      continue;
    }

    await prisma.prescription.create({
      data: {
        clientId: client.id,
        prescriptionDate: new Date(),
        doctorName: "Dr. Marcos Silva",
        crm: "12345-SP",

        // 👁️ Olho direito (OD)
        odSpherical: "-1.25",
        odCylindrical: "-0.50",
        odAxis: "180",
        odDnp: "31.5",

        // 👁️ Olho esquerdo (OE)
        oeSpherical: "-1.00",
        oeCylindrical: "-0.25",
        oeAxis: "175",
        oeDnp: "31.0",

        additionRight: "+2.00",
        additionLeft: "+2.00",
        opticalCenterRight: "31.5",
        opticalCenterLeft: "31.0",

        tenantId,
        branchId,
      },
    });

    console.log(`✅ Receita criada para ${client.name}`);
  }

  console.log("🩺 Seed de receitas finalizado com sucesso!");
}
