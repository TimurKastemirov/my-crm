import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CreateRoleRequest, RoleSummaryDto, UpdateRoleRequest } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly api = inject(ApiClient);

  list(): Promise<RoleSummaryDto[]> {
    return firstValueFrom(this.api.get<RoleSummaryDto[]>('/roles'));
  }

  create(body: CreateRoleRequest): Promise<RoleSummaryDto> {
    return firstValueFrom(this.api.post<RoleSummaryDto>('/roles', body));
  }

  update(id: string, body: UpdateRoleRequest): Promise<RoleSummaryDto> {
    return firstValueFrom(this.api.patch<RoleSummaryDto>(`/roles/${id}`, body));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/roles/${id}`));
  }
}
