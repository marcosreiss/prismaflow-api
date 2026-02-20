import { Request, Response } from "express";
import { PaymentInstallmentPayService } from "../services/payment-installment-pay.service";
import { PaymentInstallmentService } from "../services/payment-installment.service";

const installmentService = new PaymentInstallmentService();
const installmentPayService = new PaymentInstallmentPayService();

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleError(res: Response, error: any, fallbackMessage: string) {
  res.status(400).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export async function listInstallmentsByPayment(req: Request, res: Response) {
  try {
    const result = await installmentService.findByPaymentId(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao listar parcelas.");
  }
}

export async function getInstallmentById(req: Request, res: Response) {
  try {
    const result = await installmentService.findById(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao buscar parcela.");
  }
}

export async function listOverdueInstallments(req: Request, res: Response) {
  try {
    const result = await installmentService.findOverdue(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao listar parcelas vencidas.");
  }
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

export async function updateInstallment(req: Request, res: Response) {
  try {
    const result = await installmentService.update(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao atualizar parcela.");
  }
}

export async function payInstallment(req: Request, res: Response) {
  try {
    const result = await installmentPayService.payInstallment(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao registrar pagamento da parcela.");
  }
}
