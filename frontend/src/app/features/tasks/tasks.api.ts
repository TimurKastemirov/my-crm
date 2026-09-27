import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Paginated, TaskDto, TaskPriority, TaskStatus } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

export interface TaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string;
}

export interface TaskListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
}

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly api = inject(ApiClient);

  list(params: TaskListParams): Promise<Paginated<TaskDto>> {
    return firstValueFrom(this.api.get<Paginated<TaskDto>>('/tasks', { ...params }));
  }

  create(body: TaskInput): Promise<TaskDto> {
    return firstValueFrom(this.api.post<TaskDto>('/tasks', body));
  }

  update(id: string, body: TaskInput): Promise<TaskDto> {
    return firstValueFrom(this.api.patch<TaskDto>(`/tasks/${id}`, body));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/tasks/${id}`));
  }
}
