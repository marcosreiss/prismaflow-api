-- Adiciona data real da venda (inicialmente nullable)

ALTER TABLE `Sale`
ADD COLUMN `saleDate` DATETIME NULL;
