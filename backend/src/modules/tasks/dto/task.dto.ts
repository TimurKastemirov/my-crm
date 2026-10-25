import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '@crm/shared';
import { ListQueryDto } from '../../../common/dto/list-query.dto.js';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: 'null clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @IsOptional()
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;

  @ApiPropertyOptional({ nullable: true, description: 'ISO timestamp in UTC; null clears it' })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class TaskQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @IsOptional()
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
