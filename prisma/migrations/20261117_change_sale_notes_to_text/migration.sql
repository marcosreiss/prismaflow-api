-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)
ALTER TABLE
    `Sale`
MODIFY
    COLUMN `notes` TEXT NULL;