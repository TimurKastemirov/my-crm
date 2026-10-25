import { describe, expect, it } from 'vitest';
import { PERMISSIONS, SystemRole } from '@crm/shared';
import {
  isOwnerRole,
  memberChangeDenial,
  roleAssignmentDenial,
} from './member-policy.js';

describe('memberChangeDenial', () => {
  const base = {
    actorUserId: 'actor',
    actorIsOwner: false,
    actorPermissions: [PERMISSIONS.MEMBERS_MANAGE, PERMISSIONS.DEALS_READ],
    targetUserId: 'target',
    targetIsOwner: false,
    targetPermissions: [PERMISSIONS.DEALS_READ],
  };

  it('allows changing another non-owner member', () => {
    expect(memberChangeDenial(base)).toBeNull();
  });

  it('forbids changing your own membership, even for an owner', () => {
    expect(
      memberChangeDenial({
        ...base,
        targetUserId: 'actor',
        actorIsOwner: true,
      }),
    ).toMatch(/your own membership/);
  });

  it('forbids changing a member who holds permissions the actor lacks (hierarchy)', () => {
    expect(
      memberChangeDenial({
        ...base,
        targetPermissions: [PERMISSIONS.DEALS_READ, PERMISSIONS.ROLES_MANAGE],
      }),
    ).toBe(
      `You cannot change a member who has permissions you do not have: ${PERMISSIONS.ROLES_MANAGE}`,
    );
  });

  it('a member without roles can be changed by anyone with members.manage', () => {
    expect(memberChangeDenial({ ...base, targetPermissions: [] })).toBeNull();
  });

  it('only an owner can change another owner', () => {
    expect(memberChangeDenial({ ...base, targetIsOwner: true })).toMatch(
      /Only an owner/,
    );
    expect(
      memberChangeDenial({ ...base, targetIsOwner: true, actorIsOwner: true }),
    ).toBeNull();
  });
});

describe('roleAssignmentDenial', () => {
  const agentRole = {
    code: SystemRole.Agent,
    isSystem: true,
    permissions: [PERMISSIONS.DEALS_READ, PERMISSIONS.DEALS_CREATE],
  };
  const ownerRole = { code: SystemRole.Owner, isSystem: true, permissions: [] };

  it('allows a role whose permissions are a subset of the actor’s', () => {
    expect(
      roleAssignmentDenial(
        [
          PERMISSIONS.DEALS_READ,
          PERMISSIONS.DEALS_CREATE,
          PERMISSIONS.MEMBERS_MANAGE,
        ],
        false,
        agentRole,
      ),
    ).toBeNull();
  });

  it('forbids granting permissions the actor lacks (no escalation) and names them', () => {
    expect(
      roleAssignmentDenial([PERMISSIONS.DEALS_READ], false, agentRole),
    ).toBe(
      `You cannot grant a role with permissions you do not have: ${PERMISSIONS.DEALS_CREATE}`,
    );
  });

  it('only an owner grants the owner role', () => {
    expect(roleAssignmentDenial([], false, ownerRole)).toMatch(/Only an owner/);
    expect(roleAssignmentDenial([], true, ownerRole)).toBeNull();
  });

  it('a custom role coded "owner" is not treated as the system owner role', () => {
    expect(isOwnerRole({ code: SystemRole.Owner, isSystem: false })).toBe(
      false,
    );
    expect(isOwnerRole({ code: SystemRole.Owner, isSystem: true })).toBe(true);
  });
});
