import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  type Permission,
  type UpdateRoleRequest,
} from '@crm/shared';

export class UpdateRoleDto implements UpdateRoleRequest {
  // Present → must be a non-empty string (null is rejected, unlike @IsOptional).
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  /** null or "" clears the description. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  /** Full new set of permission codes (replaces the current one). */
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: Permission[];
}
