// src/modules/products/product.controller.ts
import { Request, Response, NextFunction } from "express";
import { ProductService } from "./product.service";
import { AppError } from "../../utils/app-error";
import { CreateProductDto, UpdateProductDto } from "./product.dto";

const service = new ProductService();

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ID inválido.", 400);
  return id;
}

/**
 * Cria um novo produto
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(req, req.body as CreateProductDto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Atualiza um produto existente
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(
      req,
      parseId(req.params.id),
      req.body as UpdateProductDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Lista produtos (paginado, com filtros opcionais)
 */
export const listProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.list(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Retorna um produto pelo ID
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getById(req, parseId(req.params.id));
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Exclui um produto
 */
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.delete(req, parseId(req.params.id));
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Retorna a quantidade em estoque de um produto
 */
export const getProductStock = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.getStock(req, parseId(req.params.id));
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
