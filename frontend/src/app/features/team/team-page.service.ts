import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  OrganizationMemberStatus,
  PERMISSIONS,
  SystemRole,
  type CreateInvitationResult,
  type InvitationDto,
  type MemberDto,
  type OrganizationDto,
  type RoleRef,
} from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/http-error';
import { TeamApi } from './team.api';

export interface TeamData {
  organization: OrganizationDto;
  members: MemberDto[];
  invitations: InvitationDto[];
  roles: RoleRef[];
}

/** Team (organization members) business logic. Provided at the TeamPageComponent level (not a singleton). */
@Injectable()
export class TeamPageComponentService {
  private readonly api = inject(TeamApi);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  /** Loads everything the page shows in parallel. */
  async load(): Promise<TeamData> {
    const [organization, members, invitations, roles] = await Promise.all([
      this.api.organization(),
      this.api.members(),
      this.api.invitations(),
      this.api.assignableRoles(),
    ]);
    return { organization, members, invitations, roles };
  }

  canRenameOrganization(): boolean {
    return this.auth.can(PERMISSIONS.ORGANIZATIONS_MANAGE);
  }

  renameOrganization(name: string): Promise<OrganizationDto> {
    return this.api.renameOrganization(name.trim());
  }

  isCurrentUser(member: MemberDto): boolean {
    return member.userId === this.auth.user()?.id;
  }

  /**
   * Mirrors the server rules so the UI doesn't offer actions that would be rejected: nobody changes
   * themselves, and the member's current role must be one the user could grant (the assignable
   * roles already encode "owner only by an owner" and "no permissions the user lacks").
   */
  canManage(member: MemberDto, assignableRoles: RoleRef[]): boolean {
    if (this.isCurrentUser(member)) return false;
    return !member.role || assignableRoles.some((r) => r.id === member.role?.id);
  }

  isSuspended(member: MemberDto): boolean {
    return member.status === OrganizationMemberStatus.Suspended;
  }

  /** Preselected role in the invite form: the least privileged working role, if assignable. */
  defaultInviteRoleId(roles: RoleRef[]): string {
    return (roles.find((r) => r.isSystem && r.code === SystemRole.Agent) ?? roles[0])?.id ?? '';
  }

  invite(value: { email: string; roleId: string }): Promise<CreateInvitationResult> {
    return this.api.invite({ email: value.email.trim(), roleId: value.roleId });
  }

  /** The shareable link for a freshly created invitation token. */
  inviteLink(token: string): string {
    // In the fragment, not the query: fragments never reach server logs or the Referer header.
    return `${this.document.location.origin}/invite#token=${encodeURIComponent(token)}`;
  }

  changeRole(member: MemberDto, roleId: string): Promise<MemberDto> {
    return this.api.updateMember(member.id, { roleId });
  }

  /** Suspends an active member or reactivates a suspended one. */
  toggleSuspended(member: MemberDto): Promise<MemberDto> {
    return this.api.updateMember(member.id, {
      status: this.isSuspended(member)
        ? OrganizationMemberStatus.Active
        : OrganizationMemberStatus.Suspended,
    });
  }

  removeMember(member: MemberDto): Promise<void> {
    return this.api.removeMember(member.id);
  }

  revokeInvitation(invitation: InvitationDto): Promise<void> {
    return this.api.revokeInvitation(invitation.id);
  }

  /** Copies text to the clipboard; resolves false when the Clipboard API is unavailable. */
  async copy(text: string): Promise<boolean> {
    const clipboard = this.document.defaultView?.navigator.clipboard;
    if (!clipboard) return false;
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  displayName(member: MemberDto): string {
    return `${member.firstName} ${member.lastName}`.trim() || member.email;
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }
}
