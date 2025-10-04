import { Request, Response, NextFunction } from "express";
import { BrandService } from "./brand.service";

const service = new BrandService();

export const createBrand = async (
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

export const updateBrand = async (
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

export const listBrands = async (
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

export const getBrandById = async (
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

export const deleteBrand = async (
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
