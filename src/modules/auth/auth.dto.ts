import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @IsString()
  @IsNotEmpty({ message: 'Tenant name is required' })
  tenantName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Branch name is required' })
  branchName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must have at least 6 characters' })
  password!: string;
}
