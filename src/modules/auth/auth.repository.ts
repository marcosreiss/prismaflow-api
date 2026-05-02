// src/modules/auth/auth.repository.ts
import { prisma } from "../../config/prisma";
import { PasswordUtils } from "../../utils/password";
import { AppError } from "../../utils/app-error";
import { RegisterAdminDto } from "./auth.dto";
import { Role } from "@prisma/client";

export class AuthRepository {
  async createTenantWithAdmin(dto: RegisterAdminDto) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new AppError("E-mail já está em uso.", 400);
    }

    const hash = await PasswordUtils.hash(dto.password);

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          branches: {
            create: { name: dto.branchName },
          },
          users: {
            create: {
              name: dto.name,
              email: dto.email,
              password: hash,
              role: "ADMIN",
              // branchId intencialmente null: ADMIN sem filial fixa inicia fluxo de seleção
            },
          },
        },
        include: {
          branches: true,
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      return {
        tenantId: tenant.id,
        branchId: tenant.branches[0].id,
        admin: tenant.users[0],
      };
    });
  }

  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: Role;
    tenantId: string;
    branchId: string;
    createdById: string;
  }) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new AppError("E-mail já está em uso.", 400);
    }

    const hash = await PasswordUtils.hash(data.password);

    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hash,
        role: data.role,
        tenantId: data.tenantId,
        branchId: data.branchId,
        createdById: data.createdById,
        updatedById: data.createdById,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        branchId: true,
        createdAt: true,
      },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { tenant: true, branch: true },
    });
  }

  async updatePassword(userId: string, newPassword: string) {
    const hash = await PasswordUtils.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }

  async findBranchesByTenantId(tenantId: string) {
    return prisma.branch.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  }
}
