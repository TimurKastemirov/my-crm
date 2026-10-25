import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { AuditAction } from '@crm/shared';
import { parseEnumParam, parsePage } from '../../shared/list-query/list-query';
import { PaginatorComponent } from '../../shared/ui/paginator/paginator';
import { AuditPageComponentService, type AuditRow } from './audit-page.service';

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'app-audit-page',
  host: { class: 'block h-full' },
  imports: [DatePipe, TranslatePipe, PaginatorComponent],
  templateUrl: './audit-page.html',
  providers: [AuditPageComponentService],
})
export class AuditPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AuditPageComponentService);

  protected readonly groups = this.service.groups;
  protected readonly rows = signal<AuditRow[]>([]);
  protected readonly total = signal(0);
  protected readonly hasNext = signal(false);
  protected readonly page = signal(1);
  protected readonly action = signal<AuditAction | ''>('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // The URL query string is the source of truth for filters and the page.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.page.set(parsePage(q.get('page')));
      this.action.set(parseEnumParam(q.get('action'), this.service.actions));
      this.from.set(this.dateParam(q.get('from')));
      this.to.set(this.dateParam(q.get('to')));
      void this.load();
    });
  }

  /** Increments per load: a slower, older response must not overwrite a newer one. */
  private requestSeq = 0;

  protected async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await this.service.list({
        page: this.page(),
        action: this.action(),
        from: this.from(),
        to: this.to(),
      });
      if (seq !== this.requestSeq) return;
      this.rows.set(res.data.map((e) => this.service.toRow(e)));
      this.total.set(res.meta.total);
      this.hasNext.set(res.meta.hasNext);
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this.error.set(this.service.errorMessage(e, 'audit.loadError'));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected filterAction(value: string): void {
    this.go({ action: value || null, page: null });
  }

  protected filterFrom(value: string): void {
    this.go({ from: value || null, page: null });
  }

  protected filterTo(value: string): void {
    this.go({ to: value || null, page: null });
  }

  protected resetFilters(): void {
    this.go({ action: null, from: null, to: null, page: null });
  }

  protected goPage(page: number): void {
    this.go({ page: page > 1 ? page : null });
  }

  private go(queryParams: Params): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private dateParam(raw: string | null): string {
    return raw && DATE_PARAM.test(raw) ? raw : '';
  }
}
