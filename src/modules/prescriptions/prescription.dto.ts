import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePrescriptionDto {
  @IsNotEmpty({ message: "O campo 'clientId' é obrigatório." })
  clientId!: number;

  @IsDateString(
    {},
    { message: "A data da receita deve estar em formato válido." }
  )
  prescriptionDate!: string;

  @IsOptional() @IsString() doctorName?: string;
  @IsOptional() @IsString() crm?: string;

  // OD
  @IsOptional() @IsString() odSpherical?: string;
  @IsOptional() @IsString() odCylindrical?: string;
  @IsOptional() @IsString() odAxis?: string;
  @IsOptional() @IsString() odDnp?: string;

  // OE
  @IsOptional() @IsString() oeSpherical?: string;
  @IsOptional() @IsString() oeCylindrical?: string;
  @IsOptional() @IsString() oeAxis?: string;
  @IsOptional() @IsString() oeDnp?: string;

  // Adição e centro ótico separados
  @IsOptional() @IsString() additionRight?: string;
  @IsOptional() @IsString() additionLeft?: string;
  @IsOptional() @IsString() opticalCenterRight?: string;
  @IsOptional() @IsString() opticalCenterLeft?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdatePrescriptionDto {
  @IsOptional() @IsDateString() prescriptionDate?: string;
  @IsOptional() @IsString() doctorName?: string;
  @IsOptional() @IsString() crm?: string;
  @IsOptional() @IsString() odSpherical?: string;
  @IsOptional() @IsString() odCylindrical?: string;
  @IsOptional() @IsString() odAxis?: string;
  @IsOptional() @IsString() odDnp?: string;
  @IsOptional() @IsString() oeSpherical?: string;
  @IsOptional() @IsString() oeCylindrical?: string;
  @IsOptional() @IsString() oeAxis?: string;
  @IsOptional() @IsString() oeDnp?: string;
  @IsOptional() @IsString() additionRight?: string;
  @IsOptional() @IsString() additionLeft?: string;
  @IsOptional() @IsString() opticalCenterRight?: string;
  @IsOptional() @IsString() opticalCenterLeft?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
