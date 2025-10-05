import { Router } from "express";
import { registerAdmin, login, changePassword } from "./auth.controller";
import { validateDto } from "../../middlewares/validation.middleware";
import { authGuard } from "../../middlewares/auth.middleware";
import { RegisterAdminDto, LoginDto, ChangePasswordDto } from "./dtos/auth.dto";

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
