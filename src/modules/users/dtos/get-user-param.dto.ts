import { IsUUID, IsString } from 'class-validator';

export class GetUserParamDto {
  @IsString()
  @IsUUID('4', { message: 'Invalid user ID format' })
  id!: string;
}
