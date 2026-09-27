import { PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { LeadStatus } from '@crm/shared';

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsIn(Object.values(LeadStatus))
  status?: LeadStatus;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Оценочная сумма (numeric строкой, чтобы не терять точность). */
  @IsOptional()
  @IsNumberString()
  estimatedValue?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
