// src/modules/prescriptions/prescription.service.ts
import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { PagedResponse } from "../../responses/PagedResponse";
import { PrescriptionRepository } from "./prescription.repository";
import { ClientRepository } from "../clients/client.repository";
import { AppError } from "../../utils/app-error";
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "./prescription.dto";

export class PrescriptionService {
  private repo = new PrescriptionRepository();
  private clientRepo = new ClientRepository();

  async create(req: Request, dto: CreatePrescriptionDto) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);
    if (!user.branchId)
      throw new AppError("Usuário não está associado a nenhuma filial.", 403);

    // Valida que o cliente pertence ao tenant
    const client = await this.clientRepo.findById(dto.clientId, user.tenantId);
    if (!client) throw new AppError("Cliente não encontrado.", 404);

    const prescription = await this.repo.create(
      user.tenantId,
      {
        ...dto,
        prescriptionDate: dto.prescriptionDate
          ? new Date(dto.prescriptionDate)
          : undefined,
        branchId: user.branchId,
      },
      user.sub,
    );

    return ApiResponse.success(
      "Receita criada com sucesso.",
      req,
      prescription,
    );
  }

  async update(
    req: Request,
    prescriptionId: number,
    dto: UpdatePrescriptionDto,
  ) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const existing = await this.repo.findById(prescriptionId, user.tenantId);
    if (!existing) throw new AppError("Receita não encontrada.", 404);

    const updated = await this.repo.update(
      prescriptionId,
      {
        ...dto,
        prescriptionDate: dto.prescriptionDate
          ? new Date(dto.prescriptionDate)
          : undefined,
      },
      user.sub,
    );

    return ApiResponse.success("Receita atualizada com sucesso.", req, updated);
  }

  async getById(req: Request, prescriptionId: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const prescription = await this.repo.findById(
      prescriptionId,
      user.tenantId,
    );
    if (!prescription) throw new AppError("Receita não encontrada.", 404);

    return ApiResponse.success(
      "Receita encontrada com sucesso.",
      req,
      prescription,
    );
  }

  async list(req: Request) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const clientId = req.query.clientId
      ? Number(req.query.clientId)
      : undefined;

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
      clientId,
      branchId,
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

  async getByClientId(
    req: Request,
    clientId: number,
    page: number,
    limit: number,
  ) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const { items, total } = await this.repo.findByClientId(
      user.tenantId,
      clientId,
      Math.max(1, page),
      Math.max(1, Math.min(100, limit)),
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
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const targetDate = req.query.date ? String(req.query.date) : undefined;

    const branchId =
      user.role === "EMPLOYEE"
        ? user.branchId
        : req.query.branchId
          ? String(req.query.branchId)
          : undefined;

    const { items, total } = await this.repo.findExpiringPrescriptions(
      user.tenantId,
      page,
      limit,
      targetDate,
      branchId,
    );

    return new PagedResponse(
      `Receitas vencidas listadas com sucesso${targetDate ? ` para ${targetDate}` : ""}.`,
      req,
      items,
      page,
      limit,
      total,
    );
  }

  async delete(req: Request, prescriptionId: number) {
    const user = req.user;
    if (!user) throw new AppError("Usuário não autenticado.", 401);

    const existing = await this.repo.findById(prescriptionId, user.tenantId);
    if (!existing) throw new AppError("Receita não encontrada.", 404);

    const hasRelations = await this.repo.hasSales(prescriptionId);

    if (hasRelations) {
      await this.repo.softDelete(prescriptionId, user.sub);
    } else {
      await this.repo.hardDelete(prescriptionId);
    }

    return ApiResponse.success("Receita deletada com sucesso.", req);
  }
}
