import { Request } from 'express';
import { ApiResponse } from '../../responses/ApiResponse';
import { BranchRepository } from './branch.repository';

export class BranchService {
  private repo = new BranchRepository();

  async create(req: Request, name: string) {
    const user = req.user!;
    // Apenas ADMIN cria branch
    if (user.role !== 'ADMIN') {
      return ApiResponse.error('Apenas administradores podem criar filiais.', 403, req);
    }

    // Evitar duplicidade por tenant
    const exists = await this.repo.findByNameInTenant(user.tenantId, name);
    if (exists) {
      return ApiResponse.error('Já existe uma filial com esse nome neste tenant.', 409, req);
    }

    const branch = await this.repo.create(user.tenantId, name);
    return ApiResponse.success('Filial criada com sucesso.', req, branch);
  }
}
