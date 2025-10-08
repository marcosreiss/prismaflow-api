import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ClientRepository } from "./client.repository";

export class ClientService {
  private repo = new ClientRepository();

  async create(req: Request, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const branchId = user.branchId; // 🔹 novo

    // 🔹 Preenche automaticamente os campos de contexto
    data.tenantId = tenantId;
    data.branchId = branchId;

    // 🔹 Verifica duplicidade no mesmo tenant (e opcionalmente na filial)
    const exists = await this.repo.findByNameInTenant(tenantId, data.name);
    if (exists) {
      return ApiResponse.error("Já existe um cliente com esse nome.", 409, req);
    }

    // 🔹 Criação do cliente no contexto do tenant/branch
    const client = await this.repo.create(tenantId, branchId, data, user.sub);

    return ApiResponse.success("Cliente criado com sucesso.", req, client);
  }

  async update(req: Request, clientId: number, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const existing = await this.repo.findById(clientId, tenantId);
    if (!existing) {
      return ApiResponse.error("Cliente não encontrado.", 404, req);
    }

    const client = await this.repo.update(clientId, data, user.sub);
    return ApiResponse.success("Cliente atualizado com sucesso.", req, client);
  }

  async getById(req: Request, clientId: number) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const client = await this.repo.findById(clientId, tenantId);
    if (!client) {
      return ApiResponse.error("Cliente não encontrado.", 404, req);
    }

    return ApiResponse.success("Cliente encontrado com sucesso.", req, client);
  }

  async list(req: Request) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const { items, total } = await this.repo.findAllByTenant(
      tenantId,
      page,
      limit,
      search
    );

    return new PagedResponse(
      "Clientes listados com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }
}
