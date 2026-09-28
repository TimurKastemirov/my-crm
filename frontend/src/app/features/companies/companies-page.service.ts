import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import type { CompanyDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { CompaniesApi } from './companies.api';

@Injectable()
export class CompaniesPageComponentService {
  private readonly api = inject(CompaniesApi);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<CompanyDto[]>([]);
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
    name: ['', [Validators.required, Validators.maxLength(160)]],
    website: [''],
    industry: [''],
    size: [''],
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
      this.error.set(extractErrorMessage(e, 'Failed to load companies'));
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
    this.form.reset({ name: '', website: '', industry: '', size: '' });
    this.modalOpen.set(true);
  }

  openEdit(c: CompanyDto): void {
    this.editingId.set(c.id);
    this.form.setValue({
      name: c.name,
      website: c.website ?? '',
      industry: c.industry ?? '',
      size: c.size ?? '',
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
        name: v.name,
        website: v.website || undefined,
        industry: v.industry || undefined,
        size: v.size || undefined,
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
      this.error.set(extractErrorMessage(e, 'Failed to save'));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: CompanyDto): Promise<void> {
    if (!confirm(`Delete company "${c.name}"?`)) return;
    this.error.set(null);
    try {
      await this.api.remove(c.id);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Failed to delete'));
    }
  }
}
