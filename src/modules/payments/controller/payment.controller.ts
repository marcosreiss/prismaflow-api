import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service";
import { PaymentUpdateService } from "../services/payment-update.service";

const paymentService = new PaymentService();
const updateService = new PaymentUpdateService();

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleError(res: Response, error: any, fallbackMessage: string) {
  res.status(400).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export async function createPayment(req: Request, res: Response) {
  try {
    const result = await paymentService.create(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao criar pagamento.");
  }
}

export async function listPayments(req: Request, res: Response) {
  try {
    const result = await paymentService.findAll(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao listar pagamentos.");
  }
}

export async function getPaymentById(req: Request, res: Response) {
  try {
    const result = await paymentService.findById(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao buscar pagamento.");
  }
}

export async function getPaymentStatusBySale(req: Request, res: Response) {
  try {
    const result = await paymentService.findStatusBySaleId(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao buscar status do pagamento.");
  }
}

export async function deletePayment(req: Request, res: Response) {
  try {
    const result = await paymentService.delete(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao excluir pagamento.");
  }
}

// ─── Payment Update ───────────────────────────────────────────────────────────

export async function updatePayment(req: Request, res: Response) {
  try {
    const result = await updateService.update(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao atualizar pagamento.");
  }
}

export async function updatePaymentStatus(req: Request, res: Response) {
  try {
    const result = await updateService.updateStatus(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao atualizar status do pagamento.");
  }
}

export async function validatePayment(req: Request, res: Response) {
  try {
    const result = await updateService.validate(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    handleError(res, error, "Erro ao validar pagamento.");
  }
}
