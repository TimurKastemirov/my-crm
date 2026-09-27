import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ALL_PERMISSIONS, SystemRole } from '@crm/shared';
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_NAMES } from './system-roles.js';

describe('SYSTEM_ROLE_PERMISSIONS', () => {
  it('владелец получает все права', () => {
    expect(SYSTEM_ROLE_PERMISSIONS[SystemRole.Owner]).toEqual(ALL_PERMISSIONS);
  });

  it('админ — все, кроме управления организацией', () => {
    const admin = SYSTEM_ROLE_PERMISSIONS[SystemRole.Admin];
    expect(admin).not.toContain(PERMISSIONS.ORGANIZATIONS_MANAGE);
    expect(admin).toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it('наблюдатель — только чтение', () => {
    const viewer = SYSTEM_ROLE_PERMISSIONS[SystemRole.Viewer];
    expect(viewer.every((p) => p.endsWith('.read'))).toBe(true);
    expect(viewer).not.toContain(PERMISSIONS.CONTACTS_DELETE);
  });

  it('сотрудник не может удалять и управлять ролями', () => {
    const agent = SYSTEM_ROLE_PERMISSIONS[SystemRole.Agent];
    expect(agent).toContain(PERMISSIONS.DEALS_CREATE);
    expect(agent).not.toContain(PERMISSIONS.DEALS_DELETE);
    expect(agent).not.toContain(PERMISSIONS.ROLES_MANAGE);
  });

  it('у каждой системной роли есть человекочитаемое имя', () => {
    for (const role of Object.values(SystemRole)) {
      expect(SYSTEM_ROLE_NAMES[role]).toBeTruthy();
    }
  });
});
