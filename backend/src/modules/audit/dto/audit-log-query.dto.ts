import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ALL_AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogQuery,
} from '@crm/shared';

export class AuditLogQueryDto implements AuditLogQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(ALL_AUDIT_ACTIONS)
  action?: AuditAction;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  /** Inclusive lower bound (ISO timestamp). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Exclusive upper bound (ISO timestamp). */
  @IsOptional()
  @IsDateString()
  to?: string;
}
