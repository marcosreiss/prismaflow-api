-- Migração manual Prisma
-- Data: 2026-02-26
-- Descrição: Adiciona módulo de despesas (Expense)
-- Banco: MySQL (produção / Linux)

-- 1. Criar tabela Expense com enum inline
CREATE TABLE `Expense` (
  `id` int NOT NULL AUTO_INCREMENT,
  `description` varchar(191) NOT NULL,
  `amount` double PRECISION NOT NULL,
  `dueDate` datetime(3) NOT NULL,
  `status` enum('SCHEDULED','PAID') NOT NULL DEFAULT 'SCHEDULED',
  `paymentDate` datetime(3),
  `paymentMethod` enum('PIX','MONEY','DEBIT','CREDIT'),
  `tenantId` varchar(191) NOT NULL,
  `branchId` varchar(191) NOT NULL,
  `createdById` varchar(191),
  `updatedById` varchar(191),
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  KEY `Expense_branchId_fkey` (`branchId`),
  KEY `Expense_tenantId_fkey` (`tenantId`),
  CONSTRAINT `Expense_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Expense_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `Expense_status_dueDate_idx` (`status`, `dueDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
