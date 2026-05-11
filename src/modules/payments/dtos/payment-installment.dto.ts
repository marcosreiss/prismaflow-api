// src/modules/payments/dtos/payment-installment.dto.ts

import { IsDate, IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class UpdatePaymentInstallmentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}

export class PayInstallmentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;
}
