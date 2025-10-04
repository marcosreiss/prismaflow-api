import { IsNotEmpty, IsString } from "class-validator";

export class CreateBranchDto {
  @IsString({ message: "O nome da filial deve ser uma string válida." })
  @IsNotEmpty({ message: "O nome da filial é obrigatório." })
  name!: string;
}
