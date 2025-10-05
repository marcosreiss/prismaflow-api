import { prisma } from "../../config/prisma";
import { PasswordUtils } from "../../utils/password";
import { ApiResponse } from "../../responses/ApiResponse";
import { Request } from "express";
import { RegisterAdminDto } from "./dtos/auth.dto";

export class AuthRepository {
  async createTenantWithAdmin(dto: RegisterAdminDto, req: Request) {
    // Verificar se o e-mail já está em uso
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw ApiResponse.error("E-mail já está em uso.", 400, req);
    }

    const hash = await PasswordUtils.hash(dto.password);

    // Transação Prisma para garantir atomicidade
    const result = await prisma.$transaction(async (tx) => {
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
            },
          },
        },
        include: {
          branches: true,
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const branch = tenant.branches[0];
      const admin = tenant.users[0];

      return {
        tenantId: tenant.id,
        branchId: branch.id,
        admin,
      };
    });

    return result;
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        branch: true,
      },
    });
  }

  async updatePassword(userId: string, newPassword: string) {
    const hash = await PasswordUtils.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }
}
