import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ALL_PERMISSIONS, SystemRole } from '@crm/shared';
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_NAMES } from './system-roles.js';

describe('SYSTEM_ROLE_PERMISSIONS', () => {
  it('owner gets all permissions', () => {
    expect(SYSTEM_ROLE_PERMISSIONS[SystemRole.Owner]).toEqual(ALL_PERMISSIONS);
  });

  it('admin — everything except organization management', () => {
    const admin = SYSTEM_ROLE_PERMISSIONS[SystemRole.Admin];
    expect(admin).not.toContain(PERMISSIONS.ORGANIZATIONS_MANAGE);
    expect(admin).toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it('viewer — read-only', () => {
    const viewer = SYSTEM_ROLE_PERMISSIONS[SystemRole.Viewer];
    expect(viewer.every((p) => p.endsWith('.read'))).toBe(true);
    expect(viewer).not.toContain(PERMISSIONS.CONTACTS_DELETE);
  });

  it('agent cannot delete or manage roles', () => {
    const agent = SYSTEM_ROLE_PERMISSIONS[SystemRole.Agent];
    expect(agent).toContain(PERMISSIONS.DEALS_CREATE);
    expect(agent).not.toContain(PERMISSIONS.DEALS_DELETE);
    expect(agent).not.toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it('every system role has a human-readable name', () => {
    for (const role of Object.values(SystemRole)) {
      expect(SYSTEM_ROLE_NAMES[role]).toBeTruthy();
    }
  });
});
