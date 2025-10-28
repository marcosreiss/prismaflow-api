import { Request, Response, NextFunction } from "express";
import { BranchService } from "./branch.service";

const service = new BranchService();

export const createBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body as { name: string };
    const result = await service.create(req, name);
    res.status(result.status).json(result);
  } catch (e) {
    next(e);
  }
};

export const listBranches = async (
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

export const selectBranches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await service.select(req);
    res.status(result.status).json(result);
  } catch (e) {
    next(e);
  }
};
