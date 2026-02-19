-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)

-- 1. Remover FK e coluna paymentId de PaymentInstallment
ALTER TABLE `PaymentInstallment`
  DROP FOREIGN KEY `PaymentInstallment_paymentId_fkey`,
  DROP INDEX `PaymentInstallment_paymentId_fkey`,
  DROP COLUMN `paymentId`;

-- 2. Tornar paymentMethodItemId NOT NULL em PaymentInstallment
ALTER TABLE `PaymentInstallment`
  MODIFY COLUMN `paymentMethodItemId` INT NOT NULL;

-- 3. Remover colunas obsoletas de Payment
ALTER TABLE `Payment`
  DROP COLUMN `method`,
  DROP COLUMN `downPayment`,
  DROP COLUMN `installmentsTotal`,
  DROP COLUMN `firstDueDate`;
