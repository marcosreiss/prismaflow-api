// payment-installment.controller.ts

import { Request, Response } from "express";
import { PaymentInstallmentService } from "./payment-installment.service";

const service = new PaymentInstallmentService();

// 🔹 Listar parcelas de um pagamento
export async function listInstallmentsByPayment(req: Request, res: Response) {
  try {
    const result = await service.findByPaymentId(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao listar parcelas.",
    });
  }
}

// 🔹 Buscar parcela por ID
export async function getInstallmentById(req: Request, res: Response) {
  try {
    const result = await service.findById(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao buscar parcela.",
    });
  }
}

// 🔹 Registrar pagamento de parcela
export async function payInstallment(req: Request, res: Response) {
  try {
    const result = await service.payInstallment(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao registrar pagamento da parcela.",
    });
  }
}
