import { Router } from "express";
import { createBranch } from "./branch.controller";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import { CreateBranchDto } from "./dtos/create-branch.dto";

export const branchRoutes = Router();

branchRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN"),
  validateDto(CreateBranchDto, "body"),
  createBranch
);
