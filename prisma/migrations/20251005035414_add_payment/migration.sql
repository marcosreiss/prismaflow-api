/*
  Warnings:

  - You are about to drop the column `paymentId` on the `sale` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sale` DROP COLUMN `paymentId`;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `saleId` INTEGER NOT NULL,
    `method` ENUM('PIX', 'MONEY', 'DEBIT', 'CREDIT', 'INSTALLMENT') NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `total` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `downPayment` DOUBLE NOT NULL DEFAULT 0,
    `installmentsTotal` INTEGER NULL,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `installmentsPaid` INTEGER NOT NULL DEFAULT 0,
    `lastPaymentAt` DATETIME(3) NULL,
    `firstDueDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `tenantId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_saleId_key`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentInstallment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `tenantId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentInstallment` ADD CONSTRAINT `PaymentInstallment_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentInstallment` ADD CONSTRAINT `PaymentInstallment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentInstallment` ADD CONSTRAINT `PaymentInstallment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentInstallment` ADD CONSTRAINT `PaymentInstallment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentInstallment` ADD CONSTRAINT `PaymentInstallment_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
