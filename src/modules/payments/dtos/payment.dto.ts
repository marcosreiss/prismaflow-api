import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
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
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @IsOptional()
  @Type(() => Date)
  firstDueDate?: Date;
}

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  saleId!: number;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodItemDto)
  methods!: PaymentMethodItemDto[];

  @IsOptional()
  isActive?: boolean = true;

  @IsOptional()
  tenantId?: string;

  @IsOptional()
  branchId?: string;
}

export class UpdatePaymentDto {
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
  paidAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsPaid?: number;

  @IsOptional()
  @Type(() => Date)
  lastPaymentAt?: Date;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodItemDto)
  methods?: PaymentMethodItemDto[];

  @IsOptional()
  isActive?: boolean;
}

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  reason?: string; // Para justificativa de cancelamento
}

export class PaymentFilterDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod; // Filtra por método dentro de PaymentMethodItem

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
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
  hasOverdueInstallments?: boolean; // Pagamentos com parcelas em atraso

  @IsOptional()
  @Type(() => Boolean)
  isPartiallyPaid?: boolean; // Pagamentos parcialmente pagos

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dueDaysAhead?: number; // Próximas parcelas a vencer (próximos X dias)
}
