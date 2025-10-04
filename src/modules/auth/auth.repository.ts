import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { RegisterAdminDto } from './dtos/register.dto';

export class AuthRepository {
  async createTenantWithAdmin(dto: RegisterAdminDto) {
    const hash = await bcrypt.hash(dto.password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        name: dto.tenantName,
        branches: {
          create: {
            name: dto.branchName,
          },
        },
        users: {
          create: {
            name: dto.name,
            email: dto.email,
            password: hash,
            role: 'ADMIN',
          },
        },
      },
      include: {
        branches: true,
        users: true,
      },
    });

    return tenant;
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
}
