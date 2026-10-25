import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  AcceptInvitationRequest,
  InvitationPreviewRequest,
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
}
