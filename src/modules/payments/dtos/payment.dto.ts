// src/modules/payments/dtos/payment.dto.ts

import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export class PaymentMethodItemDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  installments?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  firstDueDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;
}

export class UpdatePaymentDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodItemDto)
  methods?: PaymentMethodItemDto[];
}

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PaymentFilterDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @Type(() => Boolean)
  hasOverdueInstallments?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  isPartiallyPaid?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dueDaysAhead?: number;

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";
}
