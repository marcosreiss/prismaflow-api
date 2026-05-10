// src/modules/sales/sale.controller.ts
import { NextFunction, Request, Response } from "express";
import { SaleService } from "./sale.service";
import logger from "@/utils/logger";

const service = new SaleService();

export async function createSale(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.create(req);
    return res.status(result.status ?? 201).json(result);
  } catch (err) {
    logger.error("Erro ao criar venda", { err });
    next(err);
  }
}

export async function updateSale(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.update(req);
    return res.status(result.status ?? 200).json(result);
  } catch (err) {
    logger.error("Erro ao atualizar venda", {
      saleId: req.params.id,
      err,
    });
    next(err);
  }
}

export async function listSales(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.findAll(req);
    return res.status(result.status ?? 200).json(result);
  } catch (err) {
    logger.error("Erro ao listar vendas", { err });
    next(err);
  }
}

export async function getSaleById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.findById(req);
    return res.status(result.status ?? 200).json(result);
  } catch (err) {
    logger.error("Erro ao buscar venda por ID", {
      saleId: req.params.id,
      err,
    });
    next(err);
  }
}

export async function getSalesByClient(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.findByClient(req);
    return res.status(result.status ?? 200).json(result);
  } catch (err) {
    logger.error("Erro ao listar vendas por cliente", {
      clientId: req.params.clientId,
      err,
    });
    next(err);
  }
}

export async function deleteSale(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.delete(req);
    return res.status(result.status ?? 200).json(result);
  } catch (err) {
    logger.error("Erro ao remover venda", {
      saleId: req.params.id,
      err,
    });
    next(err);
  }
}
