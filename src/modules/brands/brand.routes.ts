import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createBrand,
  updateBrand,
  listBrands,
  deleteBrand,
} from "./brand.controller";
import { CreateBrandDto, UpdateBrandDto } from "./dtos/brand.dto";

export const brandRoutes = Router();

brandRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN"),
  validateDto(CreateBrandDto, "body"),
  createBrand
);

brandRoutes.get("/", authGuard, requireRoles("ADMIN"), listBrands);

brandRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN"),
  validateDto(UpdateBrandDto, "body"),
  updateBrand
);

brandRoutes.delete("/:id", authGuard, requireRoles("ADMIN"), deleteBrand);
