// src/modules/payments/routes/payment-method-item.routes.ts

import { Router } from "express";
import { authGuard } from "../../../middlewares/auth.middleware";
import { deleteMethodItem } from "../controller/payment-method-item.controller";

export const paymentMethodItemRoutes = Router();

paymentMethodItemRoutes.delete("/:id", authGuard, deleteMethodItem);
