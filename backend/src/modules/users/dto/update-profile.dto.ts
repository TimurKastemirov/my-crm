import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SUPPORTED_LOCALES, type AppLocale } from '@crm/shared';

export class UpdateProfileDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, description: 'UI language' })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: AppLocale;
}
