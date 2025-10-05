import { Request, Response, NextFunction } from "express";
import { OpticalServiceService } from "./optical-service.service";

const service = new OpticalServiceService();

export const createOpticalService = async (
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

export const updateOpticalService = async (
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

export const listOpticalServices = async (
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

export const getOpticalServiceById = async (
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

export const deleteOpticalService = async (
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
