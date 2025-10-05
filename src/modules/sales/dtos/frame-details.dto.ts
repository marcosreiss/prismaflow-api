import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { FrameMaterialType } from "@prisma/client";

export class CreateFrameDetailsDto {
  @IsEnum(FrameMaterialType, {
    message: "Tipo de material da armação inválido.",
  })
  @IsNotEmpty({ message: "O campo 'material' é obrigatório." })
  material!: FrameMaterialType;

  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() color?: string;

  @IsOptional() @IsBoolean() isActive?: boolean = true;
}

export class UpdateFrameDetailsDto {
  @IsOptional() @IsEnum(FrameMaterialType) material?: FrameMaterialType;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
