// src/modules/optical-services/optical-service.controller.ts
import { Request, Response, NextFunction } from "express";
import { OpticalServiceService } from "./optical-service.service";
import { AppError } from "../../utils/app-error";
import {
  CreateOpticalServiceDto,
  UpdateOpticalServiceDto,
} from "./optical-service.dto";

const service = new OpticalServiceService();

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ID inválido.", 400);
  return id;
}

export const createOpticalService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(
      req,
      req.body as CreateOpticalServiceDto,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateOpticalService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(
      req,
      parseId(req.params.id),
      req.body as UpdateOpticalServiceDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listOpticalServices = async (
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

export const getOpticalServiceById = async (
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

export const deleteOpticalService = async (
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
