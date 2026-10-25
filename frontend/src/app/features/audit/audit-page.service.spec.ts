import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ALL_AUDIT_ACTIONS, AUDIT_ACTIONS, type AuditLogDto } from '@crm/shared';
import { AuditApi } from './audit.api';
import {
  AuditPageComponentService,
  groupActions,
  startOfLocalDay,
  startOfNextLocalDay,
} from './audit-page.service';

const entry = (over: Partial<AuditLogDto>): AuditLogDto => ({
  id: 'a1',
  organizationId: 'o1',
  actor: { id: 'u1', email: 'ada@x.test', firstName: 'Ada', lastName: 'Lovelace' },
  action: AUDIT_ACTIONS.RoleUpdated,
  entityType: 'role',
  entityId: 'r1',
  ip: '127.0.0.1',
  userAgent: 'test',
  before: null,
  after: null,
  createdAt: '2026-10-25T10:00:00.000Z',
  ...over,
});

// `npm test` pins TZ=Europe/Berlin (CET, UTC+1 on these dates).
describe('audit date bounds', () => {
  it('a calendar day is turned into local-midnight bounds in UTC', () => {
    expect(startOfLocalDay('2026-03-01')).toBe('2026-02-28T23:00:00.000Z');
    expect(startOfNextLocalDay('2026-03-01')).toBe('2026-03-01T23:00:00.000Z');
  });
});

describe('groupActions', () => {
  it('groups every action by its prefix', () => {
    const groups = groupActions(ALL_AUDIT_ACTIONS);
    expect(groups.map((g) => g.key)).toContain('auth');
    expect(groups.find((g) => g.key === 'auth')?.actions).toContain(AUDIT_ACTIONS.AuthLoginFailed);
    expect(groups.flatMap((g) => g.actions)).toHaveLength(ALL_AUDIT_ACTIONS.length);
  });
});

describe('AuditPageComponentService', () => {
  const list = vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasNext: false } });
  let service: AuditPageComponentService;

  beforeEach(() => {
    list.mockClear();
    TestBed.configureTestingModule({
      providers: [
        AuditPageComponentService,
        { provide: AuditApi, useValue: { list } },
        { provide: TranslateService, useValue: { instant: (k: string) => `«${k}»` } },
      ],
    });
    service = TestBed.inject(AuditPageComponentService);
  });

  it('sends the filters with the period as an inclusive day range', async () => {
    await service.list({ page: 2, action: AUDIT_ACTIONS.AuthLogin, from: '2026-03-01', to: '2026-03-01' });
    expect(list).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      action: AUDIT_ACTIONS.AuthLogin,
      from: '2026-02-28T23:00:00.000Z',
      to: '2026-03-01T23:00:00.000Z',
    });
  });

  it('reads a reversed period the other way round', async () => {
    await service.list({ page: 1, action: '', from: '2026-03-05', to: '2026-03-01' });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-02-28T23:00:00.000Z', to: '2026-03-05T23:00:00.000Z' }),
    );
  });

  it('omits empty filters', async () => {
    await service.list({ page: 1, action: '', from: '', to: '' });
    expect(list).toHaveBeenCalledWith({ page: 1, limit: 20, action: undefined, from: undefined, to: undefined });
  });

  it('shows the actor by name, falling back to email and to "unknown"', () => {
    expect(service.actorName(entry({}))).toBe('Ada Lovelace');
    expect(service.actorName(entry({ actor: { id: 'u', email: 'e@x.test', firstName: '', lastName: '' } }))).toBe('e@x.test');
    expect(service.actorName(entry({ actor: null }))).toBe('«audit.unknownActor»');
  });

  it('lists changed fields with translated permissions and reasons', () => {
    const changes = service.changes(
      entry({
        before: { name: 'Sales', permissions: ['deals.read'] },
        after: { name: 'Sales', permissions: [] },
      }),
    );
    // The unchanged name is left out; only what changed is shown.
    expect(changes).toEqual([
      { field: 'permissions', before: '«permissionGroup.deals»: «permissionAction.read»', after: '—' },
    ]);
    expect(service.changes(entry({ after: { reason: 'invalid_password' } }))).toEqual([
      { field: 'reason', before: null, after: '«auditReason.invalid_password»' },
    ]);
  });
});
