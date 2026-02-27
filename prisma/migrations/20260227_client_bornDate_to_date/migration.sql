-- Migração manual Prisma
-- Banco: MySQL (produção / Linux)
-- Descrição: Client.bornDate DATETIME? → DATE?

-- MySQL permite alterar DATETIME→DATE sem perda (trunca hora:min:seg)
ALTER TABLE `Client` 
MODIFY COLUMN `bornDate` DATE NULL;
