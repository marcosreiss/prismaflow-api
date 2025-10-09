-- DropForeignKey
ALTER TABLE `branch` DROP FOREIGN KEY `Branch_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `branch` DROP FOREIGN KEY `Branch_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `brand` DROP FOREIGN KEY `Brand_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `brand` DROP FOREIGN KEY `Brand_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `client` DROP FOREIGN KEY `Client_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `client` DROP FOREIGN KEY `Client_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `framedetails` DROP FOREIGN KEY `FrameDetails_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `framedetails` DROP FOREIGN KEY `FrameDetails_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `itemopticalservice` DROP FOREIGN KEY `ItemOpticalService_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `itemopticalservice` DROP FOREIGN KEY `ItemOpticalService_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `itemproduct` DROP FOREIGN KEY `ItemProduct_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `itemproduct` DROP FOREIGN KEY `ItemProduct_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `opticalservice` DROP FOREIGN KEY `OpticalService_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `opticalservice` DROP FOREIGN KEY `OpticalService_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `paymentinstallment` DROP FOREIGN KEY `PaymentInstallment_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `paymentinstallment` DROP FOREIGN KEY `PaymentInstallment_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `prescription` DROP FOREIGN KEY `Prescription_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `prescription` DROP FOREIGN KEY `Prescription_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `protocol` DROP FOREIGN KEY `Protocol_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `protocol` DROP FOREIGN KEY `Protocol_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `sale` DROP FOREIGN KEY `Sale_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `sale` DROP FOREIGN KEY `Sale_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `tenant` DROP FOREIGN KEY `Tenant_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `tenant` DROP FOREIGN KEY `Tenant_updatedById_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_updatedById_fkey`;

-- DropIndex
DROP INDEX `Branch_createdById_fkey` ON `branch`;

-- DropIndex
DROP INDEX `Branch_updatedById_fkey` ON `branch`;

-- DropIndex
DROP INDEX `Brand_createdById_fkey` ON `brand`;

-- DropIndex
DROP INDEX `Brand_updatedById_fkey` ON `brand`;

-- DropIndex
DROP INDEX `Client_createdById_fkey` ON `client`;

-- DropIndex
DROP INDEX `Client_updatedById_fkey` ON `client`;

-- DropIndex
DROP INDEX `FrameDetails_createdById_fkey` ON `framedetails`;

-- DropIndex
DROP INDEX `FrameDetails_updatedById_fkey` ON `framedetails`;

-- DropIndex
DROP INDEX `ItemOpticalService_createdById_fkey` ON `itemopticalservice`;

-- DropIndex
DROP INDEX `ItemOpticalService_updatedById_fkey` ON `itemopticalservice`;

-- DropIndex
DROP INDEX `ItemProduct_createdById_fkey` ON `itemproduct`;

-- DropIndex
DROP INDEX `ItemProduct_updatedById_fkey` ON `itemproduct`;

-- DropIndex
DROP INDEX `OpticalService_createdById_fkey` ON `opticalservice`;

-- DropIndex
DROP INDEX `OpticalService_updatedById_fkey` ON `opticalservice`;

-- DropIndex
DROP INDEX `Payment_createdById_fkey` ON `payment`;

-- DropIndex
DROP INDEX `Payment_updatedById_fkey` ON `payment`;

-- DropIndex
DROP INDEX `PaymentInstallment_createdById_fkey` ON `paymentinstallment`;

-- DropIndex
DROP INDEX `PaymentInstallment_updatedById_fkey` ON `paymentinstallment`;

-- DropIndex
DROP INDEX `Prescription_createdById_fkey` ON `prescription`;

-- DropIndex
DROP INDEX `Prescription_updatedById_fkey` ON `prescription`;

-- DropIndex
DROP INDEX `Product_createdById_fkey` ON `product`;

-- DropIndex
DROP INDEX `Product_updatedById_fkey` ON `product`;

-- DropIndex
DROP INDEX `Protocol_createdById_fkey` ON `protocol`;

-- DropIndex
DROP INDEX `Protocol_updatedById_fkey` ON `protocol`;

-- DropIndex
DROP INDEX `Sale_createdById_fkey` ON `sale`;

-- DropIndex
DROP INDEX `Sale_updatedById_fkey` ON `sale`;

-- DropIndex
DROP INDEX `Tenant_createdById_fkey` ON `tenant`;

-- DropIndex
DROP INDEX `Tenant_updatedById_fkey` ON `tenant`;

-- DropIndex
DROP INDEX `User_createdById_fkey` ON `user`;

-- DropIndex
DROP INDEX `User_updatedById_fkey` ON `user`;
