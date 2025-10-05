import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateFrameDetailsDto, UpdateFrameDetailsDto } from "./frame-details.dto";

export class CreateItemProductDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo 'productId' é obrigatório." })
  productId!: number;

  @IsOptional()
  @IsInt()
  quantity?: number = 1;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFrameDetailsDto)
  frameDetails?: CreateFrameDetailsDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateItemProductDto {
  @IsOptional() @IsInt() productId?: number;
  @IsOptional() @IsInt() quantity?: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFrameDetailsDto)
  frameDetails?: UpdateFrameDetailsDto;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
