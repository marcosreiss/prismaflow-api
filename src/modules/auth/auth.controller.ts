// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import {
  RegisterAdminDto,
  LoginDto,
  ChangePasswordDto,
  RegisterUserDto,
  SelectBranchDto,
} from "./auth.dto";

const service = new AuthService();

export const registerAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.registerAdmin(
      req,
      req.body as RegisterAdminDto,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.login(req, req.body as LoginDto);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const selectBranch = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.selectBranch(req, req.body as SelectBranchDto);
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.changePassword(
      req,
      req.body as ChangePasswordDto,
    );
    res.status(result.status).json(result);
  } catch (err) {
    next(err);
  }
};

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await service.registerUser(req, req.body as RegisterUserDto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
