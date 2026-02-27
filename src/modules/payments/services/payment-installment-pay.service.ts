import { Request } from "express";
import { ApiResponse } from "@/responses/ApiResponse";
import { PaymentInstallmentRepository } from "@/modules/payments/repository/payment-installment.repository";
import { PaymentIntegrityService } from "./payment-integrity.service";

export class PaymentInstallmentPayService {
  private repo = new PaymentInstallmentRepository();
  private integrityService = new PaymentIntegrityService();

  // ─── Registrar Pagamento de Parcela ──────────────────────────────────────────

  async payInstallment(req: Request) {
    const user = req.user!;
    const { id } = req.params;
    const { paidAmount, paidAt } = req.body;
    const userId = user.sub;

    const installment = await this.repo.findById(Number(id));
    if (!installment) {
      return ApiResponse.error("Parcela não encontrada.", 404, req);
    }

    if (installment.tenantId !== user.tenantId) {
      return ApiResponse.error(
        "Você não tem permissão para acessar esta parcela.",
        403,
        req
      );
    }

    if (installment.paidAt !== null) {
      return ApiResponse.error("Esta parcela já foi paga completamente.", 400, req);
    }

    const remainingAmount = installment.amount - installment.paidAmount;
    if (paidAmount > remainingAmount) {
      return ApiResponse.error(
        `O valor pago (${paidAmount}) não pode ser maior que o valor restante da parcela (${remainingAmount.toFixed(2)}).`,
        400,
        req
      );
    }

    const newPaidAmount = installment.paidAmount + paidAmount;
    const isFullyPaid = newPaidAmount >= installment.amount;
    const paymentDate = paidAt ? new Date(paidAt) : new Date();

    await this.repo.update(
      Number(id),
      {
        paidAmount: newPaidAmount,
        paidAt: isFullyPaid ? paymentDate : null,
      },
      userId
    );

    const paymentId = installment.paymentMethodItem.payment.id;
    await this.integrityService.recalculatePaymentStatus(paymentId, userId);

    const final = await this.repo.findById(Number(id));

    return ApiResponse.success(
      "Pagamento da parcela registrado com sucesso.",
      req,
      {
        installment: final,
        message: isFullyPaid
          ? "Parcela paga completamente."
          : `Pagamento parcial registrado. Restante: R$ ${(installment.amount - newPaidAmount).toFixed(2)}`,
      }
    );
  }
}
