import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";

import {
  createPrescription,
  updatePrescription,
  getPrescriptionById,
  listPrescriptions,
} from "./prescription.controller";
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
} from "./prescription.dto";

export const prescriptionRoutes = Router();

prescriptionRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(CreatePrescriptionDto, "body"),
  createPrescription
);

prescriptionRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(UpdatePrescriptionDto, "body"),
  updatePrescription
);

prescriptionRoutes.get(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  getPrescriptionById
);

prescriptionRoutes.get(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  listPrescriptions
);
