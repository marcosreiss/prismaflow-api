// src/modules/brands/brand.controller.ts
import { Request, Response, NextFunction } from "express";
import { BrandService } from "./brand.service";
import { AppError } from "../../utils/app-error";
import { CreateBrandDto, UpdateBrandDto } from "./brand.dto";

const service = new BrandService();

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ID inválido.", 400);
  return id;
}

export const createBrand = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(req, req.body as CreateBrandDto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateBrand = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(
      req,
      parseId(req.params.id),
      req.body as UpdateBrandDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listBrands = async (
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

export const getBrandById = async (
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

export const deleteBrand = async (
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
