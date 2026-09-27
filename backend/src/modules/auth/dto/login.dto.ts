import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { LoginRequest } from '@crm/shared';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
