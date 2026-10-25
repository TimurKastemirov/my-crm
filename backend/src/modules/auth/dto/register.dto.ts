import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_LOCALES, type AppLocale, type RegisterRequest } from '@crm/shared';

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

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, description: 'Initial UI language (default en)' })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: AppLocale;
}
