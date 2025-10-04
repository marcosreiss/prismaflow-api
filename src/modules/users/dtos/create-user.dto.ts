import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Role } from "@prisma/client";

export class CreateUserDto {
  @IsString({ message: "O nome deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome é obrigatório." })
  name!: string;

  @IsEmail({}, { message: "O e-mail informado é inválido." })
  @IsNotEmpty({ message: "O e-mail é obrigatório." })
  email!: string;

  @IsString({ message: "A senha deve ser uma string válida." })
  @MinLength(6, { message: "A senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A senha é obrigatória." })
  password!: string;

  @IsEnum(Role, { message: "O perfil (role) informado é inválido." })
  role!: Role;

  @IsOptional()
  @IsString({ message: "O branchId deve ser uma string válida." })
  branchId?: string;
}
