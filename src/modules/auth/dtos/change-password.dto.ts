import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: "A senha atual é obrigatória." })
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: "A nova senha deve ter pelo menos 6 caracteres." })
  @IsNotEmpty({ message: "A nova senha é obrigatória." })
  newPassword!: string;
}
