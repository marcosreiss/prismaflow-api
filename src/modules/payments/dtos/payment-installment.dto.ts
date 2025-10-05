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
  paidAt?: Date;

  @IsOptional()
  tenantId?: string;

  @IsOptional()
  branchId?: string;
}

// ✅ DTO separado para update (sem PartialType)
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
  paidAt?: Date;

  @IsOptional()
  isActive?: boolean;
}
