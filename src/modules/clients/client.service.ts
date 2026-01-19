import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ClientRepository } from "./client.repository";

export class ClientService {
  private repo = new ClientRepository();

  async create(req: Request, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const branchId = user.branchId;

    // 🔹 Preenche automaticamente os campos de contexto
    data.tenantId = tenantId;
    data.branchId = branchId;

    // 🔹 Corrige campos de data (ex: bornDate)
    if (data.bornDate) {
      data.bornDate = new Date(data.bornDate);
    }

    // 🔹 Verifica duplicidade de CPF no mesmo tenant
    if (data.cpf) {
      const existingCpf = await this.repo.findByCpf(data.cpf, tenantId);
      if (existingCpf) {
        return ApiResponse.error(
          "Já existe um cliente cadastrado com esse CPF nesta ótica.",
          409,
          req,
        );
      }
    }

    try {
      // 🔹 Criação do cliente no contexto do tenant/branch
      const client = await this.repo.create(tenantId, branchId, data, user.sub);
      return ApiResponse.success("Cliente criado com sucesso.", req, client);
    } catch (error: any) {
      // 🔹 Tratamento para race condition ou outros erros de constraint única
      if (error.code === "P2002" && error.meta?.target?.includes("cpf")) {
        return ApiResponse.error(
          "Este CPF já está cadastrado no sistema.",
          409,
          req,
        );
      }
      throw error; // Re-lança outros erros para o middleware global
    }
  }

  async update(req: Request, clientId: number, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;

    // 🔹 Corrige campos de data (ex: bornDate)
    if (data.bornDate) {
      data.bornDate = new Date(data.bornDate);
    }

    // 🔹 Verifica se o cliente existe
    const existing = await this.repo.findById(clientId, tenantId);
    if (!existing) {
      return ApiResponse.error("Cliente não encontrado.", 404, req);
    }

    // 🔹 Se está alterando o CPF, verifica se já não existe outro cliente com esse CPF
    if (data.cpf && data.cpf !== existing.cpf) {
      const existingCpf = await this.repo.findByCpf(data.cpf, tenantId);
      if (existingCpf && existingCpf.id !== clientId) {
        return ApiResponse.error(
          "Já existe outro cliente cadastrado com esse CPF neste tenant.",
          409,
          req,
        );
      }
    }

    try {
      const client = await this.repo.update(clientId, data, user.sub);
      return ApiResponse.success(
        "Cliente atualizado com sucesso.",
        req,
        client,
      );
    } catch (error: any) {
      // 🔹 Tratamento para race condition ou outros erros de constraint única
      if (error.code === "P2002" && error.meta?.target?.includes("cpf")) {
        return ApiResponse.error(
          "Este CPF já está cadastrado no sistema.",
          409,
          req,
        );
      }
      throw error; // Re-lança outros erros para o middleware global
    }
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

    // 🔹 Se branchId vier na query, usa ele; senão, undefined (retorna todos do tenant)
    const branchId = req.query.branchId
      ? String(req.query.branchId)
      : undefined;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search ? String(req.query.search) : undefined;

    const { items, total } = await this.repo.findAllByTenantAndBranch(
      tenantId,
      branchId,
      page,
      limit,
      search,
    );

    return new PagedResponse(
      "Clientes listados com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async select(req: Request) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const branchId = user.branchId;
    const name = String(req.query.name || "").trim();

    if (!name) {
      return ApiResponse.error("O parâmetro 'name' é obrigatório.", 400, req);
    }

    const clients = await this.repo.findByNameForSelect(
      tenantId,
      branchId,
      name,
    );
    return ApiResponse.success(
      "Clientes encontrados com sucesso.",
      req,
      clients,
    );
  }

  async listBirthdays(req: Request) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const branchId = user.branchId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // 🗓️ Nova query param opcional: date=YYYY-MM-DD ou ISO
    const targetDate = req.query.date ? String(req.query.date) : undefined;

    const { items, total } = await this.repo.findBirthdays(
      tenantId,
      branchId,
      page,
      limit,
      targetDate,
    );

    return new PagedResponse(
      `Aniversariantes listados com sucesso${
        targetDate ? ` para ${targetDate}` : ""
      }.`,
      req,
      items,
      page,
      limit,
      total,
    );
  }
}
