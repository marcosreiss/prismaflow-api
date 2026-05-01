import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateProtocolDto {
  @IsOptional() @IsString() book?: string;
  @IsOptional() @IsInt() page?: number;
  @IsOptional() @IsString() os?: string;
}

export class UpdateProtocolDto {
  @IsOptional() @IsString() book?: string;
  @IsOptional() @IsInt() page?: number;
  @IsOptional() @IsString() os?: string;
}
