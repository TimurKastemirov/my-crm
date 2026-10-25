import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuditLogDto, AuditLogQuery, Paginated } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly api = inject(ApiClient);

  list(query: AuditLogQuery): Promise<Paginated<AuditLogDto>> {
    return firstValueFrom(this.api.get<Paginated<AuditLogDto>>('/audit-logs', { ...query }));
  }
}
