-- Torna unitPrice obrigatório em ItemProduct
ALTER TABLE `ItemProduct`
  MODIFY COLUMN `unitPrice` DOUBLE NOT NULL;

-- Torna unitPrice obrigatório em ItemOpticalService
ALTER TABLE `ItemOpticalService`
  MODIFY COLUMN `unitPrice` DOUBLE NOT NULL;