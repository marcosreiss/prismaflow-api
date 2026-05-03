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
  getProductStock,
} from "./product.controller";
import { CreateProductDto, UpdateProductDto } from "./product.dto";

export const productRoutes = Router();

//  Criar produto
productRoutes.post(
  "/",
  authGuard,
  validateDto(CreateProductDto, "body"),
  createProduct,
);

//  Listar produtos com paginação, busca e filtro
productRoutes.get("/", authGuard, listProducts);

//  Buscar estoque de um produto
productRoutes.get("/:id/stock", authGuard, getProductStock);

// Buscar produto por ID
productRoutes.get("/:id", authGuard, getProductById);

// Atualizar produto
productRoutes.put(
  "/:id",
  authGuard,
  validateDto(UpdateProductDto, "body"),
  updateProduct,
);

// Excluir produto
productRoutes.delete("/:id", authGuard, deleteProduct);
