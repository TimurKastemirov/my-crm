import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { DealDto, Paginated } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

export interface DealInput {
  pipelineId: string;
  stageId: string;
  title: string;
  amount?: string;
  currency?: string;
}

export interface DealListParams {
  pipelineId?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class DealsApi {
  private readonly api = inject(ApiClient);

  list(params: DealListParams): Promise<Paginated<DealDto>> {
    return firstValueFrom(this.api.get<Paginated<DealDto>>('/deals', { ...params }));
  }

  create(body: DealInput): Promise<DealDto> {
    return firstValueFrom(this.api.post<DealDto>('/deals', body));
  }

  moveStage(id: string, stageId: string): Promise<DealDto> {
    return firstValueFrom(this.api.patch<DealDto>(`/deals/${id}/move-stage`, { stageId }));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/deals/${id}`));
  }
}
