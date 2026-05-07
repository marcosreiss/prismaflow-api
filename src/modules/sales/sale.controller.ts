// src/modules/sales/sale.controller.ts
import { Request, Response } from "express";
import { SaleService } from "./sale.service";
import logger from "../../utils/logger";

const service = new SaleService();

// ======================================================
// 🔹 Criar venda
// ======================================================
export async function createSale(req: Request, res: Response) {
  logger.debug("🟦 [SaleController] Requisição recebida - Criar venda", {
    body: req.body,
    user: req.user,
  });

  try {
    const result = await service.create(req);
    logger.info("✅ [SaleController] Resposta da criação de venda", {
      status: result.status,
    });
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    logger.error("❌ [SaleController] Erro ao criar venda", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}

// ======================================================
// 🔹 Atualizar venda
// ======================================================
export async function updateSale(req: Request, res: Response) {
  logger.debug("🟨 [SaleController] Requisição recebida - Atualizar venda", {
    params: req.params,
    body: req.body,
  });

  try {
    const result = await service.updateSale(req);
    logger.info("✅ [SaleController] Venda atualizada", {
      status: result.status,
      saleId: req.params.id,
    });
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    logger.error("❌ [SaleController] Erro ao atualizar venda", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}

// ======================================================
// 🔹 Listar vendas (paginado)
// ======================================================
export async function listSales(req: Request, res: Response) {
  logger.debug("📋 [SaleController] Requisição recebida - Listar vendas", {
    query: req.query,
  });

  try {
    const result = await service.findAll(req);
    logger.info("✅ [SaleController] Vendas listadas com sucesso", {
      totalElements: result.data?.totalElements ?? "N/A",
      page: result.data?.totalPages ?? "N/A",
      limit: result.data?.limit ?? "N/A",
    });

    res.status(result.status || 200).json(result);
  } catch (error: any) {
    logger.error("❌ [SaleController] Erro ao listar vendas", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}

// ======================================================
// 🔹 Buscar venda por ID
// ======================================================
export async function getSaleById(req: Request, res: Response) {
  logger.debug(
    "🔍 [SaleController] Requisição recebida - Buscar venda por ID",
    {
      id: req.params.id,
    },
  );

  try {
    const result = await service.findById(req);
    logger.info("✅ [SaleController] Venda buscada com sucesso", {
      id: req.params.id,
      status: result.status,
    });
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    logger.error("❌ [SaleController] Erro ao buscar venda", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}

// ======================================================
// 🔹 Excluir venda
// ======================================================
export async function deleteSale(req: Request, res: Response) {
  logger.debug("🗑️ [SaleController] Requisição recebida - Excluir venda", {
    id: req.params.id,
  });

  try {
    const result = await service.delete(req);
    logger.info("✅ [SaleController] Venda excluída com sucesso", {
      id: req.params.id,
      status: result.status,
    });
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    logger.error("❌ [SaleController] Erro ao excluir venda", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ success: false, message: error.message });
  }
}
