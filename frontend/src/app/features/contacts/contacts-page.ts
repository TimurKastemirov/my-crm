import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ContactDto } from '@crm/shared';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { ContactsPageComponentService } from './contacts-page.service';

@Component({
  selector: 'app-contacts-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, ModalComponent, PaginatorComponent, TranslatePipe],
  templateUrl: './contacts-page.html',
  providers: [ContactsPageComponentService],
})
export class ContactsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(ContactsPageComponentService);

  protected readonly items = signal<ContactDto[]>([]);
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
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    position: [''],
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
      this.error.set(this.service.errorMessage(e, 'contacts.loadError'));
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
    this.form.reset({ firstName: '', lastName: '', email: '', phone: '', position: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(c: ContactDto): void {
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
      this.error.set(this.service.errorMessage(e, 'contacts.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(c: ContactDto): Promise<void> {
    if (!confirm(this.translate.instant('contacts.deleteConfirm', { name: `${c.firstName} ${c.lastName}` }))) return;
    this.error.set(null);
    try {
      await this.service.remove(c.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'contacts.deleteError'));
    }
  }
}
