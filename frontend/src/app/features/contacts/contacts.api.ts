import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ContactDto, Paginated } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

export interface ContactInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ContactsApi {
  private readonly api = inject(ApiClient);

  list(params: ListParams): Promise<Paginated<ContactDto>> {
    return firstValueFrom(this.api.get<Paginated<ContactDto>>('/contacts', { ...params }));
  }

  create(body: ContactInput): Promise<ContactDto> {
    return firstValueFrom(this.api.post<ContactDto>('/contacts', body));
  }

  update(id: string, body: ContactInput): Promise<ContactDto> {
    return firstValueFrom(this.api.patch<ContactDto>(`/contacts/${id}`, body));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/contacts/${id}`));
  }
}
