import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/authorize.middleware";
import {
  getBalance,
  getSalesSummary,
  getPaymentsByStatus,
  getTopProducts,
  getTopClients,
  getOverdueInstallments,
} from "./dashboard.controller";

export const dashboardRoutes = Router();

// ADMIN e MANAGER têm acesso
dashboardRoutes.get(
  "/balance",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getBalance,
);
dashboardRoutes.get(
  "/sales-summary",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getSalesSummary,
);
dashboardRoutes.get(
  "/payments-status",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getPaymentsByStatus,
);
dashboardRoutes.get(
  "/top-products",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getTopProducts,
);
dashboardRoutes.get(
  "/top-clients",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getTopClients,
);
dashboardRoutes.get(
  "/overdue-installments",
  authGuard,
  requireRoles("ADMIN", "MANAGER"),
  getOverdueInstallments,
);
