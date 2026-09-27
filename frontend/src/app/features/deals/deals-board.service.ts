import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { DealStatus, type DealDto, type PipelineDto, type PipelineStageDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { DealsApi } from './deals.api';
import { PipelinesApi } from './pipelines.api';

export interface BoardColumn {
  stage: PipelineStageDto;
  deals: DealDto[];
}

@Injectable()
export class DealsBoardComponentService {
  private readonly api = inject(DealsApi);
  private readonly pipelinesApi = inject(PipelinesApi);
  private readonly fb = inject(FormBuilder);

  readonly pipeline = signal<PipelineDto | null>(null);
  readonly columns = signal<BoardColumn[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    amount: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
    stageId: ['', [Validators.required]],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const pipelines = await this.pipelinesApi.list();
      const pipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null;
      this.pipeline.set(pipeline);
      if (!pipeline) {
        this.columns.set([]);
        return;
      }
      const stages = [...pipeline.stages].sort((a, b) => a.position - b.position);
      const deals = await this.api.list({ pipelineId: pipeline.id, limit: 200 });
      this.columns.set(
        stages.map((stage) => ({
          stage,
          deals: deals.data.filter((d) => d.stageId === stage.id),
        })),
      );
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось загрузить доску'));
    } finally {
      this.loading.set(false);
    }
  }

  async drop(event: CdkDragDrop<BoardColumn>): Promise<void> {
    const target = event.container.data;
    if (event.previousContainer === event.container) {
      moveItemInArray(target.deals, event.previousIndex, event.currentIndex);
      return;
    }
    const source = event.previousContainer.data;
    const deal = source.deals[event.previousIndex];
    transferArrayItem(source.deals, target.deals, event.previousIndex, event.currentIndex);
    try {
      await this.api.moveStage(deal.id, target.stage.id);
      await this.load(); // подтянуть пересчитанный статус (won/lost/open)
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось переместить сделку'));
      await this.load(); // откат к серверному состоянию
    }
  }

  openCreate(): void {
    const firstStage = this.columns()[0]?.stage.id ?? '';
    this.form.reset({ title: '', amount: '', currency: '', stageId: firstStage });
    this.modalOpen.set(true);
  }

  async save(): Promise<void> {
    const pipeline = this.pipeline();
    if (!pipeline || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.api.create({
        pipelineId: pipeline.id,
        stageId: v.stageId,
        title: v.title,
        amount: v.amount || undefined,
        currency: v.currency || undefined,
      });
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось создать сделку'));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(deal: DealDto): Promise<void> {
    if (!window.confirm(`Удалить сделку «${deal.title}»?`)) return;
    this.error.set(null);
    try {
      await this.api.remove(deal.id);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось удалить'));
    }
  }

  isWon(deal: DealDto): boolean {
    return deal.status === DealStatus.Won;
  }

  isLost(deal: DealDto): boolean {
    return deal.status === DealStatus.Lost;
  }
}
