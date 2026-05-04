// src/modules/prescriptions/prescription.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PrescriptionRepository } from "./prescription.repository";

export class PrescriptionService {
  private repo = new PrescriptionRepository();

  // =========================================================
  // 🔹 CREATE
  // =========================================================
  async create(req: Request, data: any) {
    const user = req.user!;
    const { tenantId, branchId, sub: userId } = user;

    // 🔸 Sempre injeta tenantId e branchId no payload
    const payload = {
      ...data,
      tenantId,
      branchId,
    };

    const prescription = await this.repo.create(tenantId, payload, userId);
    return ApiResponse.success(
      "Receita criada com sucesso.",
      req,
      prescription,
    );
  }

  // =========================================================
  // 🔹 UPDATE
  // =========================================================
  async update(req: Request, prescriptionId: number, data: any) {
    const user = req.user!;
    const { tenantId, branchId, sub: userId } = user;

    const existing = await this.repo.findById(prescriptionId, tenantId);
    if (!existing) {
      return ApiResponse.error("Receita não encontrada.", 404, req);
    }

    // 🔸 Garante tenantId e branchId também na atualização
    const payload = {
      ...data,
      tenantId,
      branchId,
    };

    const updated = await this.repo.update(prescriptionId, payload, userId);
    return ApiResponse.success("Receita atualizada com sucesso.", req, updated);
  }

  // =========================================================
  // 🔹 FIND BY ID
  // =========================================================
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
      prescription,
    );
  }

  // =========================================================
  // 🔹 LIST (com paginação e filtro por cliente)
  // =========================================================
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
      clientId,
    );

    return new PagedResponse(
      "Receitas listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  // =========================================================
  // 🔹 LIST BY CLIENT
  // =========================================================
  async getByClientId(
    req: Request,
    clientId: number,
    page: number,
    limit: number,
  ) {
    const user = req.user!;
    const tenantId = user.tenantId;

    const { items, total } = await this.repo.findByClientId(
      tenantId,
      clientId,
      page,
      limit,
    );

    return new PagedResponse(
      "Prescrições listadas com sucesso.",
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async listExpiringPrescriptions(req: Request) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const branchId = user.branchId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // 🗓️ Data opcional (ISO)
    const targetDate = req.query.date ? String(req.query.date) : undefined;

    const { items, total } = await this.repo.findExpiringPrescriptions(
      tenantId,
      branchId,
      page,
      limit,
      targetDate,
    );

    return new PagedResponse(
      `Receitas vencidas listadas com sucesso${
        targetDate ? ` para ${targetDate}` : ""
      }.`,
      req,
      items,
      page,
      limit,
      total,
    );
  }

  // =========================================================
  // 🔹 DELETE
  // =========================================================
  async delete(req: Request, prescriptionId: number) {
    const user = req.user!;
    const tenantId = user.tenantId;
    const userId = user.sub;

    const existing = await this.repo.findById(prescriptionId, tenantId);
    if (!existing) {
      return ApiResponse.error("Receita não encontrada.", 404, req);
    }

    await this.repo.delete(prescriptionId, tenantId, userId);

    return ApiResponse.success("Receita deletada com sucesso.", req);
  }
}
