// src/modules/clients/client.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ClientRepository } from "./client.repository";
import { AppError } from "../../utils/app-error";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

export class ClientService {
  private repo = new ClientRepository();

  async create(req: Request, dto: CreateClientDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    if (!user.branchId)
      throw new AppError("Usuário não está associado a nenhuma filial.", 403);

    if (dto.cpf) {
      const existingCpf = await this.repo.findByCpf(dto.cpf, user.tenantId);
      if (existingCpf) {
        throw new AppError(
          "Já existe um cliente cadastrado com esse CPF nesta ótica.",
          409,
        );
      }
    }

    try {
      const client = await this.repo.create(
        user.tenantId,
        user.branchId,
        {
          ...dto,
          bornDate: dto.bornDate ? new Date(dto.bornDate) : undefined,
        },
        user.sub,
      );
      return ApiResponse.success("Cliente criado com sucesso.", req, client);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("cpf")) {
        throw new AppError("Este CPF já está cadastrado no sistema.", 409);
      }
      throw error;
    }
  }

  async update(req: Request, clientId: number, dto: UpdateClientDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const existing = await this.repo.findById(clientId, user.tenantId);
    if (!existing) throw new AppError("Cliente não encontrado.", 404);

    if (dto.cpf && dto.cpf !== existing.cpf) {
      const existingCpf = await this.repo.findByCpf(dto.cpf, user.tenantId);
      if (existingCpf && existingCpf.id !== clientId) {
        throw new AppError(
          "Já existe outro cliente cadastrado com esse CPF nesta ótica.",
          409,
        );
      }
    }

    try {
      const client = await this.repo.update(
        clientId,
        {
          ...dto,
          bornDate: dto.bornDate ? new Date(dto.bornDate) : undefined,
        },
        user.sub,
      );
      return ApiResponse.success(
        "Cliente atualizado com sucesso.",
        req,
        client,
      );
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("cpf")) {
        throw new AppError("Este CPF já está cadastrado no sistema.", 409);
      }
      throw error;
    }
  }

  async getById(req: Request, clientId: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const client = await this.repo.findById(clientId, user.tenantId);
    if (!client) throw new AppError("Cliente não encontrado.", 404);

    return ApiResponse.success("Cliente encontrado com sucesso.", req, client);
  }

  async list(req: Request) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const search = req.query.search ? String(req.query.search) : undefined;

    // EMPLOYEE só vê a própria filial; ADMIN/MANAGER veem o tenant com filtro opcional
    const branchId =
      user.role === "EMPLOYEE"
        ? user.branchId
        : req.query.branchId
          ? String(req.query.branchId)
          : undefined;

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      search,
      branchId,
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
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const name = String(req.query.name || "").trim();
    if (!name) throw new AppError("O parâmetro 'name' é obrigatório.", 400);

    // EMPLOYEE filtra pela própria filial; ADMIN/MANAGER buscam no tenant
    const branchId = user.role === "EMPLOYEE" ? user.branchId : undefined;

    const clients = await this.repo.findByNameForSelect(
      user.tenantId,
      name,
      branchId,
    );

    return ApiResponse.success(
      "Clientes encontrados com sucesso.",
      req,
      clients,
    );
  }

  async listBirthdays(req: Request) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const targetDate = req.query.date ? String(req.query.date) : undefined;

    // EMPLOYEE só vê a própria filial; ADMIN/MANAGER veem o tenant com filtro opcional
    const branchId =
      user.role === "EMPLOYEE"
        ? user.branchId
        : req.query.branchId
          ? String(req.query.branchId)
          : undefined;

    const { items, total } = await this.repo.findBirthdays(
      user.tenantId,
      page,
      limit,
      targetDate,
      branchId,
    );

    return new PagedResponse(
      `Aniversariantes listados com sucesso${targetDate ? ` para ${targetDate}` : ""}.`,
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async delete(req: Request, clientId: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const client = await this.repo.findById(clientId, user.tenantId);
    if (!client) throw new AppError("Cliente não encontrado.", 404);

    const hasRelations = await this.repo.hasRelations(clientId);

    if (hasRelations) {
      await this.repo.softDelete(clientId, user.sub);
    } else {
      await this.repo.hardDelete(clientId);
    }

    return ApiResponse.success("Cliente excluído com sucesso.", req);
  }
}
