import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { RegisterRequest } from '@crm/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  organizationName!: string;
}
