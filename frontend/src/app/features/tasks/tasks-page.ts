import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TaskPriority, TaskStatus, type SortOrder, type TaskDto } from '@crm/shared';
import { parseEnumParam, parsePage, parseSearch, SORT_ORDERS } from '../../shared/list-query/list-query';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { TasksPageComponentService } from './tasks-page.service';

@Component({
  selector: 'app-tasks-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, ModalComponent, PaginatorComponent],
  templateUrl: './tasks-page.html',
  providers: [TasksPageComponentService],
})
export class TasksPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(TasksPageComponentService);

  protected readonly items = signal<TaskDto[]>([]);
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<TaskStatus | ''>('');
  protected readonly priorityFilter = signal<TaskPriority | ''>('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Mobile filter sheet: draft state, committed only on Apply.
  protected readonly filtersOpen = signal(false);
  protected readonly draftSearch = signal('');
  protected readonly draftStatus = signal<TaskStatus | ''>('');
  protected readonly draftPriority = signal<TaskPriority | ''>('');

  // Sort sheet: draft state, committed only on Apply. `key` must be in the server's sortable whitelist.
  protected readonly sortFields = [
    { key: 'title', label: 'tasks.name' },
    { key: 'status', label: 'common.status' },
    { key: 'priority', label: 'tasks.priority' },
    { key: 'dueAt', label: 'tasks.due' },
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
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['normal'],
    dueAt: [''],
  });

  constructor() {
    // The URL query string is the source of truth: it drives the filter/sort/page
    // state and the single load. Controls only navigate; this reacts.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.page.set(parsePage(q.get('page')));
      this.search.set(parseSearch(q.get('search')));
      this.statusFilter.set(parseEnumParam(q.get('status'), Object.values(TaskStatus)));
      this.priorityFilter.set(parseEnumParam(q.get('priority'), Object.values(TaskPriority)));
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
        priority: this.priorityFilter() || undefined,
        sortBy: this.sortBy() || undefined,
        sortOrder: this.sortOrder() || undefined,
      });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'tasks.loadError'));
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

  protected filterByPriority(priority: string): void {
    this.go({ priority: priority || null, page: null });
  }

  protected goPage(page: number): void {
    this.go({ page: page > 1 ? page : null });
  }

  protected openFilters(): void {
    this.draftSearch.set(this.search());
    this.draftStatus.set(this.statusFilter());
    this.draftPriority.set(this.priorityFilter());
    this.filtersOpen.set(true);
  }

  protected applyFilters(): void {
    this.go({
      search: this.draftSearch().trim() || null,
      status: this.draftStatus() || null,
      priority: this.draftPriority() || null,
      page: null,
    });
    this.filtersOpen.set(false);
  }

  protected resetFilters(): void {
    this.draftSearch.set('');
    this.draftStatus.set('');
    this.draftPriority.set('');
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
    this.form.reset({ title: '', description: '', priority: 'normal', dueAt: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(task: TaskDto): void {
    this.editingId.set(task.id);
    this.form.setValue({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '',
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
      this.error.set(this.service.errorMessage(e, 'tasks.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async setStatus(task: TaskDto, status: string): Promise<void> {
    const next = status as TaskStatus;
    if (next === task.status) return;
    this.error.set(null);
    try {
      await this.service.setStatus(task.id, next);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'tasks.saveError'));
    }
  }

  protected async remove(task: TaskDto): Promise<void> {
    if (!window.confirm(this.translate.instant('tasks.deleteConfirm', { title: task.title }))) return;
    this.error.set(null);
    try {
      await this.service.remove(task.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'tasks.deleteError'));
    }
  }
}
