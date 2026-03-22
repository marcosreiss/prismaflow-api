import { Request } from "express";
import { ApiResponse } from "../../responses/ApiResponse";
import { DashboardRepository } from "./dashboard.repository";

export class DashboardService {
  private repo = new DashboardRepository();

  private parseFilters(req: Request) {
    const user = req.user!;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    // ADMIN pode filtrar por filial; outros só veem a sua
    const branchId =
      user.role === "ADMIN"
        ? (req.query.branchId as string) || undefined
        : (user.branchId ?? undefined);

    return { tenantId: user.tenantId, branchId, startDate, endDate };
  }

  async getBalance(req: Request) {
    const { tenantId, branchId, startDate, endDate } = this.parseFilters(req);
    const data = await this.repo.getBalance(
      tenantId,
      branchId,
      startDate,
      endDate,
    );
    return ApiResponse.success("Balanço obtido com sucesso.", req, data);
  }

  async getSalesSummary(req: Request) {
    const { tenantId, branchId, startDate, endDate } = this.parseFilters(req);
    const data = await this.repo.getSalesSummary(
      tenantId,
      branchId,
      startDate,
      endDate,
    );
    return ApiResponse.success(
      "Resumo de vendas obtido com sucesso.",
      req,
      data,
    );
  }

  async getPaymentsByStatus(req: Request) {
    const { tenantId, branchId, startDate, endDate } = this.parseFilters(req);
    const data = await this.repo.getPaymentsByStatus(
      tenantId,
      branchId,
      startDate,
      endDate,
    );
    return ApiResponse.success(
      "Pagamentos por status obtidos com sucesso.",
      req,
      data,
    );
  }

  async getTopProducts(req: Request) {
    const { tenantId, branchId, startDate, endDate } = this.parseFilters(req);
    const limit = Number(req.query.limit) || 10;
    const data = await this.repo.getTopProducts(
      tenantId,
      branchId,
      startDate,
      endDate,
      limit,
    );
    return ApiResponse.success("Top produtos obtidos com sucesso.", req, data);
  }

  async getTopClients(req: Request) {
    const { tenantId, branchId, startDate, endDate } = this.parseFilters(req);
    const limit = Number(req.query.limit) || 10;
    const data = await this.repo.getTopClients(
      tenantId,
      branchId,
      startDate,
      endDate,
      limit,
    );
    return ApiResponse.success("Top clientes obtidos com sucesso.", req, data);
  }

  async getOverdueInstallments(req: Request) {
    const { tenantId, branchId } = this.parseFilters(req);
    const data = await this.repo.getOverdueInstallments(tenantId, branchId);
    return ApiResponse.success(
      "Parcelas em atraso obtidas com sucesso.",
      req,
      data,
    );
  }
}
