import { Request, Response, NextFunction } from "express";
import { ClientService } from "./client.service";

const service = new ClientService();

export const createClient = async (
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

export const updateClient = async (
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

export const getClientById = async (
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

export const listClients = async (
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

export const selectClients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.select(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const listBirthdays = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.listBirthdays(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
