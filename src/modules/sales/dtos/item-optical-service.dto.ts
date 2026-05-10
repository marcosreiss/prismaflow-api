// src/modules/sales/dtos/item-optical-service.dto.ts
import { IsInt, IsNotEmpty } from "class-validator";

export class CreateItemOpticalServiceDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo serviceId é obrigatório." })
  serviceId!: number;
}

export class UpdateItemOpticalServiceDto {
  @IsInt()
  @IsNotEmpty({ message: "O campo serviceId é obrigatório." })
  serviceId!: number;
}
