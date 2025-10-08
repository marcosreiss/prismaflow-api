import { Role } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
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

  @IsEnum(Role, {
    message: "O papel do usuário deve ser Gerente ou Funcionário.",
  })
  @IsNotEmpty({ message: "O papel do usuário é obrigatório." })
  role!: Role; // Deve ser MANAGER ou EMPLOYEE

  @IsString({ message: "O ID do tenant deve ser uma string válida." })
  @IsNotEmpty({ message: "O ID do tenant é obrigatório." })
  tenantId!: string;

  @IsString({ message: "O ID da filial (branch) deve ser uma string válida." })
  @IsNotEmpty({ message: "O ID da filial (branch) é obrigatório." })
  branchId!: string;

  // opcionalmente, caso deseje permitir que o admin informe o criador
  @IsOptional()
  @IsString({ message: "O ID do criador deve ser uma string válida." })
  createdById?: string;
}

export class SelectBranchDto {
  @IsString({
    message: "O ID da filial (branchId) deve ser uma string válida.",
  })
  @IsNotEmpty({ message: "O ID da filial (branchId) é obrigatório." })
  branchId!: string;
}