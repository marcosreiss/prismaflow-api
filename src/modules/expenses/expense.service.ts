import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { ExpenseRepository } from "./expense.repository";

export class ExpenseService {
  private repo = new ExpenseRepository();

  async create(req: Request, data: any) {
    const user = req.user!;

    const branchId = user.branchId;

    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.paymentDate) data.paymentDate = new Date(data.paymentDate);

    const expense = await this.repo.create(
      user.tenantId,
      branchId,
      data,
      user.sub,
    );

    return ApiResponse.success("Despesa criada com sucesso.", req, expense);
  }

  async update(req: Request, id: number, data: any) {
    const user = req.user!;

    const existing = await this.repo.findById(id, user.tenantId);
    if (!existing) {
      return ApiResponse.error("Despesa não encontrada.", 404, req);
    }

    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.paymentDate) data.paymentDate = new Date(data.paymentDate);

    const expense = await this.repo.update(id, data, user.sub);
    return ApiResponse.success("Despesa atualizada com sucesso.", req, expense);
  }

  async getById(req: Request, id: number) {
    const user = req.user!;

    const expense = await this.repo.findById(id, user.tenantId);
    if (!expense) {
      return ApiResponse.error("Despesa não encontrada.", 404, req);
    }

    return ApiResponse.success("Despesa encontrada com sucesso.", req, expense);
  }

  async list(req: Request) {
    const user = req.user!;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const branchId = req.query.branchId
      ? String(req.query.branchId)
      : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const { items, total } = await this.repo.findAllByTenant(
      user.tenantId,
      page,
      limit,
      branchId,
      status,
      search,
    );

    return new PagedResponse(
      "Despesas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async delete(req: Request, id: number) {
    const user = req.user!;

    const existing = await this.repo.findById(id, user.tenantId);
    if (!existing) {
      return ApiResponse.error("Despesa não encontrada.", 404, req);
    }

    await this.repo.delete(id);
    return ApiResponse.success("Despesa excluída com sucesso.", req);
  }
}
