import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateOpticalServiceDto {
  @IsString()
  @IsNotEmpty({ message: "O nome do serviço é obrigatório." })
  @MaxLength(100, {
    message: "O nome do serviço deve ter no máximo 100 caracteres.",
  })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: "O preço deve ser numérico." })
  @Min(0, { message: "O preço não pode ser negativo." })
  price!: number;

  // 🔸 branchId agora é opcional e não deve ser enviado pelo cliente
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateOpticalServiceDto {
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
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
