-- AlterTable
ALTER TABLE `sale` ADD COLUMN `prescriptionId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_prescriptionId_fkey` FOREIGN KEY (`prescriptionId`) REFERENCES `Prescription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
