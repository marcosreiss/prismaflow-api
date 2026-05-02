// src/modules/sales/dtos/item-product.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CreateFrameDetailsDto,
  UpdateFrameDetailsDto,
} from "./frame-details.dto";

export class CreateItemProductDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo 'productId' é obrigatório." })
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number = 1;

  @IsOptional()
  @IsNumber({}, { message: "O campo 'unitPrice' deve ser numérico." })
  unitPrice?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFrameDetailsDto)
  frameDetails?: CreateFrameDetailsDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateItemProductDto {
  @IsOptional() @IsInt() productId?: number;

  @IsOptional() @IsInt() quantity?: number;

  @IsOptional()
  @IsNumber({}, { message: "O campo 'unitPrice' deve ser numérico." })
  unitPrice?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFrameDetailsDto)
  frameDetails?: UpdateFrameDetailsDto;

  @IsOptional() @IsBoolean() isActive?: boolean;
}
