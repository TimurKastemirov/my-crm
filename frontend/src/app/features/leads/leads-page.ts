import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LeadStatus, type LeadDto } from '@crm/shared';
import { LocaleService } from '../../core/locale.service';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { LeadsPageComponentService } from './leads-page.service';

@Component({
  selector: 'app-leads-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, CurrencyPipe, TranslatePipe, ModalComponent, PaginatorComponent],
  templateUrl: './leads-page.html',
  providers: [LeadsPageComponentService],
})
export class LeadsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(LeadsPageComponentService);

  protected readonly locale = inject(LocaleService).locale;

  protected readonly items = signal<LeadDto[]>([]);
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<LeadStatus | ''>('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    source: [''],
    estimatedValue: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.service.list({
        page: this.page(),
        limit: 20,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
      });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  protected filterByStatus(status: string): void {
    this.statusFilter.set((status as LeadStatus) || '');
    this.page.set(1);
    void this.load();
  }

  protected goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ source: '', estimatedValue: '', currency: '' });
    this.modalOpen.set(true);
  }

  protected openEdit(lead: LeadDto): void {
    this.editingId.set(lead.id);
    this.form.setValue({
      source: lead.source ?? '',
      estimatedValue: lead.estimatedValue ?? '',
      currency: lead.currency ?? '',
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
      this.error.set(this.service.errorMessage(e, 'leads.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Status change from the dropdown (for 'lost' we ask for a reason). */
  protected async setStatus(lead: LeadDto, status: string): Promise<void> {
    const next = status as LeadStatus;
    if (next === lead.status) return;
    let lostReason: string | undefined;
    if (next === LeadStatus.Lost) {
      lostReason = window.prompt(this.translate.instant('leads.lossReasonPrompt'))?.trim() || undefined;
      if (!lostReason) return;
    }
    this.error.set(null);
    try {
      await this.service.changeStatus(lead.id, next, lostReason);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.statusChangeError'));
    }
  }

  protected async convert(lead: LeadDto): Promise<void> {
    const title = window.prompt(this.translate.instant('leads.dealTitlePrompt'), this.translate.instant('leads.dealTitleDefault'))?.trim();
    if (!title) return;
    this.error.set(null);
    try {
      await this.service.convert(lead.id, title);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.convertError'));
    }
  }

  protected async remove(lead: LeadDto): Promise<void> {
    if (!window.confirm(this.translate.instant('leads.deleteConfirm'))) return;
    this.error.set(null);
    try {
      await this.service.remove(lead.id);
      await this.load();
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'leads.deleteError'));
    }
  }
}
