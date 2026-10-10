import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LeadStatus, type DealDto, type LeadDto, type Paginated } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { LeadsApi, type LeadListParams } from './leads.api';

/** Leads business logic. Provided at the LeadsPageComponent level (not a singleton). */
@Injectable()
export class LeadsPageComponentService {
  private readonly api = inject(LeadsApi);
  private readonly translate = inject(TranslateService);

  list(params: LeadListParams): Promise<Paginated<LeadDto>> {
    return this.api.list(params);
  }

  /** Creates (no id) or updates a lead from the form value. */
  save(id: string | null, value: { source: string; estimatedValue: string; currency: string }): Promise<LeadDto> {
    const body = {
      source: value.source || undefined,
      estimatedValue: value.estimatedValue || undefined,
      currency: value.currency || undefined,
    };
    return id ? this.api.update(id, body) : this.api.create(body);
  }

  changeStatus(id: string, status: LeadStatus, lostReason?: string): Promise<LeadDto> {
    return this.api.changeStatus(id, status, lostReason);
  }

  convert(id: string, title: string): Promise<{ lead: LeadDto; deal: DealDto }> {
    return this.api.convert(id, title);
  }

  remove(id: string): Promise<void> {
    return this.api.remove(id);
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
