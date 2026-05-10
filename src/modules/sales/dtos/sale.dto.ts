// src/modules/sales/dtos/sale.dto.ts
import {
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CreateItemOpticalServiceDto,
  UpdateItemOpticalServiceDto,
} from "./item-optical-service.dto";
import { CreateItemProductDto, UpdateItemProductDto } from "./item-product.dto";
import { CreateProtocolDto, UpdateProtocolDto } from "./protocol.dto";

export class CreateSaleDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo clientId é obrigatório." })
  clientId!: number;

  @IsNotEmpty({ message: "O campo saleDate é obrigatório." })
  @Type(() => Date)
  @IsDate({ message: "O campo saleDate deve ser uma data válida." })
  saleDate!: Date;

  @IsOptional()
  @IsInt({ message: "O campo prescriptionId deve ser inteiro." })
  prescriptionId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemProductDto)
  productItems!: CreateItemProductDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemOpticalServiceDto)
  serviceItems!: CreateItemOpticalServiceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProtocolDto)
  protocol?: CreateProtocolDto;
}

export class UpdateSaleDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: "O campo saleDate deve ser uma data válida." })
  saleDate?: Date;

  @IsOptional()
  @IsInt({ message: "O campo prescriptionId deve ser inteiro." })
  prescriptionId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateItemProductDto)
  productItems?: UpdateItemProductDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateItemOpticalServiceDto)
  serviceItems?: UpdateItemOpticalServiceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProtocolDto)
  protocol?: UpdateProtocolDto;
}
