import { Request, Response } from "express";
import { PaymentService } from "./services/payment.service";

const service = new PaymentService();

// 🔹 Criar pagamento
export async function createPayment(req: Request, res: Response) {
  try {
    const result = await service.create(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao criar pagamento.",
    });
  }
}

// 🔹 Atualizar pagamento
export async function updatePayment(req: Request, res: Response) {
  try {
    const result = await service.update(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao atualizar pagamento.",
    });
  }
}

// 🔹 Listar pagamentos (paginado)
export async function listPayments(req: Request, res: Response) {
  try {
    const result = await service.findAll(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao listar pagamentos.",
    });
  }
}

// 🔹 Buscar pagamento por ID
export async function getPaymentById(req: Request, res: Response) {
  try {
    const result = await service.findById(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao buscar pagamento.",
    });
  }
}

// 🔹 Buscar status do pagamento por saleId
export async function getPaymentStatusBySale(req: Request, res: Response) {
  try {
    const result = await service.findStatusBySaleId(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao buscar status do pagamento.",
    });
  }
}

// 🔹 Excluir pagamento
export async function deletePayment(req: Request, res: Response) {
  try {
    const result = await service.delete(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao excluir pagamento.",
    });
  }
}

// payment.controller.ts - Adicione esta função
export async function updatePaymentStatus(req: Request, res: Response) {
  try {
    const result = await service.updateStatus(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao atualizar status do pagamento.",
    });
  }
}

// 🔹 Validar integridade do pagamento
export async function validatePayment(req: Request, res: Response) {
  try {
    const result = await service.validate(req);
    res.status(result.status || 200).json(result);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Erro ao validar pagamento.",
    });
  }
}
