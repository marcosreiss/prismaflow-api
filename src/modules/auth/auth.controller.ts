import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterAdminDto } from "./auth.dto";

const service = new AuthService();

export const registerAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dto: RegisterAdminDto = req.body;
    const result = await service.registerAdmin(req, dto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dto: LoginDto = req.body;
    const result = await service.login(req, dto);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};
