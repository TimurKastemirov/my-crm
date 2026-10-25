import { SystemRole } from '@crm/shared';

/**
 * Pure membership rules (no I/O) shared by the members service and its unit tests.
 * Each function returns null when the action is allowed, otherwise the reason
 * that is sent to the client as a 403 message.
 */

export interface MemberChangeContext {
  actorUserId: string;
  actorIsOwner: boolean;
  actorPermissions: readonly string[];
  targetUserId: string;
  targetIsOwner: boolean;
  /** Permissions of the target's roles, regardless of the target's status. */
  targetPermissions: readonly string[];
}

export interface AssignableRole {
  code: string;
  isSystem: boolean;
  permissions: readonly string[];
}

/** Whether the actor may change the role/status of, or remove, the target member. */
export function memberChangeDenial(ctx: MemberChangeContext): string | null {
  // Self-changes are blocked so nobody can lock themselves out by accident.
  if (ctx.actorUserId === ctx.targetUserId) {
    return 'You cannot change your own membership';
  }
  // Since the actor must be an active owner to touch an owner, the organization
  // always keeps at least one active owner.
  if (ctx.targetIsOwner && !ctx.actorIsOwner) {
    return 'Only an owner can change another owner';
  }
  // Hierarchy: nobody manages a member who holds permissions the actor lacks.
  const missing = ctx.targetPermissions.filter(
    (p) => !ctx.actorPermissions.includes(p),
  );
  if (missing.length) {
    return `You cannot change a member who has permissions you do not have: ${missing.join(', ')}`;
  }
  return null;
}

/** Whether the actor may grant the role (on invitation or role change). Prevents privilege escalation. */
export function roleAssignmentDenial(
  actorPermissions: readonly string[],
  actorIsOwner: boolean,
  role: AssignableRole,
): string | null {
  if (isOwnerRole(role) && !actorIsOwner) {
    return 'Only an owner can grant the owner role';
  }
  const missing = role.permissions.filter((p) => !actorPermissions.includes(p));
  if (missing.length) {
    return `You cannot grant a role with permissions you do not have: ${missing.join(', ')}`;
  }
  return null;
}

export function isOwnerRole(role: {
  code: string;
  isSystem: boolean;
}): boolean {
  return role.isSystem && role.code === SystemRole.Owner;
}
