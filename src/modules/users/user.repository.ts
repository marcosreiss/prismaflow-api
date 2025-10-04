import { prisma } from "../../config/prisma";
import { Role } from "@prisma/client";

export class UserRepository {
  create(params: {
    name: string;
    email: string;
    password: string;
    role: Role;
    tenantId: string;
    branchId?: string | null;
  }) {
    return prisma.user.create({ data: params });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
}
