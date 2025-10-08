import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { ProductCategory } from "@prisma/client";

/**
 * DTO para criação de produtos
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: "O nome do produto é obrigatório." })
  @MaxLength(100, {
    message: "O nome do produto deve ter no máximo 100 caracteres.",
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "A descrição deve ter no máximo 255 caracteres." })
  description?: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "O preço de custo deve ser numérico." }
  )
  @Min(0, { message: "O preço de custo não pode ser negativo." })
  costPrice!: number;

  @IsNumber({}, { message: "O markup deve ser numérico." })
  @Min(0, { message: "O markup deve ser maior ou igual a 0." })
  markup!: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "O preço de venda deve ser numérico." }
  )
  @Min(0, { message: "O preço de venda não pode ser negativo." })
  salePrice!: number;

  @IsInt({ message: "A quantidade em estoque deve ser um número inteiro." })
  @Min(0, { message: "A quantidade em estoque não pode ser negativa." })
  stockQuantity!: number;

  @IsInt({ message: "O estoque mínimo deve ser um número inteiro." })
  @Min(0, { message: "O estoque mínimo não pode ser negativo." })
  minimumStock!: number;

  @IsEnum(ProductCategory, { message: "Categoria inválida." })
  category!: ProductCategory;

  @IsInt({ message: "O ID da marca deve ser um número inteiro." })
  @IsPositive({ message: "O ID da marca deve ser positivo." })
  brandId!: number;
}

/**
 * DTO para atualização de produtos
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  markup?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsInt()
  @IsPositive()
  brandId?: number;
}
