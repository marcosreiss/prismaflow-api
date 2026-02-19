import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { branchRoutes } from "../modules/branches/branch.routes";
import { userRoutes } from "../modules/users/user.routes";
import { brandRoutes } from "../modules/brands/brand.routes";
import { productRoutes } from "../modules/products/product.routes";
import { opticalServiceRoutes } from "../modules/optical-services/optical-service.routes";
import { clientRoutes } from "../modules/clients/client.routes";
import { prescriptionRoutes } from "../modules/prescriptions/prescription.routes";
import { saleRoutes } from "../modules/sales/sale.routes";
import { paymentRoutes } from "../modules/payments/routes/payment.routes";
import { paymentInstallmentRoutes } from "../modules/payments/routes/payment-installment.routes";

export const router = Router();

router.get("/", (req, res) => {
  res.send("PrismaFlow API funcionando!");
});

router.use("/auth", authRoutes);
router.use("/branches", branchRoutes);
router.use("/users", userRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/optical-services", opticalServiceRoutes);
router.use("/clients", clientRoutes);
router.use("/prescriptions", prescriptionRoutes);
router.use("/sales", saleRoutes);
router.use("/payments", paymentRoutes);
router.use("/payment-installments", paymentInstallmentRoutes);
