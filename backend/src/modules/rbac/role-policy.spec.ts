import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@crm/shared';
import { grantDenial, roleChangeDenial } from './role-policy.js';

const actor = [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE];

describe('grantDenial', () => {
  it('allows granting a subset of your own permissions', () => {
    expect(grantDenial(actor, [PERMISSIONS.DEALS_READ])).toBeNull();
    expect(grantDenial(actor, [])).toBeNull();
  });

  it('forbids granting permissions you lack and names them', () => {
    expect(grantDenial(actor, [PERMISSIONS.DEALS_READ, PERMISSIONS.ORGANIZATIONS_MANAGE])).toBe(
      `You cannot grant permissions you do not have: ${PERMISSIONS.ORGANIZATIONS_MANAGE}`,
    );
  });
});

describe('roleChangeDenial', () => {
  const role = { id: 'role-1', permissions: [PERMISSIONS.DEALS_READ] };

  it('allows changing a weaker role you do not hold', () => {
    expect(roleChangeDenial({ actorPermissions: actor, actorRoleIds: ['role-0'], role })).toBeNull();
  });

  it('forbids changing your own role', () => {
    expect(roleChangeDenial({ actorPermissions: actor, actorRoleIds: ['role-1'], role })).toMatch(
      /role you hold/,
    );
  });

  it('forbids changing a role with permissions you lack', () => {
    expect(
      roleChangeDenial({
        actorPermissions: actor,
        actorRoleIds: [],
        role: { id: 'role-2', permissions: [PERMISSIONS.MEMBERS_MANAGE] },
      }),
    ).toMatch(/permissions you do not have: members\.manage/);
  });
});
