import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { BranchRepository } from "./branch.repository";

export class BranchService {
  private repo = new BranchRepository();

  async create(req: Request, name: string) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem criar filiais.",
        403,
        req
      );
    }

    const exists = await this.repo.findByNameInTenant(user.tenantId, name);
    if (exists) {
      return ApiResponse.error(
        "Já existe uma filial com esse nome neste tenant.",
        409,
        req
      );
    }

    const branch = await this.repo.create(user.tenantId, name);
    return ApiResponse.success("Filial criada com sucesso.", req, branch);
  }

  async list(req: Request) {
    const user = req.user!;
    if (user.role !== "ADMIN") {
      return ApiResponse.error(
        "Apenas administradores podem listar filiais.",
        403,
        req
      );
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit
    );
    return new PagedResponse(
      "Filiais listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }
}
