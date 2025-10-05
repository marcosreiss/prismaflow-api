import { IsBoolean, IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class CreateItemOpticalServiceDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo 'serviceId' é obrigatório." })
  serviceId!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateItemOpticalServiceDto {
  @IsOptional() @IsInt() serviceId?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
