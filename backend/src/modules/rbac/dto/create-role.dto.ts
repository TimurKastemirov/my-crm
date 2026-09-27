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

  /** Машинный код роли в рамках организации, напр. "sales_lead". */
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, {
    message: 'code: только [a-z0-9_], начинается с буквы, 2–40 символов',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Список кодов прав (см. GET /permissions). */
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
