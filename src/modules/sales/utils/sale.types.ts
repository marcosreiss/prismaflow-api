import { prisma } from "@/config/prisma-context";
import { SaleRepository } from "../sale.repository";

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type SaleUserContext = {
  userId: string;
  tenantId: string;
  branchId: string;
};

export type SaleRecord = NonNullable<
  Awaited<ReturnType<SaleRepository["findById"]>>
>;

export type ComparableSaleState = {
  clientId: number;
  saleDate: Date | string | null;
  prescriptionId: number | null;
  notes: string | null;
  discount: number;
  productItems: Array<{
    productId: number;
    quantity: number;
    frameDetails: {
      material: string | null;
      reference: string | null;
      color: string | null;
    } | null;
  }>;
  serviceItems: Array<{
    serviceId: number;
  }>;
  protocol: {
    book: string | null;
    page: number | null;
    os: string | null;
  } | null;
};
