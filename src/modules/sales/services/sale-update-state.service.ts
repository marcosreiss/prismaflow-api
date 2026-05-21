import { prisma } from "@/config/prisma-context";
import { getChangedFields } from "@/utils/changed-fields";
import { AppError } from "@/utils/app-error";
import { UpdateSaleDto } from "../dtos/sale.dto";
import {
  ComparableSaleState,
  SaleRecord,
} from "../utils/sale.types";

export class SaleUpdateStateService {
  async getSalePaymentState(saleId: number, tenantId: string) {
    const payment = await prisma.payment.findFirst({
      where: {
        saleId,
        tenantId,
      },
      include: {
        methods: {
          select: {
            id: true,
            isPaid: true,
            paidAt: true,
            installmentItems: {
              select: {
                paidAt: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new AppError("Pagamento não encontrado para esta venda.", 404);
    }

    const hasPaidMethod = payment.methods.some(
      (method) => method.isPaid || method.paidAt !== null,
    );

    const hasPaidInstallment = payment.methods.some((method) =>
      method.installmentItems.some((installment) => installment.paidAt !== null),
    );

    const hasPaymentActivity =
      payment.status !== "PENDING" ||
      payment.paidAmount > 0 ||
      hasPaidMethod ||
      hasPaidInstallment;

    return {
      payment,
      hasPaymentActivity,
    };
  }

  private buildComparableSaleState(sale: SaleRecord): ComparableSaleState {
    return {
      clientId: sale.clientId,
      saleDate: sale.saleDate ?? null,
      prescriptionId: sale.prescriptionId ?? null,
      notes: sale.notes ?? null,
      discount: sale.discount ?? 0,
      productItems: sale.productItems
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          frameDetails: item.frameDetails
            ? {
              material: item.frameDetails.material,
              reference: item.frameDetails.reference ?? null,
              color: item.frameDetails.color ?? null,
            }
            : null,
        }))
        .sort((a, b) => a.productId - b.productId),
      serviceItems: sale.serviceItems
        .map((item) => ({
          serviceId: item.serviceId,
        }))
        .sort((a, b) => a.serviceId - b.serviceId),
      protocol: sale.protocol
        ? {
          book: sale.protocol.book ?? null,
          page: sale.protocol.page ?? null,
          os: sale.protocol.os ?? null,
        }
        : null,
    };
  }

  getChangedSaleFields(body: UpdateSaleDto, sale: SaleRecord) {
    const comparableCurrent = this.buildComparableSaleState(sale);

    const comparableIncoming: Partial<ComparableSaleState> = {
      ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
      ...(body.prescriptionId !== undefined
        ? { prescriptionId: body.prescriptionId ?? null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      ...(body.discount !== undefined ? { discount: body.discount } : {}),
      ...(body.productItems !== undefined
        ? {
          productItems: body.productItems
            .map((item) => ({
              productId: item.productId,
              quantity: item.quantity ?? 1,
              frameDetails: item.frameDetails
                ? {
                  material: item.frameDetails.material ?? null,
                  reference: item.frameDetails.reference ?? null,
                  color: item.frameDetails.color ?? null,
                }
                : null,
            }))
            .sort((a, b) => a.productId - b.productId),
        }
        : {}),
      ...(body.serviceItems !== undefined
        ? {
          serviceItems: body.serviceItems
            .map((item) => ({
              serviceId: item.serviceId,
            }))
            .sort((a, b) => a.serviceId - b.serviceId),
        }
        : {}),
      ...(body.protocol !== undefined
        ? {
          protocol: body.protocol
            ? {
              book: body.protocol.book ?? null,
              page: body.protocol.page ?? null,
              os: body.protocol.os ?? null,
            }
            : null,
        }
        : {}),
    };

    const changedComparable = getChangedFields<ComparableSaleState>(
      comparableIncoming,
      comparableCurrent,
    );

    const changedBody: Partial<UpdateSaleDto> = {};

    if ("clientId" in changedComparable) changedBody.clientId = body.clientId;
    if ("saleDate" in changedComparable) changedBody.saleDate = body.saleDate;
    if ("prescriptionId" in changedComparable) {
      changedBody.prescriptionId = body.prescriptionId;
    }
    if ("notes" in changedComparable) changedBody.notes = body.notes;
    if ("discount" in changedComparable) changedBody.discount = body.discount;
    if ("productItems" in changedComparable) {
      changedBody.productItems = body.productItems;
    }
    if ("serviceItems" in changedComparable) {
      changedBody.serviceItems = body.serviceItems;
    }
    if ("protocol" in changedComparable) changedBody.protocol = body.protocol;

    return changedBody;
  }

  ensureEditableFieldsWhenPaymentStarted(
    sale: SaleRecord,
    body: Partial<UpdateSaleDto>,
  ) {
    if (body.discount !== undefined) {
      throw new AppError(
        "Não é possível alterar desconto da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    if (body.serviceItems !== undefined) {
      throw new AppError(
        "Não é possível alterar os serviços da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    if (body.productItems === undefined) {
      return;
    }

    const currentItems = sale.productItems ?? [];

    if (body.productItems.length !== currentItems.length) {
      throw new AppError(
        "Não é possível alterar os produtos da venda quando já existem pagamentos registrados.",
        409,
      );
    }

    const currentByProductId = new Map(
      currentItems.map((item) => [item.productId, item]),
    );

    for (const item of body.productItems) {
      const currentItem = currentByProductId.get(item.productId);

      if (!currentItem || (item.quantity ?? 1) !== currentItem.quantity) {
        throw new AppError(
          "Não é possível alterar os produtos ou quantidades da venda quando já existem pagamentos registrados.",
          409,
        );
      }
    }
  }
}
