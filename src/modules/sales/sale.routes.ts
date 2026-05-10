// src/modules/sales/sale.routes.ts
import { Router } from "express";
import {
  createSale,
  deleteSale,
  getSaleById,
  getSalesByClient,
  listSales,
  updateSale,
} from "./sale.controller";
import { CreateSaleDto, UpdateSaleDto } from "./dtos/sale.dto";
import { authGuard } from "@/middlewares/auth.middleware";
import { validateDto } from "@/middlewares/validation.middleware";

export const saleRoutes = Router();

saleRoutes.post(
  "/",
  authGuard,
  validateDto(CreateSaleDto, "body"),
  createSale,
);

saleRoutes.get("/", authGuard, listSales);

saleRoutes.get("/by-client/:clientId", authGuard, getSalesByClient);

saleRoutes.get("/:id", authGuard, getSaleById);

saleRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdateSaleDto, "body"),
  updateSale,
);

saleRoutes.delete("/:id", authGuard, deleteSale);