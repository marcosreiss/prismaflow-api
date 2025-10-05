import { Router } from "express";
import {
  registerAdmin,
  login,
  changePassword,
  registerUser,
} from "./auth.controller";
import { validateDto } from "../../middlewares/validation.middleware";
import { authGuard } from "../../middlewares/auth.middleware";
import {
  RegisterAdminDto,
  LoginDto,
  ChangePasswordDto,
  RegisterUserDto,
} from "./dtos/auth.dto";
import { Role } from "@prisma/client";
import { requireRoles } from "../../middlewares/authorize.middleware";

export const authRoutes = Router();

authRoutes.post(
  "/register-admin",
  validateDto(RegisterAdminDto, "body"),
  registerAdmin
);

authRoutes.post("/login", validateDto(LoginDto, "body"), login);

authRoutes.put(
  "/change-password",
  authGuard,
  validateDto(ChangePasswordDto, "body"),
  changePassword
);

authRoutes.post(
  "/register-user",
  authGuard, // precisa estar logado
  requireRoles(Role.ADMIN), // apenas ADMIN pode criar
  validateDto(RegisterUserDto, "body"),
  registerUser
);
