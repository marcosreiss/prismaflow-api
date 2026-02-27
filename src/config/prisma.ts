import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

function getDatabaseTarget(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return 'DATABASE_URL não definida';
  }

  try {
    const parsed = new URL(databaseUrl);
    const protocol = parsed.protocol.replace(':', '');
    const host = parsed.hostname || 'host-desconhecido';
    const port = parsed.port ? `:${parsed.port}` : '';
    const databaseName = parsed.pathname.replace('/', '') || 'db-desconhecido';

    return `${protocol}://${host}${port}/${databaseName}`;
  } catch {
    return 'DATABASE_URL inválida';
  }
}

prisma
  .$connect()
  .then(() =>
    console.log(`🟢 Prisma conectado ao banco (${getDatabaseTarget()})!`)
  )
  .catch((err: unknown) => console.error('🔴 Erro ao conectar Prisma:', err));
