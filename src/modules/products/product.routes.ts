// src/modules/products/product.routes.ts
import { Router } from "express";
import { authGuard } from "../../middlewares/auth.middleware";
import { validateDto } from "../../middlewares/validation.middleware";
import {
  createProduct,
  updateProduct,
  listProducts,
  getProductById,
  deleteProduct,
} from "./product.controller";
import { CreateProductDto, UpdateProductDto } from "./product.dto";
import { getProductStock } from "./product.controller";

export const productRoutes = Router();

// 🔹 Criar produto
productRoutes.post(
  "/",
  authGuard,
  validateDto(CreateProductDto, "body"),
  createProduct,
);

// 🔹 Listar produtos com paginação, busca e filtro
productRoutes.get("/", authGuard, listProducts);

// 🔹 Buscar produto por ID
productRoutes.get("/:id", authGuard, getProductById);

// 🔹 Atualizar produto
productRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdateProductDto, "body"),
  updateProduct,
);

// 🔹 Excluir produto
productRoutes.delete("/:id", authGuard, deleteProduct);

productRoutes.get("/:id/stock", authGuard, getProductStock);
