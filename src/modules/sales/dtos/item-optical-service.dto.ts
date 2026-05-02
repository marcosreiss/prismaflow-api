// src/modules/sales/dtos/item-optical-service.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from "class-validator";

export class CreateItemOpticalServiceDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo 'serviceId' é obrigatório." })
  serviceId!: number;

  @IsOptional()
  @IsNumber({}, { message: "O campo 'unitPrice' deve ser numérico." })
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateItemOpticalServiceDto {
  @IsOptional() @IsInt() serviceId?: number;
  @IsOptional()
  @IsNumber({}, { message: "O campo 'unitPrice' deve ser numérico." })
  unitPrice?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
