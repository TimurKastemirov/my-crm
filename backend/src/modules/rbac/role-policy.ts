/**
 * Pure rules for managing roles (no I/O). Each returns null when allowed, otherwise the reason
 * sent to the client as a 403. Together they stop privilege escalation via `roles.manage`.
 */

const missing = (actor: readonly string[], wanted: readonly string[]) =>
  wanted.filter((p) => !actor.includes(p));

/** Creating a role, or setting `newPermissions` on one: only permissions the actor holds. */
export function grantDenial(
  actorPermissions: readonly string[],
  newPermissions: readonly string[],
): string | null {
  const lacking = missing(actorPermissions, newPermissions);
  return lacking.length
    ? `You cannot grant permissions you do not have: ${lacking.join(', ')}`
    : null;
}

/** Editing or deleting an existing role. */
export function roleChangeDenial(ctx: {
  actorPermissions: readonly string[];
  actorRoleIds: readonly string[];
  role: { id: string; permissions: readonly string[] };
}): string | null {
  // Editing your own role could only lock you out or (if it weren't for the subset rule) escalate.
  if (ctx.actorRoleIds.includes(ctx.role.id)) {
    return 'You cannot change a role you hold';
  }
  const lacking = missing(ctx.actorPermissions, ctx.role.permissions);
  return lacking.length
    ? `You cannot change a role with permissions you do not have: ${lacking.join(', ')}`
    : null;
}
