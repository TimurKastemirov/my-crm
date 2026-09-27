import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Полный новый набор кодов прав (заменяет текущий). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
