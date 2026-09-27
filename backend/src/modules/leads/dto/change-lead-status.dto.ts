import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadStatus } from '@crm/shared';

export class ChangeLeadStatusDto {
  @IsIn(Object.values(LeadStatus))
  status!: LeadStatus;

  /** Обязательна при переводе в 'lost' (проверяется в сервисе). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lostReason?: string;
}
