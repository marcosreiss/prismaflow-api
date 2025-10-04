import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";

const service = new UserService();

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.create(req, req.body);
    res.status(result.status).json(result);
  } catch (e) {
    next(e);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.list(req);
    res.status(result.status).json(result);
  } catch (e) {
    next(e);
  }
};
