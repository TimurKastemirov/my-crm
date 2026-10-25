import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  ALL_PERMISSIONS,
  type CreateRoleRequest,
  type Permission,
} from '@crm/shared';

export class CreateRoleDto implements CreateRoleRequest {
  // Trimmed before validation, so a whitespace-only name is rejected.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  /** Machine code of the role within the organization, e.g. "sales_lead". Generated from the name when omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, {
    message: 'code: only [a-z0-9_], must start with a letter, 2–40 characters',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** List of permission codes (see GET /permissions). */
  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions!: Permission[];
}
