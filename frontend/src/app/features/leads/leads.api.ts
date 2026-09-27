import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { DealDto, LeadDto, LeadStatus, Paginated } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

export interface LeadInput {
  source?: string;
  estimatedValue?: string;
  currency?: string;
}

export interface LeadListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
}

@Injectable({ providedIn: 'root' })
export class LeadsApi {
  private readonly api = inject(ApiClient);

  list(params: LeadListParams): Promise<Paginated<LeadDto>> {
    return firstValueFrom(this.api.get<Paginated<LeadDto>>('/leads', { ...params }));
  }

  create(body: LeadInput): Promise<LeadDto> {
    return firstValueFrom(this.api.post<LeadDto>('/leads', body));
  }

  update(id: string, body: LeadInput): Promise<LeadDto> {
    return firstValueFrom(this.api.patch<LeadDto>(`/leads/${id}`, body));
  }

  changeStatus(id: string, status: LeadStatus, lostReason?: string): Promise<LeadDto> {
    return firstValueFrom(this.api.patch<LeadDto>(`/leads/${id}/status`, { status, lostReason }));
  }

  convert(id: string, title: string): Promise<{ lead: LeadDto; deal: DealDto }> {
    return firstValueFrom(this.api.post<{ lead: LeadDto; deal: DealDto }>(`/leads/${id}/convert`, { title }));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/leads/${id}`));
  }
}
