-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)
-- Descrição: Remove unique constraint global de CPF e adiciona unique constraint composta (cpf + tenantId)

-- 1. Remover o índice único atual do CPF
ALTER TABLE `Client`
DROP INDEX `Client_cpf_key`;

-- 2. Criar novo índice único composto (cpf + tenantId)
ALTER TABLE `Client`
ADD UNIQUE KEY `Client_cpf_tenantId_key` (`cpf`, `tenantId`);
