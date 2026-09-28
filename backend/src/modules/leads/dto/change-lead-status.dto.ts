import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeadStatus } from '@crm/shared';

export class ChangeLeadStatusDto {
  @IsIn(Object.values(LeadStatus))
  status!: LeadStatus;

  /** Required when moving to 'lost' (validated in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lostReason?: string;
}
