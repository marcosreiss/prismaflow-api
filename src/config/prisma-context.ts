import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Helper para gerar data de auditoria dinamicamente
export function withAuditData<T extends Record<string, any>>(
  userId: string | undefined,
  data: T,
  isUpdate = false
): T {
  if (!userId) return data;

  if (isUpdate) {
    return { ...data, updatedById: userId };
  }

  return { ...data, createdById: userId, updatedById: userId };
}
