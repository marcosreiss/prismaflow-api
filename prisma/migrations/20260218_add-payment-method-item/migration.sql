-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)

-- 1. Criar tabela PaymentMethodItem
CREATE TABLE `PaymentMethodItem` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `paymentId`    INT           NOT NULL,
  `method`       ENUM('PIX','MONEY','DEBIT','CREDIT','INSTALLMENT') NOT NULL,
  `amount`       DOUBLE        NOT NULL DEFAULT 0,
  `installments` INT           NULL,
  `firstDueDate` DATETIME(3)   NULL,
  `tenantId`     VARCHAR(191)  NOT NULL,
  `branchId`     VARCHAR(191)  NOT NULL,
  `createdById`  VARCHAR(191)  NULL,
  `updatedById`  VARCHAR(191)  NULL,
  `createdAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `PaymentMethodItem_paymentId_fkey` (`paymentId`),
  INDEX `PaymentMethodItem_tenantId_fkey` (`tenantId`),
  INDEX `PaymentMethodItem_branchId_fkey` (`branchId`),
  CONSTRAINT `PaymentMethodItem_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`),
  CONSTRAINT `PaymentMethodItem_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`),
  CONSTRAINT `PaymentMethodItem_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Adicionar coluna paymentMethodItemId em PaymentInstallment (nullable por enquanto)
ALTER TABLE `PaymentInstallment`
  ADD COLUMN `paymentMethodItemId` INT NULL,
  ADD INDEX `PaymentInstallment_paymentMethodItemId_fkey` (`paymentMethodItemId`),
  ADD CONSTRAINT `PaymentInstallment_paymentMethodItemId_fkey`
    FOREIGN KEY (`paymentMethodItemId`) REFERENCES `PaymentMethodItem`(`id`);
