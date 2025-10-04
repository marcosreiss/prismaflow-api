import { Request } from 'express';
import { AuthRepository } from './auth.repository';
import { RegisterAdminDto } from './auth.dto';
import { ApiResponse } from '../../responses/ApiResponse';

export class AuthService {
  private repository = new AuthRepository();

  async registerAdmin(req: Request, dto: RegisterAdminDto) {
    const tenant = await this.repository.createTenantWithAdmin(dto);
    return ApiResponse.success('Tenant and admin created successfully', req, tenant);
  }
}
