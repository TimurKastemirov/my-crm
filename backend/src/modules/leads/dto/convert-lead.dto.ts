import { IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConvertLeadDto {
  /** Deal title. */
  @IsString()
  @MaxLength(200)
  title!: string;

  /** Pipeline/stage; if not provided, the default pipeline and its first stage are used. */
  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  /** Deal amount; defaults to the lead's estimated value. */
  @IsOptional()
  @IsNumberString()
  amount?: string;
}
