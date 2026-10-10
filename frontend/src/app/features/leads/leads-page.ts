import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LeadStatus, type LeadDto, type SortOrder } from '@crm/shared';
import { LocaleService } from '../../core/locale.service';
import { parseEnumParam, parsePage, parseSearch, SORT_ORDERS } from '../../shared/list-query/list-query';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { LeadsPageComponentService } from './leads-page.service';

@Component({
  selector: 'app-leads-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, CurrencyPipe, TranslatePipe, ModalComponent, PaginatorComponent],
  templateUrl: './leads-page.html',
  providers: [LeadsPageComponentService],
})
export class LeadsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(LeadsPageComponentService);

  protected readonly locale = inject(LocaleService).locale;

  protected readonly items = signal<LeadDto[]>([]);
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<LeadStatus | ''>('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Mobile filter sheet: draft state, committed only on Apply.
  protected readonly filtersOpen = signal(false);
  protected readonly draftSearch = signal('');
  protected readonly draftStatus = signal<LeadStatus | ''>('');

  // Sort sheet: draft state, committed only on Apply. `key` must be in the server's sortable whitelist.
  protected readonly sortFields = [
    { key: 'status', label: 'common.status' },
    { key: 'estimatedValue', label: 'leads.estimatedValue' },
    { key: 'createdAt', label: 'common.createdAt' },
    { key: 'updatedAt', label: 'common.updatedAt' },
  ] as const;
  private readonly sortKeys = this.sortFields.map((f) => f.key);
  protected readonly sortBy = signal<string>('');
  protected readonly sortOrder = signal<SortOrder | ''>('');
  protected readonly sortOpen = signal(false);
  protected readonly draftSortBy = signal<string>('');
  protected readonly draftSortOrder = signal<SortOrder | ''>('');

  protected readonly form = this.fb.nonNullable.group({
    source: [''],
    estimatedValue: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
  });

  constructor() {
    // The URL query string is the source of truth: it drives the filter/sort/page
    // state and the single load. Controls only navigate; this reacts.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.page.set(parsePage(q.get('page')));
      this.search.set(parseSearch(q.get('search')));
      this.statusFilter.set(parseEnumParam(q.get('status'), Object.values(LeadStatus)));
      const sb = parseEnumParam(q.get('sortBy'), this.sortKeys);
      this.sortBy.set(sb);
      this.sortOrder.set(sb ? parseEnumParam(q.get('sortOrder'), SORT_ORDERS) || 'desc' : '');
      void this.load();
    });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.service.list({
        page: this.page(),
        limit: 20,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
        sortBy: this.sortBy() || undefined,
        sortOrder: this.sortOrder() || undefined,
      });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Writes filter/sort/page state to the URL; the queryParamMap subscription reloads. */
  private go(queryParams: Params): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  protected applySearch(value: string): void {
    this.go({ search: value.trim() || null, page: null });
  }

  protected filterByStatus(status: string): void {
    this.go({ status: status || null, page: null });
  }

  protected goPage(page: number): void {
    this.go({ page: page > 1 ? page : null });
  }

  protected openFilters(): void {
    this.draftSearch.set(this.search());
    this.draftStatus.set(this.statusFilter());
    this.filtersOpen.set(true);
  }

  protected applyFilters(): void {
    this.go({ search: this.draftSearch().trim() || null, status: this.draftStatus() || null, page: null });
    this.filtersOpen.set(false);
  }

  protected resetFilters(): void {
    this.draftSearch.set('');
    this.draftStatus.set('');
  }

  protected openSort(): void {
    this.draftSortBy.set(this.sortBy());
    this.draftSortOrder.set(this.sortOrder());
    this.sortOpen.set(true);
  }

  protected setDraftSort(field: string, dir: SortOrder): void {
    this.draftSortBy.set(field);
    this.draftSortOrder.set(dir);
  }

  protected applySort(): void {
    this.go({ sortBy: this.draftSortBy() || null, sortOrder: this.draftSortOrder() || null, page: null });
    this.sortOpen.set(false);
  }

  protected resetSort(): void {
    this.draftSortBy.set('');
    this.draftSortOrder.set('');
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ source: '', estimatedValue: '', currency: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(lead: LeadDto): void {
    this.editingId.set(lead.id);
    this.form.setValue({
      source: lead.source ?? '',
      estimatedValue: lead.estimatedValue ?? '',
      currency: lead.currency ?? '',
    });
    this.modalOpen.set(true);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.service.save(this.editingId(), this.form.getRawValue());
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Status change from the dropdown (for 'lost' we ask for a reason). */
  protected async setStatus(lead: LeadDto, status: string): Promise<void> {
    const next = status as LeadStatus;
    if (next === lead.status) return;
    let lostReason: string | undefined;
    if (next === LeadStatus.Lost) {
      lostReason = window.prompt(this.translate.instant('leads.lossReasonPrompt'))?.trim() || undefined;
      if (!lostReason) return;
    }
    this.error.set(null);
    try {
      await this.service.changeStatus(lead.id, next, lostReason);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.statusChangeError'));
    }
  }

  protected async convert(lead: LeadDto): Promise<void> {
    const title = window.prompt(this.translate.instant('leads.dealTitlePrompt'), this.translate.instant('leads.dealTitleDefault'))?.trim();
    if (!title) return;
    this.error.set(null);
    try {
      await this.service.convert(lead.id, title);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.convertError'));
    }
  }

  protected async remove(lead: LeadDto): Promise<void> {
    if (!window.confirm(this.translate.instant('leads.deleteConfirm'))) return;
    this.error.set(null);
    try {
      await this.service.remove(lead.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.deleteError'));
    }
  }
}
