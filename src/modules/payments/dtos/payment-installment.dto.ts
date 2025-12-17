// dtos/payment-installment.dto.ts

import { IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreatePaymentInstallmentDto {
  @IsInt()
  @Min(1)
  sequence!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @Type(() => Date)
  dueDate?: Date; // ✅ ADICIONAR

  @IsOptional()
  @Type(() => Date)
  paidAt?: Date;

  @IsOptional()
  tenantId?: string;

  @IsOptional()
  branchId?: string;
}

export class UpdatePaymentInstallmentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @Type(() => Date)
  dueDate?: Date; // ✅ ADICIONAR

  @IsOptional()
  @Type(() => Date)
  paidAt?: Date;

  @IsOptional()
  isActive?: boolean;
}

export class PayInstallmentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount!: number;

  @IsOptional()
  @Type(() => Date)
  paidAt?: Date; // Se não informado, usa now()
}