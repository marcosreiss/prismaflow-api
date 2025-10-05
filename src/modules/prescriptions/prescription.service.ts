import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PrescriptionRepository } from "./prescription.repository";

export class PrescriptionService {
  private repo = new PrescriptionRepository();

  async create(req: Request, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const prescription = await this.repo.create(tenantId, data, user.sub);
    return ApiResponse.success(
      "Receita criada com sucesso.",
      req,
      prescription
    );
  }

  async update(req: Request, prescriptionId: number, data: any) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const existing = await this.repo.findById(prescriptionId, tenantId);
    if (!existing) {
      return ApiResponse.error("Receita não encontrada.", 404, req);
    }

    const updated = await this.repo.update(prescriptionId, data, user.sub);
    return ApiResponse.success("Receita atualizada com sucesso.", req, updated);
  }

  async getById(req: Request, prescriptionId: number) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const prescription = await this.repo.findById(prescriptionId, tenantId);
    if (!prescription) {
      return ApiResponse.error("Receita não encontrada.", 404, req);
    }

    return ApiResponse.success(
      "Receita encontrada com sucesso.",
      req,
      prescription
    );
  }

  async list(req: Request) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const clientId = req.query.clientId
      ? Number(req.query.clientId)
      : undefined;

    const { items, total } = await this.repo.findAllByTenant(
      tenantId,
      page,
      limit,
      clientId
    );

    return new PagedResponse(
      "Receitas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total
    );
  }
}
