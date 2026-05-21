import { Request } from "express";
import { prisma } from "@/config/prisma-context";
import { AppError } from "@/utils/app-error";
import logger from "@/utils/logger";
import { ClientRepository } from "@/modules/clients/client.repository";
import { SaleUserContext } from "../utils/sale.types";

export class SaleValidationService {
  private clientRepo = new ClientRepository();

  extractUser(req: Request): SaleUserContext {
    const user = req.user;

    if (!user?.sub || !user?.tenantId || !user?.branchId) {
      throw new AppError("Usuário autenticado inválido.", 401);
    }

    return {
      userId: user.sub,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };
  }

  validateSaleId(idParam: string) {
    const id = Number(idParam);

    if (Number.isNaN(id) || id <= 0) {
      throw new AppError("ID inválido.", 400);
    }

    return id;
  }

  validateSaleDate(saleDate: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const normalizedSaleDate = new Date(saleDate);
    normalizedSaleDate.setHours(0, 0, 0, 0);

    if (normalizedSaleDate > today) {
      throw new AppError("A data da venda não pode ser futura.", 400);
    }
  }

  async validateClient(clientId: number, tenantId: string) {
    const client = await this.clientRepo.findById(clientId, tenantId);

    if (!client) {
      throw new AppError("Cliente não encontrado.", 404);
    }

    return client;
  }

  async validatePrescription(
    prescriptionId: number,
    clientId: number,
    tenantId: string,
  ) {
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        clientId,
        tenantId,
        isActive: true,
      },
    });

    if (!prescription) {
      throw new AppError(
        "Receita não encontrada ou não pertence a este cliente.",
        404,
      );
    }

    return prescription;
  }

  normalizeSaleDateForPersistence(
    saleDate: Date | string | null | undefined,
    context: {
      saleId: number;
      source: "changedFields" | "storedSale";
    },
  ) {
    if (saleDate == null) {
      return undefined;
    }

    if (saleDate instanceof Date) {
      if (Number.isNaN(saleDate.getTime())) {
        logger.error("Sale update received invalid Date instance for saleDate.", {
          saleId: context.saleId,
          source: context.source,
        });
        throw new AppError("Data da venda inválida.", 400);
      }

      return saleDate;
    }

    const normalizedDate = new Date(saleDate);

    if (Number.isNaN(normalizedDate.getTime())) {
      logger.error("Sale update could not parse saleDate string.", {
        saleId: context.saleId,
        source: context.source,
        saleDate,
      });
      throw new AppError("Data da venda inválida.", 400);
    }

    logger.debug("Sale update normalized string saleDate before persistence.", {
      saleId: context.saleId,
      source: context.source,
      originalSaleDate: saleDate,
      normalizedSaleDate: normalizedDate.toISOString(),
    });

    return normalizedDate;
  }
}
