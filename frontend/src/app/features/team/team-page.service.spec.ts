import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { MemberDto, RoleRef } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { TeamApi } from './team.api';
import { TeamPageComponentService } from './team-page.service';

const role = (code: string, isSystem = true): RoleRef => ({ id: `role-${code}`, name: code, code, isSystem });

const member = (userId: string, roleRef: RoleRef | null, status: MemberDto['status'] = 'active'): MemberDto => ({
  id: `member-${userId}`,
  organizationId: 'org-1',
  userId,
  email: `${userId}@example.com`,
  firstName: 'Jane',
  lastName: 'Doe',
  status,
  role: roleRef,
  joinedAt: null,
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-25T00:00:00.000Z',
});

describe('TeamPageComponentService', () => {
  let service: TeamPageComponentService;
  let updateMember: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateMember = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        TeamPageComponentService,
        { provide: TeamApi, useValue: { updateMember } },
        { provide: AuthService, useValue: { user: signal({ id: 'me' }), can: () => false } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: DOCUMENT, useValue: { location: { origin: 'https://crm.example' } } },
      ],
    });
    service = TestBed.inject(TeamPageComponentService);
  });

  describe('canManage', () => {
    const adminRoles = [role('admin'), role('agent')];
    const ownerRoles = [role('owner'), ...adminRoles];

    it('never offers actions on yourself', () => {
      expect(service.canManage(member('me', role('agent')), ownerRoles)).toBe(false);
    });

    it('offers actions on ordinary members', () => {
      expect(service.canManage(member('u1', role('agent')), adminRoles)).toBe(true);
      expect(service.canManage(member('u1', null), adminRoles)).toBe(true);
    });

    it('offers actions on an owner only to someone who can assign the owner role', () => {
      expect(service.canManage(member('u1', role('owner')), adminRoles)).toBe(false);
      expect(service.canManage(member('u1', role('owner')), ownerRoles)).toBe(true);
    });

    it('hides actions on a member whose role the user could not grant (hierarchy)', () => {
      expect(service.canManage(member('u1', role('hr', false)), adminRoles)).toBe(false);
    });
  });

  it('preselects the agent role for invitations, falling back to the first assignable role', () => {
    expect(service.defaultInviteRoleId([role('admin'), role('agent')])).toBe('role-agent');
    expect(service.defaultInviteRoleId([role('viewer')])).toBe('role-viewer');
    expect(service.defaultInviteRoleId([])).toBe('');
  });

  it('builds an absolute, url-encoded invitation link with the token in the fragment', () => {
    expect(service.inviteLink('a+b/c')).toBe('https://crm.example/invite#token=a%2Bb%2Fc');
  });

  it('toggles between suspended and active', async () => {
    await service.toggleSuspended(member('u1', role('agent'), 'active'));
    expect(updateMember).toHaveBeenLastCalledWith('member-u1', { status: 'suspended' });
    await service.toggleSuspended(member('u1', role('agent'), 'suspended'));
    expect(updateMember).toHaveBeenLastCalledWith('member-u1', { status: 'active' });
  });
});
