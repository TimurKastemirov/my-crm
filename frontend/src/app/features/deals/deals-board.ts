import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { DealDto, PipelineDto } from '@crm/shared';
import { LocaleService } from '../../core/locale.service';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { DealsBoardComponentService, type BoardColumn } from './deals-board.service';

@Component({
  selector: 'app-deals-board',
  host: { class: 'flex h-full flex-col' },
  imports: [ReactiveFormsModule, CdkDropListGroup, CdkDropList, CdkDrag, CurrencyPipe, TranslatePipe, ModalComponent],
  templateUrl: './deals-board.html',
  providers: [DealsBoardComponentService],
})
export class DealsBoardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(DealsBoardComponentService);

  protected readonly locale = inject(LocaleService).locale;

  protected readonly pipeline = signal<PipelineDto | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    amount: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
    stageId: ['', [Validators.required]],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { pipeline, columns } = await this.service.loadBoard();
      this.pipeline.set(pipeline);
      this.columns.set(columns);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'deals.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async drop(event: CdkDragDrop<BoardColumn>): Promise<void> {
    const target = event.container.data;
    if (event.previousContainer === event.container) {
      moveItemInArray(target.deals, event.previousIndex, event.currentIndex);
      return;
    }
    const source = event.previousContainer.data;
    const deal = source.deals[event.previousIndex];
    transferArrayItem(source.deals, target.deals, event.previousIndex, event.currentIndex);
    try {
      await this.service.moveStage(deal.id, target.stage.id);
      await this.load(); // refresh the recomputed status (won/lost/open)
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'deals.moveError'));
      await this.load(); // roll back to the server state
    }
  }

  protected openCreate(): void {
    const firstStage = this.columns()[0]?.stage.id ?? '';
    this.form.reset({ title: '', amount: '', currency: '', stageId: firstStage });
    this.modalOpen.set(true);
  }

  protected async save(): Promise<void> {
    const pipeline = this.pipeline();
    if (!pipeline || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.service.create(pipeline.id, v.stageId, v);
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'deals.createError'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(deal: DealDto): Promise<void> {
    if (!window.confirm(this.translate.instant('deals.deleteConfirm', { title: deal.title }))) return;
    this.error.set(null);
    try {
      await this.service.remove(deal.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'deals.deleteError'));
    }
  }

  protected isWon(deal: DealDto): boolean {
    return this.service.isWon(deal);
  }

  protected isLost(deal: DealDto): boolean {
    return this.service.isLost(deal);
  }
}
