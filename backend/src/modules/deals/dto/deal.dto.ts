import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { DealStatus } from '@crm/shared';
import { ListQueryDto } from '../../../common/dto/list-query.dto.js';

export class CreateDealDto {
  @IsUUID()
  pipelineId!: string;

  @IsUUID()
  stageId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}

// pipelineId/stageId/status меняются через move-stage/win/lose, а не через обычный update.
export class UpdateDealDto extends PartialType(CreateDealDto) {}

export class MoveStageDto {
  @IsUUID()
  stageId!: string;
}

export class LoseDealDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lostReason?: string;
}

export class DealQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsIn(Object.values(DealStatus))
  status?: DealStatus;
}
