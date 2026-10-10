import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TaskPriority, TaskStatus, type TaskDto } from '@crm/shared';
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

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    priority: ['normal'],
    dueAt: [''],
  });

  constructor() {
    void this.load();
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

  protected applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  protected filterByStatus(status: string): void {
    this.statusFilter.set((status as TaskStatus) || '');
    this.page.set(1);
    void this.load();
  }

  protected filterByPriority(priority: string): void {
    this.priorityFilter.set((priority as TaskPriority) || '');
    this.page.set(1);
    void this.load();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load();
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
