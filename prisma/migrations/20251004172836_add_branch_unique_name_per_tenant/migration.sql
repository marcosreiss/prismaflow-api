/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,name]` on the table `Branch` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Branch_tenantId_name_key` ON `Branch`(`tenantId`, `name`);
