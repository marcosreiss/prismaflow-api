// src/modules/users/user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

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

  @IsEnum(["MANAGER", "EMPLOYEE"], {
    message: "O perfil deve ser MANAGER ou EMPLOYEE.",
  })
  @IsNotEmpty({ message: "O perfil (role) é obrigatório." })
  role!: "MANAGER" | "EMPLOYEE";

  @IsOptional()
  @IsString({ message: "O branchId deve ser uma string válida." })
  branchId?: string;
}
