import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CompanyDto, Paginated } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

export interface CompanyInput {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  private readonly api = inject(ApiClient);

  list(params: ListParams): Promise<Paginated<CompanyDto>> {
    return firstValueFrom(this.api.get<Paginated<CompanyDto>>('/companies', { ...params }));
  }

  create(body: CompanyInput): Promise<CompanyDto> {
    return firstValueFrom(this.api.post<CompanyDto>('/companies', body));
  }

  update(id: string, body: CompanyInput): Promise<CompanyDto> {
    return firstValueFrom(this.api.patch<CompanyDto>(`/companies/${id}`, body));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/companies/${id}`));
  }
}
