import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createBrand,
  updateBrand,
  listBrands,
  getBrandById,
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

brandRoutes.get(
  "/",
  authGuard,
  requireRoles("ADMIN"),
  listBrands // suporta ?page=&limit=&search=
);

brandRoutes.get("/:id", authGuard, requireRoles("ADMIN"), getBrandById);

brandRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN"),
  validateDto(UpdateBrandDto, "body"),
  updateBrand
);

brandRoutes.delete("/:id", authGuard, requireRoles("ADMIN"), deleteBrand);
