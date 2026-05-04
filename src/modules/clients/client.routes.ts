// src/modules/clients/client.routes.ts
import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createClient,
  updateClient,
  getClientById,
  listClients,
  selectClients,
  listBirthdays,
  deleteClient,
} from "./client.controller";
import { getPrescriptionsByClientId } from "../prescriptions/prescription.controller";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

export const clientRoutes = Router();

// Rotas específicas antes das genéricas
clientRoutes.get(
  "/select",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  selectClients,
);

clientRoutes.get(
  "/birthdays",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  listBirthdays,
);

clientRoutes.get(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  listClients,
);

clientRoutes.get(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  getClientById,
);

clientRoutes.post(
  "/",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(CreateClientDto, "body"),
  createClient,
);

clientRoutes.put(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  validateDto(UpdateClientDto, "body"),
  updateClient,
);

clientRoutes.delete(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  deleteClient,
);

clientRoutes.get(
  "/:clientId/prescriptions",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  getPrescriptionsByClientId,
);
