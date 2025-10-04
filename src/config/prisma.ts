import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Log de inicialização
prisma.$connect()
  .then(() => console.log('🟢 Prisma conectado ao banco!'))
  .catch((err: any) => console.error('🔴 Erro ao conectar Prisma:', err));
