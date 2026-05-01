-- Remove o índice único global de name
DROP INDEX `Brand_name_key` ON `Brand`;

-- Cria o novo índice único composto
CREATE UNIQUE INDEX `Brand_tenantId_name_key` ON `Brand`(`tenantId`, `name`);

-- Converte dueDate para DATE (era DATETIME)
ALTER TABLE `Expense` MODIFY COLUMN `dueDate` DATE NOT NULL;

-- Converte paymentDate para DATE (era DATETIME, nullable)
ALTER TABLE `Expense` MODIFY COLUMN `paymentDate` DATE NULL;