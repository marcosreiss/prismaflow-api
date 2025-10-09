import { Request, Response, NextFunction } from "express";
import { ProductService } from "./product.service";

const service = new ProductService();

/**
 * Cria um novo produto
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.create(req, req.body);
    res.status(result.status).json(result);
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
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(req, id, req.body);
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
  next: NextFunction
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
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.getById(req, id);
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
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.delete(req, id);
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
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const result = await service.getStock(req, id);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
