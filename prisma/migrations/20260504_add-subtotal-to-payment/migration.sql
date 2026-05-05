-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)

ALTER TABLE `Payment` ADD COLUMN `subtotal` DOUBLE NULL;