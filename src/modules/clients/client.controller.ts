// src/modules/clients/client.controller.ts
import { Request, Response, NextFunction } from "express";
import { ClientService } from "./client.service";
import { AppError } from "../../utils/app-error";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

const service = new ClientService();

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ID inválido.", 400);
  return id;
}

export const createClient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.create(req, req.body as CreateClientDto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateClient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.update(
      req,
      parseId(req.params.id),
      req.body as UpdateClientDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const getClientById = async (
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

export const listClients = async (
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

export const selectClients = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
) => {
  try {
    const result = await service.listBirthdays(req);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteClient = async (
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
