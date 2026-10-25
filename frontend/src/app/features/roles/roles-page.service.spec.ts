import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ALL_PERMISSIONS, PERMISSIONS, type Permission, type RoleSummaryDto } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { RolesApi } from './roles.api';
import { RolesPageComponentService, groupPermissions, sortRoles } from './roles-page.service';

const role = (over: Partial<RoleSummaryDto>): RoleSummaryDto => ({
  id: 'r1',
  organizationId: 'o1',
  name: 'Sales',
  code: 'sales',
  isSystem: false,
  description: null,
  permissions: [PERMISSIONS.DEALS_READ],
  memberCount: 0,
  invitationCount: 0,
  assignedToMe: false,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('groupPermissions', () => {
  it('groups the whole catalog by resource, keeping the order', () => {
    const groups = groupPermissions(ALL_PERMISSIONS);
    expect(groups[0]).toEqual({
      key: 'contacts',
      permissions: [
        { code: 'contacts.read', action: 'read' },
        { code: 'contacts.create', action: 'create' },
        { code: 'contacts.update', action: 'update' },
        { code: 'contacts.delete', action: 'delete' },
      ],
    });
    expect(groups.flatMap((g) => g.permissions).length).toBe(ALL_PERMISSIONS.length);
    expect(groups.find((g) => g.key === 'data')?.permissions.map((p) => p.action)).toEqual(['import', 'export']);
  });
});

describe('sortRoles', () => {
  it('orders system roles by power, then custom roles by name', () => {
    const list = [
      role({ id: '1', code: 'viewer', name: 'Viewer', isSystem: true }),
      role({ id: '2', code: 'zeta', name: 'Zeta' }),
      role({ id: '3', code: 'admin', name: 'Admin', isSystem: true }),
      role({ id: '4', code: 'alpha', name: 'Alpha' }),
      role({ id: '5', code: 'owner', name: 'Owner', isSystem: true }),
    ];
    expect(sortRoles(list).map((r) => r.id)).toEqual(['5', '3', '1', '4', '2']);
  });
});

describe('RolesPageComponentService', () => {
  const mine: Permission[] = [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE];
  const api = { create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) };
  let service: RolesPageComponentService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        RolesPageComponentService,
        { provide: RolesApi, useValue: api },
        { provide: AuthService, useValue: { can: (p: Permission) => mine.includes(p) } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    service = TestBed.inject(RolesPageComponentService);
  });

  it('locks system roles, your own role and roles stronger than you', () => {
    expect(service.lock(role({ isSystem: true }))).toBe('roles.lockSystem');
    expect(service.lock(role({ assignedToMe: true }))).toBe('roles.lockOwn');
    expect(service.lock(role({ permissions: [PERMISSIONS.MEMBERS_MANAGE] }))).toBe('roles.lockStronger');
    expect(service.lock(role({}))).toBeNull();
  });

  it('a role in use (members or pending invitations) cannot be deleted', () => {
    expect(service.inUse(role({ memberCount: 1 }))).toBe(true);
    expect(service.inUse(role({ invitationCount: 2 }))).toBe(true);
    expect(service.inUse(role({}))).toBe(false);
  });

  it('creates with trimmed fields and permissions in catalog order', async () => {
    await service.save(
      null,
      { name: ' Sales ', description: '  ' },
      new Set<Permission>([PERMISSIONS.DEALS_CREATE, PERMISSIONS.DEALS_READ]),
    );
    expect(api.create).toHaveBeenCalledWith({
      name: 'Sales',
      description: undefined,
      permissions: [PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE],
    });
  });

  it('an edit can clear the description', async () => {
    await service.save('r1', { name: 'Sales', description: '' }, new Set());
    expect(api.update).toHaveBeenCalledWith('r1', { name: 'Sales', description: null, permissions: [] });
  });
});
