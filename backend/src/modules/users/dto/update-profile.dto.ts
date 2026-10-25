import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  ValidateIf,
  IsString,
  IsTimeZone,
  MaxLength,
} from 'class-validator';
import {
  SUPPORTED_LOCALES,
  type AppLocale,
  type UpdateProfileRequest,
  type UpdateSettingsRequest,
} from '@crm/shared';

/**
 * Unlike @IsOptional (which also skips null), only an absent field is skipped:
 * null is validated and rejected, so it can't reach NOT NULL columns.
 */
const isProvided = (_: object, value: unknown) => value !== undefined;

export class UpdateProfileDto implements UpdateProfileRequest {
  @ValidateIf(isProvided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ValidateIf(isProvided)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;
}

export class UpdateSettingsDto implements UpdateSettingsRequest {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, description: 'UI language' })
  @ValidateIf(isProvided)
  @IsIn([...SUPPORTED_LOCALES])
  locale?: AppLocale;

  @ApiPropertyOptional({
    example: 'Europe/Kyiv',
    description: 'IANA time zone',
  })
  @ValidateIf(isProvided)
  @IsTimeZone()
  @MaxLength(64)
  timezone?: string;
}
