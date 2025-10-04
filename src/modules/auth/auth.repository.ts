import { prisma } from '../../config/prisma';
import { RegisterAdminDto } from './auth.dto';
import bcrypt from 'bcryptjs';

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
}
