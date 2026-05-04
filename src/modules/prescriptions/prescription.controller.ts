// src/modules/prescriptions/prescription.controller.ts
import { Request, Response, NextFunction } from "express";
import { PrescriptionService } from "./prescription.service";
import { AppError } from "../../utils/app-error";
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "./prescription.dto";

const service = new PrescriptionService();

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ID inválido.", 400);
  return id;
}

export const createPrescription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(req, req.body as CreatePrescriptionDto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updatePrescription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(
      req,
      parseId(req.params.id),
      req.body as UpdatePrescriptionDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getPrescriptionById = async (
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

export const listPrescriptions = async (
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

export const getPrescriptionsByClientId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clientId = parseId(req.params.clientId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const result = await service.getByClientId(req, clientId, page, limit);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listExpiringPrescriptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.listExpiringPrescriptions(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const deletePrescription = async (
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
