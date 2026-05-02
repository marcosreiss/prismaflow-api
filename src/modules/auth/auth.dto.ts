// src/modules/auth/auth.dto.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "O e-mail informado é inválido." })
  @IsNotEmpty({ message: "O e-mail é obrigatório." })
  email!: string;

  @IsString({ message: "A senha deve ser uma string válida." })
  @MinLength(6, { message: "A senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A senha é obrigatória." })
  password!: string;
}

export class RegisterAdminDto {
  @IsString({ message: "O nome da ótica (tenant) deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome da ótica (tenant) é obrigatório." })
  tenantName!: string;

  @IsString({ message: "O nome da filial deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome da filial é obrigatório." })
  branchName!: string;

  @IsString({ message: "O nome do usuário deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome do usuário é obrigatório." })
  name!: string;

  @IsEmail({}, { message: "O e-mail informado é inválido." })
  @IsNotEmpty({ message: "O e-mail é obrigatório." })
  email!: string;

  @IsString({ message: "A senha deve ser uma string válida." })
  @MinLength(6, { message: "A senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A senha é obrigatória." })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: "A senha atual é obrigatória." })
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: "A nova senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A nova senha é obrigatória." })
  newPassword!: string;
}

export class RegisterUserDto {
  @IsString({ message: "O nome do usuário deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome do usuário é obrigatório." })
  name!: string;

  @IsEmail({}, { message: "O e-mail informado é inválido." })
  @IsNotEmpty({ message: "O e-mail é obrigatório." })
  email!: string;

  @IsString({ message: "A senha deve ser uma string válida." })
  @MinLength(6, { message: "A senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A senha é obrigatória." })
  password!: string;

  @IsEnum(["MANAGER", "EMPLOYEE"], {
    message: "O papel do usuário deve ser MANAGER ou EMPLOYEE.",
  })
  @IsNotEmpty({ message: "O papel do usuário é obrigatório." })
  role!: "MANAGER" | "EMPLOYEE";
}

export class SelectBranchDto {
  @IsString({
    message: "O ID da filial (branchId) deve ser uma string válida.",
  })
  @IsNotEmpty({ message: "O ID da filial (branchId) é obrigatório." })
  branchId!: string;
}
