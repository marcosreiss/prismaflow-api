// src/modules/sales/dtos/item-product.dto.ts
import { IsInt, IsNotEmpty, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  CreateFrameDetailsDto,
  UpdateFrameDetailsDto,
} from "./frame-details.dto";

export class CreateItemProductDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo productId é obrigatório." })
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number = 1;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFrameDetailsDto)
  frameDetails?: CreateFrameDetailsDto;
}

export class UpdateItemProductDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo productId é obrigatório." })
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number = 1;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFrameDetailsDto)
  frameDetails?: UpdateFrameDetailsDto;
}
