import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AUDIT_ACTIONS, type AuditLogDto, type Paginated } from '@crm/shared';
import { AuditApi } from './audit.api';
import { AuditPageComponent } from './audit-page';

const page = (ids: string[]): Paginated<AuditLogDto> => ({
  data: ids.map((id) => ({
    id,
    organizationId: 'o1',
    actor: { id: 'u1', email: 'ada@x.test', firstName: 'Ada', lastName: 'L' },
    action: AUDIT_ACTIONS.AuthLogin,
    entityType: 'user',
    entityId: 'u1',
    ip: '203.0.113.7',
    userAgent: null,
    before: null,
    after: null,
    createdAt: '2026-10-25T10:00:00.000Z',
  })),
  meta: { page: 1, limit: 20, total: ids.length, hasNext: false },
});

describe('AuditPageComponent', () => {
  it('renders entries and ignores a slower, older response', async () => {
    const resolvers: Array<(p: Paginated<AuditLogDto>) => void> = [];
    const list = vi.fn(() => new Promise<Paginated<AuditLogDto>>((resolve) => resolvers.push(resolve)));
    TestBed.configureTestingModule({
      imports: [AuditPageComponent],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'en' }), { provide: AuditApi, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(AuditPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // Initial load is in flight; trigger a second one, then resolve them newest-first.
    void (fixture.componentInstance as unknown as { load(): Promise<void> }).load();
    expect(resolvers).toHaveLength(2);
    resolvers[1](page(['new']));
    await Promise.resolve();
    resolvers[0](page(['old-1', 'old-2']));
    await fixture.whenStable();
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Ada L');
    expect(items[0].textContent).toContain('203.0.113.7');
  });
});
