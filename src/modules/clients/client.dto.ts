import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Gender } from "@prisma/client";

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: "O nome do cliente é obrigatório." })
  name!: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsDateString({}, { message: "A data de nascimento deve estar em formato válido." })
  bornDate?: string;

  @IsOptional()
  @IsEnum(Gender, { message: "Gênero inválido." })
  gender?: Gender;

  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() spouse?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() occupation?: string;

  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() uf?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() complement?: string;

  @IsOptional() @IsBoolean() isBlacklisted?: boolean;
  @IsOptional() @IsString() obs?: string;

  @IsOptional() @IsString() phone01?: string;
  @IsOptional() @IsString() phone02?: string;
  @IsOptional() @IsString() phone03?: string;

  @IsOptional() @IsString() reference01?: string;
  @IsOptional() @IsString() reference02?: string;
  @IsOptional() @IsString() reference03?: string;

  @IsString()
  @IsNotEmpty({ message: "O campo 'branchId' é obrigatório." })
  branchId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateClientDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() rg?: string;
  @IsOptional() @IsDateString() bornDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() spouse?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() uf?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() complement?: string;
  @IsOptional() @IsBoolean() isBlacklisted?: boolean;
  @IsOptional() @IsString() obs?: string;
  @IsOptional() @IsString() phone01?: string;
  @IsOptional() @IsString() phone02?: string;
  @IsOptional() @IsString() phone03?: string;
  @IsOptional() @IsString() reference01?: string;
  @IsOptional() @IsString() reference02?: string;
  @IsOptional() @IsString() reference03?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
