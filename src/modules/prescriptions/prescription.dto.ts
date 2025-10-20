import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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

  // OD - Longe
  @IsOptional() @IsString() odSphericalFar?: string;
  @IsOptional() @IsString() odCylindricalFar?: string;
  @IsOptional() @IsString() odAxisFar?: string;
  @IsOptional() @IsString() odDnpFar?: string;

  // OD - Perto
  @IsOptional() @IsString() odSphericalNear?: string;
  @IsOptional() @IsString() odCylindricalNear?: string;
  @IsOptional() @IsString() odAxisNear?: string;
  @IsOptional() @IsString() odDnpNear?: string;

  // OE - Longe
  @IsOptional() @IsString() oeSphericalFar?: string;
  @IsOptional() @IsString() oeCylindricalFar?: string;
  @IsOptional() @IsString() oeAxisFar?: string;
  @IsOptional() @IsString() oeDnpFar?: string;

  // OE - Perto
  @IsOptional() @IsString() oeSphericalNear?: string;
  @IsOptional() @IsString() oeCylindricalNear?: string;
  @IsOptional() @IsString() oeAxisNear?: string;
  @IsOptional() @IsString() oeDnpNear?: string;

  // Películas
  @IsOptional() @IsString() odPellicleFar?: string;
  @IsOptional() @IsString() odPellicleNear?: string;
  @IsOptional() @IsString() oePellicleFar?: string;
  @IsOptional() @IsString() oePellicleNear?: string;

  // Campos gerais
  @IsOptional() @IsString() frameAndRef?: string;
  @IsOptional() @IsString() lensType?: string;
  @IsOptional() @IsString() notes?: string;

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

  @IsOptional() @IsString() odSphericalFar?: string;
  @IsOptional() @IsString() odCylindricalFar?: string;
  @IsOptional() @IsString() odAxisFar?: string;
  @IsOptional() @IsString() odDnpFar?: string;

  @IsOptional() @IsString() odSphericalNear?: string;
  @IsOptional() @IsString() odCylindricalNear?: string;
  @IsOptional() @IsString() odAxisNear?: string;
  @IsOptional() @IsString() odDnpNear?: string;

  @IsOptional() @IsString() oeSphericalFar?: string;
  @IsOptional() @IsString() oeCylindricalFar?: string;
  @IsOptional() @IsString() oeAxisFar?: string;
  @IsOptional() @IsString() oeDnpFar?: string;

  @IsOptional() @IsString() oeSphericalNear?: string;
  @IsOptional() @IsString() oeCylindricalNear?: string;
  @IsOptional() @IsString() oeAxisNear?: string;
  @IsOptional() @IsString() oeDnpNear?: string;

  @IsOptional() @IsString() odPellicleFar?: string;
  @IsOptional() @IsString() odPellicleNear?: string;
  @IsOptional() @IsString() oePellicleFar?: string;
  @IsOptional() @IsString() oePellicleNear?: string;

  @IsOptional() @IsString() frameAndRef?: string;
  @IsOptional() @IsString() lensType?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() additionRight?: string;
  @IsOptional() @IsString() additionLeft?: string;
  @IsOptional() @IsString() opticalCenterRight?: string;
  @IsOptional() @IsString() opticalCenterLeft?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
