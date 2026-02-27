-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)

ALTER TABLE `PaymentMethodItem`
  ADD COLUMN `isPaid` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `paidAt` DATETIME(3) NULL;
