import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateItemOpticalServiceDto } from "./item-optical-service.dto";
import { CreateItemProductDto } from "./item-product.dto";
import { CreateProtocolDto } from "./protocol.dto";

/**
 * DTO para criação de vendas
 */
export class CreateSaleDto {
  @IsNumber()
  @IsNotEmpty({ message: "O campo 'clientId' é obrigatório." })
  clientId!: number;

  @IsString()
  @IsNotEmpty({ message: "O campo 'branchId' é obrigatório." })
  branchId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  // Itens de produto
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemProductDto)
  productItems?: CreateItemProductDto[];

  // Itens de serviço
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemOpticalServiceDto)
  serviceItems?: CreateItemOpticalServiceDto[];

  // Protocolo (opcional)
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProtocolDto)
  protocol?: CreateProtocolDto;
}

/**
 * DTO para atualização de vendas
 */
export class UpdateSaleDto {
  @IsOptional()
  @IsNumber()
  clientId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Itens de produto (pode vir vazio, alterar ou remover)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemProductDto)
  productItems?: CreateItemProductDto[];

  // Itens de serviço
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemOpticalServiceDto)
  serviceItems?: CreateItemOpticalServiceDto[];

  // Protocolo (opcional)
@IsOptional()
@ValidateNested()
@Type(() => CreateProtocolDto)
protocol?: CreateProtocolDto;
}
