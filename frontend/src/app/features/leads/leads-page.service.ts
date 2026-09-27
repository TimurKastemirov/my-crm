import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { LeadStatus, type LeadDto } from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { LeadsApi } from './leads.api';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новый',
  contacted: 'Контакт',
  qualified: 'Квалификация',
  converted: 'Конвертирован',
  lost: 'Проигран',
};

@Injectable()
export class LeadsPageComponentService {
  private readonly api = inject(LeadsApi);
  private readonly fb = inject(FormBuilder);

  readonly statusLabels = STATUS_LABELS;

  readonly items = signal<LeadDto[]>([]);
  readonly total = signal(0);
  readonly hasNext = signal(false);
  readonly page = signal(1);
  readonly search = signal('');
  readonly statusFilter = signal<LeadStatus | ''>('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    source: [''],
    estimatedValue: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    currency: [''],
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.api.list({
        page: this.page(),
        limit: 20,
        search: this.search() || undefined,
        status: this.statusFilter() || undefined,
      });
      this.items.set(res.data);
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось загрузить лиды'));
    } finally {
      this.loading.set(false);
    }
  }

  applySearch(value: string): void {
    this.search.set(value.trim());
    this.page.set(1);
    void this.load();
  }

  filterByStatus(status: string): void {
    this.statusFilter.set((status as LeadStatus) || '');
    this.page.set(1);
    void this.load();
  }

  goPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ source: '', estimatedValue: '', currency: '' });
    this.modalOpen.set(true);
  }

  openEdit(lead: LeadDto): void {
    this.editingId.set(lead.id);
    this.form.setValue({
      source: lead.source ?? '',
      estimatedValue: lead.estimatedValue ?? '',
      currency: lead.currency ?? '',
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
        source: v.source || undefined,
        estimatedValue: v.estimatedValue || undefined,
        currency: v.currency || undefined,
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
      this.error.set(extractErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Смена статуса из выпадающего списка (для 'lost' спрашиваем причину). */
  async setStatus(lead: LeadDto, status: string): Promise<void> {
    const next = status as LeadStatus;
    if (next === lead.status) return;
    let lostReason: string | undefined;
    if (next === LeadStatus.Lost) {
      lostReason = window.prompt('Причина проигрыша?')?.trim() || undefined;
      if (!lostReason) return;
    }
    this.error.set(null);
    try {
      await this.api.changeStatus(lead.id, next, lostReason);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось сменить статус'));
    }
  }

  async convert(lead: LeadDto): Promise<void> {
    const title = window.prompt('Название сделки:', `Сделка по лиду`)?.trim();
    if (!title) return;
    this.error.set(null);
    try {
      await this.api.convert(lead.id, title);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось конвертировать'));
    }
  }

  async remove(lead: LeadDto): Promise<void> {
    if (!window.confirm('Удалить лид?')) return;
    this.error.set(null);
    try {
      await this.api.remove(lead.id);
      await this.load();
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось удалить'));
    }
  }
}
