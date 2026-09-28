import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import type { ContactDto } from '@crm/shared';
import { TranslateService } from '@ngx-translate/core';
import { extractErrorMessage } from '../../core/http-error';
import { ContactsApi } from './contacts.api';

@Injectable()
export class ContactsPageComponentService {
  private readonly api = inject(ContactsApi);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly items = signal<ContactDto[]>([]);
  readonly total = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(1);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    position: [''],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.list({ page: this.page(), limit: 20, search: this.search() || undefined });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(extractErrorMessage(e, this.translate.instant('contacts.loadError')));
    } finally {
      this.loading.set(false);
    }
  }

  applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ firstName: '', lastName: '', email: '', phone: '', position: '' });
    this.modalOpen.set(true);
  }

  openEdit(c: ContactDto): void {
    this.editingId.set(c.id);
    this.form.setValue({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email ?? '',
      phone: c.phone ?? '',
      position: c.position ?? '',
    });
    this.modalOpen.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const body = {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email || undefined,
        phone: v.phone || undefined,
        position: v.position || undefined,
      };
      const id = this.editingId();
      if (id) {
        await this.api.update(id, body);
      } else {
        await this.api.create(body);
      }
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, this.translate.instant('contacts.saveError')));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: ContactDto): Promise<void> {
    if (!confirm(this.translate.instant('contacts.deleteConfirm', { name: `${c.firstName} ${c.lastName}` }))) return;
    this.error.set(null);
    try {
      await this.api.remove(c.id);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, this.translate.instant('contacts.deleteError')));
    }
  }
}
