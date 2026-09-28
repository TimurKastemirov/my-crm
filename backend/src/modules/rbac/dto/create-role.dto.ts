import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  /** Machine code of the role within the organization, e.g. "sales_lead". */
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, {
    message: 'code: only [a-z0-9_], must start with a letter, 2–40 characters',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** List of permission codes (see GET /permissions). */
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
