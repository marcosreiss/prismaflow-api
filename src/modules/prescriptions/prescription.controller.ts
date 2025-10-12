import { Request, Response, NextFunction } from "express";
import { PrescriptionService } from "./prescription.service";

const service = new PrescriptionService();

export const createPrescription = async (
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

export const updatePrescription = async (
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

export const getPrescriptionById = async (
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

export const listPrescriptions = async (
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

export const getPrescriptionsByClientId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clientId = Number(req.params.clientId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await service.getByClientId(req, clientId, page, limit);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listExpiringPrescriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.listExpiringPrescriptions(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
