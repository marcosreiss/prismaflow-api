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
} from "./client.controller";
import { getPrescriptionsByClientId } from "../prescriptions/prescription.controller";
import { CreateClientDto, UpdateClientDto } from "./client.dto";

export const clientRoutes = Router();

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

// 🔹 ROTAS MAIS ESPECÍFICAS PRIMEIRO
clientRoutes.get(
  "/select",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  selectClients,
);

clientRoutes.get(
  "/:clientId/prescriptions",
  authGuard,
  getPrescriptionsByClientId,
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

// 🔹 SOMENTE DEPOIS as rotas genéricas
clientRoutes.get(
  "/:id",
  authGuard,
  requireRoles("ADMIN", "MANAGER", "EMPLOYEE"),
  getClientById,
);
