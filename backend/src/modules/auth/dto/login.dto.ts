import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SUPPORTED_LOCALES,
  type AppLocale,
  type LoginRequest,
} from '@crm/shared';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'UI language picked before signing in; saved to the profile',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: AppLocale;
}
