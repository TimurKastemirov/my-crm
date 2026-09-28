import { IsIn, IsOptional } from 'class-validator';
import { LeadStatus } from '@crm/shared';
import { ListQueryDto } from '../../../common/dto/list-query.dto.js';

export class LeadQueryDto extends ListQueryDto {
  /** Filter by lead status. */
  @IsOptional()
  @IsIn(Object.values(LeadStatus))
  status?: LeadStatus;
}
