-- Torna saleDate obrigatória após backfill dos dados

ALTER TABLE `Sale`
MODIFY COLUMN `saleDate` DATETIME NOT NULL;
