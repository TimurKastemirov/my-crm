import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SUPPORTED_LOCALES,
  type AcceptInvitationRequest,
  type AppLocale,
  type InvitationPreviewRequest,
} from '@crm/shared';

export class InvitationTokenDto implements InvitationPreviewRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}

export class AcceptInvitationDto
  extends InvitationTokenDto
  implements AcceptInvitationRequest
{
  /** New account: becomes its password. Existing account: verified against it. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Required only when the invited email has no account yet. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description: 'UI language of a new account (default en)',
  })
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: AppLocale;
}
