import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ALL_PERMISSIONS, SystemRole, type Permission, type RoleSummaryDto } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { RolesApi } from './roles.api';

/** Permissions of one resource, e.g. contacts → read/create/update/delete. */
export interface PermissionGroup {
  /** i18n key suffix: `permissionGroup.<key>` */
  key: string;
  permissions: Array<{ code: Permission; action: string }>;
}

/** Why a role opens read-only (i18n key), or null when it is editable. */
export type RoleLock = 'roles.lockSystem' | 'roles.lockOwn' | 'roles.lockStronger' | null;

/** Roles business logic. Provided at the RolesPageComponent level (not a singleton). */
@Injectable()
export class RolesPageComponentService {
  private readonly api = inject(RolesApi);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  /** The permission catalog grouped by resource, in the contract's order. */
  readonly groups: PermissionGroup[] = groupPermissions(ALL_PERMISSIONS);

  async load(): Promise<RoleSummaryDto[]> {
    return sortRoles(await this.api.list());
  }

  /** Mirrors the server rules so the UI only offers allowed edits. */
  lock(role: RoleSummaryDto): RoleLock {
    if (role.isSystem) return 'roles.lockSystem';
    if (role.assignedToMe) return 'roles.lockOwn';
    if (role.permissions.some((p) => !this.canGrant(p))) return 'roles.lockStronger';
    return null;
  }

  /** Only permissions the current user holds can be granted. */
  canGrant(permission: Permission): boolean {
    return this.auth.can(permission);
  }

  /** In use → the server refuses to delete (members / pending invitations must be moved first). */
  inUse(role: RoleSummaryDto): boolean {
    return role.memberCount > 0 || role.invitationCount > 0;
  }

  /** Creates (no id) or updates a role from the editor. */
  save(
    id: string | null,
    value: { name: string; description: string },
    permissions: ReadonlySet<Permission>,
  ): Promise<RoleSummaryDto> {
    // Keep the catalog order so the stored set is stable.
    const codes = ALL_PERMISSIONS.filter((p) => permissions.has(p));
    const name = value.name.trim();
    const description = value.description.trim();
    return id
      ? this.api.update(id, { name, description: description || null, permissions: codes })
      : this.api.create({ name, description: description || undefined, permissions: codes });
  }

  remove(role: RoleSummaryDto): Promise<void> {
    return this.api.remove(role.id);
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}

const SYSTEM_ORDER: string[] = [
  SystemRole.Owner,
  SystemRole.Admin,
  SystemRole.Manager,
  SystemRole.Agent,
  SystemRole.Viewer,
];

/** System roles from the most to the least powerful, then custom roles by name. */
export function sortRoles(roles: RoleSummaryDto[]): RoleSummaryDto[] {
  const rank = (r: RoleSummaryDto) => (r.isSystem ? SYSTEM_ORDER.indexOf(r.code) : SYSTEM_ORDER.length);
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** "contacts.read" → group "contacts", action "read"; groups keep first-seen order. */
export function groupPermissions(codes: readonly Permission[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const code of codes) {
    const [key, action] = code.split('.');
    const group = groups.get(key) ?? { key, permissions: [] };
    group.permissions.push({ code, action });
    groups.set(key, group);
  }
  return [...groups.values()];
}
