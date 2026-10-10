import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TaskPriority, TaskStatus, type Paginated, type TaskDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { TasksApi, type TaskListParams } from './tasks.api';

/** Tasks business logic. Provided at the TasksPageComponent level (not a singleton). */
@Injectable()
export class TasksPageComponentService {
  private readonly api = inject(TasksApi);
  private readonly translate = inject(TranslateService);

  list(params: TaskListParams): Promise<Paginated<TaskDto>> {
    return this.api.list(params);
  }

  /** Creates (no id) or updates a task from the form value. */
  save(
    id: string | null,
    value: { title: string; description: string; priority: string; dueAt: string },
  ): Promise<TaskDto> {
    const body = {
      title: value.title,
      description: value.description || undefined,
      priority: value.priority as TaskPriority,
      dueAt: value.dueAt ? new Date(value.dueAt).toISOString() : undefined,
    };
    return id ? this.api.update(id, body) : this.api.create(body);
  }

  setStatus(id: string, status: TaskStatus): Promise<TaskDto> {
    return this.api.update(id, { status });
  }

  remove(id: string): Promise<void> {
    return this.api.remove(id);
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
