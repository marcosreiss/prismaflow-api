import { Request } from "express";
import { ApiResponse } from "../../../responses/ApiResponse";
import { PaymentRepository } from "../repository/payment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";
import { prisma } from "../../../config/prisma";

export class PaymentMethodItemService {
  private repo = new PaymentRepository();
  private integrityService = new PaymentIntegrityService();

  // ─── Criar Método em um Payment Existente ────────────────────────────────────

  async create(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId, branchId } = user;
    const { paymentId } = req.params;
    const { method, amount, installments, firstDueDate } = req.body;

    // Verificar se o payment existe e pertence ao tenant
    const payment = await this.repo.findById(Number(paymentId));
    if (!payment) {
      return ApiResponse.error("Pagamento não encontrado.", 404, req);
    }

    if (payment.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este pagamento.",
        403,
        req
      );
    }

    // Validar campos obrigatórios para métodos parcelados
    if (installments && installments > 0 && !firstDueDate) {
      return ApiResponse.error(
        "Para método parcelado, é necessário informar firstDueDate.",
        400,
        req
      );
    }

    // Criar o PaymentMethodItem
    const methodItem = await prisma.paymentMethodItem.create({
      data: {
        paymentId: Number(paymentId),
        method,
        amount,
        installments: installments || null,
        firstDueDate: firstDueDate ? new Date(firstDueDate) : null,
        tenantId,
        branchId,
        createdById: userId,
      },
    });

    // Gerar parcelas automaticamente se for método parcelado
    if (installments && installments > 0 && firstDueDate) {
      await this.integrityService.generateInstallments(
        {
          id: methodItem.id,
          amount,
          installments,
          firstDueDate: new Date(firstDueDate),
        },
        { tenantId, branchId, userId }
      );
    }

    const updated = await this.repo.findById(Number(paymentId));

    return ApiResponse.success("Método de pagamento adicionado com sucesso.", req, updated);
  }

  // ─── Atualizar Método ────────────────────────────────────────────────────────

  async update(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;
    const data = req.body;

    const methodItem = await prisma.paymentMethodItem.findUnique({
      where: { id: Number(id) },
      include: { installmentItems: true },
    });

    if (!methodItem) {
      return ApiResponse.error("Método de pagamento não encontrado.", 404, req);
    }

    if (methodItem.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este método.",
        403,
        req
      );
    }

    // Bloquear alteração se já existem parcelas pagas
    const hasPaidInstallments = methodItem.installmentItems.some(
      (inst) => inst.paidAt !== null
    );

    if (hasPaidInstallments) {
      return ApiResponse.error(
        "Não é possível alterar um método que já possui parcelas pagas.",
        400,
        req
      );
    }

    const updated = await prisma.paymentMethodItem.update({
      where: { id: Number(id) },
      data: {
        ...data,
        updatedById: userId,
      },
      include: { installmentItems: true },
    });

    return ApiResponse.success("Método de pagamento atualizado com sucesso.", req, updated);
  }

  // ─── Remover Método ──────────────────────────────────────────────────────────

  async delete(req: Request) {
    const user = req.user!;
    const { sub: userId, tenantId } = user;
    const { id } = req.params;

    const methodItem = await prisma.paymentMethodItem.findUnique({
      where: { id: Number(id) },
      include: { installmentItems: true },
    });

    if (!methodItem) {
      return ApiResponse.error("Método de pagamento não encontrado.", 404, req);
    }

    if (methodItem.tenantId !== tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar este método.",
        403,
        req
      );
    }

    // Bloquear remoção se há parcelas pagas
    const hasPaidInstallments = methodItem.installmentItems.some(
      (inst) => inst.paidAt !== null
    );

    if (hasPaidInstallments) {
      return ApiResponse.error(
        "Não é possível remover um método que já possui parcelas pagas.",
        400,
        req
      );
    }

    // Remover parcelas do método antes de remover o método
    await prisma.paymentInstallment.deleteMany({
      where: { paymentMethodItemId: Number(id) },
    });

    await prisma.paymentMethodItem.delete({
      where: { id: Number(id) },
    });

    return ApiResponse.success("Método de pagamento removido com sucesso.", req);
  }
}
