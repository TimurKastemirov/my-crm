import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { ChangePasswordRequest } from '@crm/shared';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
