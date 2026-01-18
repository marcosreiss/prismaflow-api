-- Remove a coluna recordNumber da tabela Protocol
-- Migration manual (produção / MySQL)

ALTER TABLE `Protocol`
DROP COLUMN `recordNumber`;
