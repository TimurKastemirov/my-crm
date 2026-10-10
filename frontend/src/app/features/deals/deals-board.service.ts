import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DealStatus, type DealDto, type PipelineDto, type PipelineStageDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { DealsApi } from './deals.api';
import { PipelinesApi } from './pipelines.api';

export interface BoardColumn {
  stage: PipelineStageDto;
  deals: DealDto[];
}

/** Deals board business logic. Provided at the DealsBoardComponent level (not a singleton). */
@Injectable()
export class DealsBoardComponentService {
  private readonly api = inject(DealsApi);
  private readonly pipelinesApi = inject(PipelinesApi);
  private readonly translate = inject(TranslateService);

  /** Loads the default pipeline and groups its deals into stage columns. */
  async loadBoard(): Promise<{ pipeline: PipelineDto | null; columns: BoardColumn[] }> {
    const pipelines = await this.pipelinesApi.list();
    const pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null;
    if (!pipeline) return { pipeline: null, columns: [] };
    const stages = [...pipeline.stages].sort((a, b) => a.position - b.position);
    const deals = await this.api.list({ pipelineId: pipeline.id, limit: 100 });
    const columns = stages.map((stage) => ({
      stage,
      deals: deals.data.filter((d) => d.stageId === stage.id),
    }));
    return { pipeline, columns };
  }

  moveStage(dealId: string, stageId: string): Promise<DealDto> {
    return this.api.moveStage(dealId, stageId);
  }

  /** Creates a deal in the given pipeline/stage from the form value. */
  create(pipelineId: string, stageId: string, value: { title: string; amount: string; currency: string }): Promise<DealDto> {
    return this.api.create({
      pipelineId,
      stageId,
      title: value.title,
      amount: value.amount || undefined,
      currency: value.currency || undefined,
    });
  }

  remove(id: string): Promise<void> {
    return this.api.remove(id);
  }

  isWon(deal: DealDto): boolean {
    return deal.status === DealStatus.Won;
  }

  isLost(deal: DealDto): boolean {
    return deal.status === DealStatus.Lost;
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
