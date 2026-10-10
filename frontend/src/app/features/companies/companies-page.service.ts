import { Injectable, inject } from '@angular/core';
import type { CompanyDto, Paginated } from '@crm/shared';
import { TranslateService } from '@ngx-translate/core';
import { extractErrorMessage } from '../../core/http-error';
import { CompaniesApi, type CompanyInput, type ListParams } from './companies.api';

/** Companies business logic. Provided at the CompaniesPageComponent level (not a singleton). */
@Injectable()
export class CompaniesPageComponentService {
  private readonly api = inject(CompaniesApi);
  private readonly translate = inject(TranslateService);

  list(params: ListParams): Promise<Paginated<CompanyDto>> {
    return this.api.list(params);
  }

  /** Creates (no id) or updates a company from the form value. */
  save(id: string | null, value: { name: string; website: string; industry: string; size: string }): Promise<CompanyDto> {
    const body: CompanyInput = {
      name: value.name,
      website: value.website || undefined,
      industry: value.industry || undefined,
      size: value.size || undefined,
    };
    return id ? this.api.update(id, body) : this.api.create(body);
  }

  remove(id: string): Promise<void> {
    return this.api.remove(id);
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
