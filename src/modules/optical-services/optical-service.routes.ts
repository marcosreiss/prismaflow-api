import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createOpticalService,
  updateOpticalService,
  listOpticalServices,
  getOpticalServiceById,
  deleteOpticalService,
} from "./optical-service.controller";
import { CreateOpticalServiceDto, UpdateOpticalServiceDto } from "./optical-service.dto";

export const opticalServiceRoutes = Router();

opticalServiceRoutes.post(
  "/",
  authGuard,
  validateDto(CreateOpticalServiceDto, "body"),
  createOpticalService
);

opticalServiceRoutes.get("/", authGuard, listOpticalServices);

opticalServiceRoutes.get("/:id", authGuard, getOpticalServiceById);

opticalServiceRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdateOpticalServiceDto, "body"),
  updateOpticalService
);

opticalServiceRoutes.delete("/:id", authGuard, deleteOpticalService);
