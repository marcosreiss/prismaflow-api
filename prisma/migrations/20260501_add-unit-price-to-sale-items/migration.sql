-- Adiciona unitPrice nullable em ItemProduct
ALTER TABLE `ItemProduct` ADD COLUMN `unitPrice` DOUBLE NULL;

-- Adiciona unitPrice nullable em ItemOpticalService
ALTER TABLE `ItemOpticalService`
  ADD COLUMN `unitPrice` DOUBLE NULL;