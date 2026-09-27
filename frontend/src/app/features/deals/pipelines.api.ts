import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PipelineDto } from '@crm/shared';
import { ApiClient } from '../../core/api-client';

@Injectable({ providedIn: 'root' })
export class PipelinesApi {
  private readonly api = inject(ApiClient);

  list(): Promise<PipelineDto[]> {
    return firstValueFrom(this.api.get<PipelineDto[]>('/pipelines'));
  }
}
