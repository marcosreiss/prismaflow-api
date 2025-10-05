import { Router } from "express";

// 🧩 Rotas de módulos
import { authRoutes } from "../modules/auth/auth.routes";
import { branchRoutes } from "../modules/branches/branch.routes";
import { userRoutes } from "../modules/users/user.routes";
import { brandRoutes } from "../modules/brands/brand.routes";
import { productRoutes } from "../modules/products/product.routes";
import { opticalServiceRoutes } from "../modules/optical-services/optical-service.routes";

export const router = Router();

// 🔹 Rota básica de status
router.get("/", (req, res) => {
  res.send("🚀 PrismaFlow API funcionando!");
});

// 🔹 Registro das rotas de módulos
router.use("/auth", authRoutes);
router.use("/branches", branchRoutes);
router.use("/users", userRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/optical-services", opticalServiceRoutes);
