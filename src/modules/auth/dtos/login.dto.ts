import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "O e-mail informado é inválido." })
  @IsNotEmpty({ message: "O e-mail é obrigatório." })
  email!: string;

  @IsString({ message: "A senha deve ser uma string válida." })
  @MinLength(6, { message: "A senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A senha é obrigatória." })
  password!: string;
}
