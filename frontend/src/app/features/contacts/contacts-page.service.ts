import { Injectable, inject } from '@angular/core';
import type { ContactDto, Paginated } from '@crm/shared';
import { TranslateService } from '@ngx-translate/core';
import { extractErrorMessage } from '../../core/http-error';
import { ContactsApi, type ContactInput, type ListParams } from './contacts.api';

/** Contacts business logic. Provided at the ContactsPageComponent level (not a singleton). */
@Injectable()
export class ContactsPageComponentService {
  private readonly api = inject(ContactsApi);
  private readonly translate = inject(TranslateService);

  list(params: ListParams): Promise<Paginated<ContactDto>> {
    return this.api.list(params);
  }

  /** Creates (no id) or updates a contact from the form value. */
  save(
    id: string | null,
    value: { firstName: string; lastName: string; email: string; phone: string; position: string },
  ): Promise<ContactDto> {
    const body: ContactInput = {
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email || undefined,
      phone: value.phone || undefined,
      position: value.position || undefined,
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
