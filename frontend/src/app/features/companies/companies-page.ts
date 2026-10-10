import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { CompanyDto } from '@crm/shared';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { CompaniesPageComponentService } from './companies-page.service';

@Component({
  selector: 'app-companies-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent, TranslatePipe],
  templateUrl: './companies-page.html',
  providers: [CompaniesPageComponentService],
})
export class CompaniesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(CompaniesPageComponentService);

  protected readonly items = signal<CompanyDto[]>([]);
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    website: [''],
    industry: [''],
    size: [''],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.service.list({ page: this.page(), limit: 20, search: this.search() || undefined });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'companies.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', website: '', industry: '', size: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(c: CompanyDto): void {
    this.editingId.set(c.id);
    this.form.setValue({
      name: c.name,
      website: c.website ?? '',
      industry: c.industry ?? '',
      size: c.size ?? '',
    });
    this.modalOpen.set(true);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.service.save(this.editingId(), this.form.getRawValue());
      this.modalOpen.set(false);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'companies.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(c: CompanyDto): Promise<void> {
    if (!confirm(this.translate.instant('companies.deleteConfirm', { name: c.name }))) return;
    this.error.set(null);
    try {
      await this.service.remove(c.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'companies.deleteError'));
    }
  }
}
