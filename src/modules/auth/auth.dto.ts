import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @IsString({ message: 'O nome da ótica (tenant) deve ser uma string válida.' })
  @IsNotEmpty({ message: 'O nome da ótica (tenant) é obrigatório.' })
  tenantName!: string;

  @IsString({ message: 'O nome da filial deve ser uma string válida.' })
  @IsNotEmpty({ message: 'O nome da filial é obrigatório.' })
  branchName!: string;

  @IsString({ message: 'O nome do usuário deve ser uma string válida.' })
  @IsNotEmpty({ message: 'O nome do usuário é obrigatório.' })
  name!: string;

  @IsEmail({}, { message: 'O e-mail informado é inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma string válida.' })
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  password!: string;
}
