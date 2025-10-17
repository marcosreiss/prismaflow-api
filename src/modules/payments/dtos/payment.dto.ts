import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  saleId!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  downPayment?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsTotal?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @IsOptional()
  @Type(() => Date)
  lastPaymentAt?: Date;

  @IsOptional()
  @Type(() => Date)
  firstDueDate?: Date;

  @IsOptional()
  isActive?: boolean = true;

  @IsOptional()
  tenantId?: string;

  @IsOptional()
  branchId?: string;
}

// ✅ Versão para atualização (sem Nest)
export class UpdatePaymentDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  downPayment?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @IsOptional()
  @Type(() => Date)
  lastPaymentAt?: Date;

  @IsOptional()
  @Type(() => Date)
  firstDueDate?: Date;

  @IsOptional()
  isActive?: boolean;
}

// payment.dto.ts - Adicione este DTO
export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  reason?: string; // Para justificativa de cancelamento
}