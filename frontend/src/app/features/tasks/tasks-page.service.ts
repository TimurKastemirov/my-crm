import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { TaskPriority, TaskStatus, type TaskDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { TasksApi } from './tasks.api';

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  canceled: 'Canceled',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

@Injectable()
export class TasksPageComponentService {
  private readonly api = inject(TasksApi);
  private readonly fb = inject(FormBuilder);

  readonly statusLabels = STATUS_LABELS;
  readonly priorityLabels = PRIORITY_LABELS;

  readonly items = signal<TaskDto[]>([]);
  readonly total = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(1);
  readonly search = signal('');
  readonly statusFilter = signal<TaskStatus | ''>('');
  readonly priorityFilter = signal<TaskPriority | ''>('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['normal'],
    dueAt: [''],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.list({
        page: this.page(),
        limit: 20,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
        priority: this.priorityFilter() || undefined,
      });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Failed to load tasks'));
    } finally {
      this.loading.set(false);
    }
  }

  applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  filterByStatus(status: string): void {
    this.statusFilter.set((status as TaskStatus) || '');
    this.page.set(1);
    void this.load();
  }

  filterByPriority(priority: string): void {
    this.priorityFilter.set((priority as TaskPriority) || '');
    this.page.set(1);
    void this.load();
  }

  goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ title: '', description: '', priority: 'normal', dueAt: '' });
    this.modalOpen.set(true);
  }

  openEdit(task: TaskDto): void {
    this.editingId.set(task.id);
    this.form.setValue({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '',
    });
    this.modalOpen.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const body = {
        title: v.title,
        description: v.description || undefined,
        priority: v.priority as TaskPriority,
        dueAt: v.dueAt ? new Date(v.dueAt).toISOString() : undefined,
      };
      const id = this.editingId();
      if (id) {
        await this.api.update(id, body);
      } else {
        await this.api.create(body);
      }
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Failed to save'));
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(task: TaskDto, status: string): Promise<void> {
    const next = status as TaskStatus;
    if (next === task.status) return;
    this.error.set(null);
    try {
      await this.api.update(task.id, { status: next });
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Failed to change status'));
    }
  }

  async remove(task: TaskDto): Promise<void> {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    this.error.set(null);
    try {
      await this.api.remove(task.id);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Failed to delete'));
    }
  }
}
