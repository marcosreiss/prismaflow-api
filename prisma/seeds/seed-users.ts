import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

export async function seedUser(tenantId: string, branchId: string) {
  const hashedPassword = await bcrypt.hash("123456", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@prismaflow.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@prismaflow.com",
      password: hashedPassword,
      role: "ADMIN",
      tenantId,
      branchId,
    },
  });

  console.log("👤 Usuário admin criado:", user.email);
  return user;
}
