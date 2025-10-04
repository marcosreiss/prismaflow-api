import { Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../../responses/ApiResponse';
import { AuthRepository } from './auth.repository';
import { env } from '../../config/env';
import { RegisterAdminDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';

export class AuthService {
  private repository = new AuthRepository();

  async registerAdmin(req: Request, dto: RegisterAdminDto) {
    const tenant = await this.repository.createTenantWithAdmin(dto);
    return ApiResponse.success('Ótica e administrador criados com sucesso.', req, tenant);
  }

  async login(req: Request, dto: LoginDto) {
    const user = await this.repository.findUserByEmail(dto.email);

    if (!user) {
      return ApiResponse.error('Usuário não encontrado.', 404, req);
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      return ApiResponse.error('Credenciais inválidas.', 401, req);
    }

    const secret = env.JWT_SECRET || 'chave-padrao'; // substitua depois
    const token = jwt.sign(
      { sub: user.id, email: user.email, tenantId: user.tenantId, role: user.role },
      secret,
      { expiresIn: '2h' }
    );

    // Remover senha da resposta
    const { password, ...userSafe } = user;

    return ApiResponse.success('Login realizado com sucesso.', req, userSafe, token);
  }
}
