import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DealStatus, type DealDto, type PipelineDto, type PipelineStageDto } from '@crm/shared';
import { LocaleService } from '../../core/locale.service';
import { parseEnumParam, parseSearch } from '../../shared/list-query/list-query';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DealsBoardComponentService);

  protected readonly locale = inject(LocaleService).locale;

  protected readonly pipeline = signal<PipelineDto | null>(null);
  protected readonly columns = signal<BoardColumn[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);

  // Mobile-only filters (the desktop kanban renders every column and ignores these).
  // The URL query string is the source of truth; controls navigate and the subscription reacts.
  protected readonly stageFilter = signal<string>('');
  protected readonly statusFilter = signal<DealStatus | ''>('');
  protected readonly search = signal('');

  // Mobile filter sheet: draft state, committed only on Apply.
  protected readonly filtersOpen = signal(false);
  protected readonly draftStatus = signal<DealStatus | ''>('');
  protected readonly draftSearch = signal('');

  /** Stage whose cards the mobile list shows: the URL stage if still valid, else the first. */
  protected readonly visibleStageId = computed(() => {
    const cols = this.columns();
    const requested = this.stageFilter();
    return cols.some((c) => c.stage.id === requested) ? requested : (cols[0]?.stage.id ?? '');
  });

  /** Deals shown as cards on mobile: the visible stage, narrowed by status + search. */
  protected readonly visibleCards = computed(() =>
    this.service.filterDeals(this.columns(), {
      stageId: this.visibleStageId(),
      status: this.statusFilter(),
      search: this.search(),
    }),
  );

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    amount: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
    stageId: ['', [Validators.required]],
  });

  constructor() {
    // The board loads once (the kanban needs the full set); the URL only drives the
    // mobile filter signals, which the `visibleCards` computed reacts to — no refetch.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.stageFilter.set(q.get('stage') ?? '');
      this.statusFilter.set(parseEnumParam(q.get('status'), Object.values(DealStatus)));
      this.search.set(parseSearch(q.get('search')));
    });
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

  /** Writes mobile filter state to the URL; the queryParamMap subscription reacts. */
  private go(queryParams: Params): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  /** Quick stage switch (mobile): applies immediately, like moving between kanban columns. */
  protected selectStage(stageId: string): void {
    this.go({ stage: stageId || null });
  }

  protected openFilters(): void {
    this.draftStatus.set(this.statusFilter());
    this.draftSearch.set(this.search());
    this.filtersOpen.set(true);
  }

  protected applyFilters(): void {
    this.go({ status: this.draftStatus() || null, search: this.draftSearch().trim() || null });
    this.filtersOpen.set(false);
  }

  protected resetFilters(): void {
    this.draftStatus.set('');
    this.draftSearch.set('');
  }

  /** Per-card stage change (mobile): moves the deal and persists, mirroring a kanban drop. */
  protected async moveDealTo(deal: DealDto, stageId: string): Promise<void> {
    if (!stageId || stageId === deal.stageId) return;
    this.error.set(null);
    try {
      await this.service.moveStage(deal.id, stageId);
      await this.load();
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

  protected stageKey(stage: PipelineStageDto): string {
    return this.service.stageLabelKey(stage);
  }

  protected isWon(deal: DealDto): boolean {
    return this.service.isWon(deal);
  }

  protected isLost(deal: DealDto): boolean {
    return this.service.isLost(deal);
  }
}
