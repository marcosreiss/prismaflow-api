// src/modules/users/user.routes.ts
import { Router } from "express";
import { createUser, listUsers } from "./user.controller";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import { CreateUserDto } from "./user.dto";
import { Role } from "@prisma/client";

export const userRoutes = Router();

userRoutes.post(
  "/",
  authGuard,
  requireRoles(Role.ADMIN, Role.MANAGER),
  validateDto(CreateUserDto, "body"),
  createUser,
);

userRoutes.get(
  "/",
  authGuard,
  requireRoles(Role.ADMIN, Role.MANAGER),
  listUsers,
);
