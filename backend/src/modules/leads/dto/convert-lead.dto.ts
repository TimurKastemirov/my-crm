import { IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ConvertLeadDto {
  /** Название сделки. */
  @IsString()
  @MaxLength(200)
  title!: string;

  /** Воронка/этап; если не заданы — берётся дефолтная воронка и её первый этап. */
  @IsOptional()
  @IsUUID()
  pipelineId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  /** Сумма сделки; по умолчанию — оценочная сумма лида. */
  @IsOptional()
  @IsNumberString()
  amount?: string;
}
