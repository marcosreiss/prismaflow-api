-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)
-- Alteração: campos de data sem necessidade de horário para tipo DATE

ALTER TABLE `Sale`
MODIFY COLUMN `saleDate` DATE NOT NULL;

ALTER TABLE `Prescription`
MODIFY COLUMN `prescriptionDate` DATE NOT NULL;

ALTER TABLE `PaymentMethodItem`
MODIFY COLUMN `firstDueDate` DATE NULL;

ALTER TABLE `Payment`
MODIFY COLUMN `lastPaymentAt` DATE NULL;

ALTER TABLE `PaymentInstallment`
MODIFY COLUMN `dueDate` DATE NULL,
MODIFY COLUMN `paidAt` DATE NULL;
