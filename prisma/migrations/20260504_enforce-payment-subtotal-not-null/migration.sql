-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)
-- Esta migração tem como objetivo alterar a coluna `subtotal` da tabela `Payment` para não permitir valores nulos e definir um valor padrão de 0.

ALTER TABLE `Payment`
MODIFY COLUMN `subtotal` DOUBLE NOT NULL DEFAULT 0;