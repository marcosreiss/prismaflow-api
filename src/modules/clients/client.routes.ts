import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createClient,
  updateClient,
  getClientById,
  listClients,
} from "./client.controller";
import { getPrescriptionsByClientId } from "../prescriptions/prescription.controller";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

export const clientRoutes = Router();

clientRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(CreateClientDto, "body"),
  createClient
);

clientRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(UpdateClientDto, "body"),
  updateClient
);

clientRoutes.get(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  getClientById
);

clientRoutes.get(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  listClients
);

clientRoutes.get(
  "/:clientId/prescriptions",
  authGuard,
  getPrescriptionsByClientId
);
