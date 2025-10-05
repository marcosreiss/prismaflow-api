import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createSale,
  updateSale,
  listSales,
  getSaleById,
  deleteSale,
} from "./sale.controller";
import { CreateSaleDto, UpdateSaleDto } from "./dtos/sale.dto";

export const saleRoutes = Router();

// 🔹 Criar venda
saleRoutes.post(
  "/",
  authGuard,
  validateDto(CreateSaleDto, "body"),
  createSale
);

// 🔹 Listar vendas
saleRoutes.get("/", authGuard, listSales);

// 🔹 Buscar venda por ID
saleRoutes.get("/:id", authGuard, getSaleById);

// 🔹 Atualizar venda
saleRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdateSaleDto, "body"),
  updateSale
);

// 🔹 Excluir venda
saleRoutes.delete("/:id", authGuard, deleteSale);
