import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty({ message: "O nome da marca é obrigatório." })
  @MaxLength(100, { message: "O nome da marca deve ter no máximo 100 caracteres." })
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "O nome da marca deve ter no máximo 100 caracteres." })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}