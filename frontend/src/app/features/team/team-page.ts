import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { InvitationDto, MemberDto, OrganizationDto, RoleRef } from '@crm/shared';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { TeamPageComponentService } from './team-page.service';

@Component({
  selector: 'app-team-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, ModalComponent],
  templateUrl: './team-page.html',
  providers: [TeamPageComponentService],
})
export class TeamPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(TeamPageComponentService);

  protected readonly organization = signal<OrganizationDto | null>(null);
  protected readonly members = signal<MemberDto[]>([]);
  protected readonly invitations = signal<InvitationDto[]>([]);
  protected readonly roles = signal<RoleRef[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Id of the member/invitation whose action is in flight (disables its buttons). */
  protected readonly busyId = signal<string | null>(null);

  protected readonly canRename = this.service.canRenameOrganization();
  protected readonly renaming = signal(false);
  protected readonly renamed = signal(false);
  protected readonly orgForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
  });

  protected readonly inviteOpen = signal(false);
  protected readonly inviting = signal(false);
  protected readonly inviteError = signal<string | null>(null);
  /** Set after a successful invitation: the one-time link to share. */
  protected readonly inviteLink = signal<string | null>(null);
  protected readonly inviteExpiresAt = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    roleId: ['', [Validators.required]],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.service.load();
      this.organization.set(data.organization);
      this.members.set(data.members);
      this.invitations.set(data.invitations);
      this.roles.set(data.roles);
      this.orgForm.setValue({ name: data.organization.name });
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'team.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  protected isMe(member: MemberDto): boolean {
    return this.service.isCurrentUser(member);
  }

  protected canManage(member: MemberDto): boolean {
    return this.service.canManage(member, this.roles());
  }

  protected isSuspended(member: MemberDto): boolean {
    return this.service.isSuspended(member);
  }

  protected displayName(member: MemberDto): string {
    return this.service.displayName(member);
  }

  protected async rename(): Promise<void> {
    if (this.orgForm.invalid) {
      this.orgForm.markAllAsTouched();
      return;
    }
    this.renaming.set(true);
    this.renamed.set(false);
    this.error.set(null);
    try {
      this.organization.set(await this.service.renameOrganization(this.orgForm.getRawValue().name));
      this.renamed.set(true);
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'team.saveError'));
    } finally {
      this.renaming.set(false);
    }
  }

  protected openInvite(): void {
    this.inviteForm.reset({ email: '', roleId: this.service.defaultInviteRoleId(this.roles()) });
    this.inviteError.set(null);
    this.inviteLink.set(null);
    this.inviteExpiresAt.set(null);
    this.copied.set(false);
    this.inviteOpen.set(true);
  }

  protected async sendInvite(): Promise<void> {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    this.inviting.set(true);
    this.inviteError.set(null);
    try {
      const result = await this.service.invite(this.inviteForm.getRawValue());
      this.inviteLink.set(this.service.inviteLink(result.token));
      this.inviteExpiresAt.set(result.invitation.expiresAt);
      this.invitations.update((list) => [
        result.invitation,
        ...list.filter((i) => i.email !== result.invitation.email),
      ]);
    } catch (e) {
      this.inviteError.set(this.service.errorMessage(e, 'team.inviteError'));
    } finally {
      this.inviting.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
    const link = this.inviteLink();
    if (link) this.copied.set(await this.service.copy(link));
  }

  protected async changeRole(member: MemberDto, roleId: string): Promise<void> {
    if (!roleId || roleId === member.role?.id) return;
    await this.runFor(member.id, 'team.saveError', async () => {
      const updated = await this.service.changeRole(member, roleId);
      this.replaceMember(updated);
    });
  }

  protected async toggleSuspended(member: MemberDto): Promise<void> {
    const key = this.isSuspended(member) ? 'team.activateConfirm' : 'team.suspendConfirm';
    if (!window.confirm(this.translate.instant(key, { name: this.displayName(member) }))) return;
    await this.runFor(member.id, 'team.saveError', async () => {
      this.replaceMember(await this.service.toggleSuspended(member));
    });
  }

  protected async remove(member: MemberDto): Promise<void> {
    if (!window.confirm(this.translate.instant('team.removeConfirm', { name: this.displayName(member) }))) return;
    await this.runFor(member.id, 'team.removeError', async () => {
      await this.service.removeMember(member);
      this.members.update((list) => list.filter((m) => m.id !== member.id));
    });
  }

  protected async revoke(invitation: InvitationDto): Promise<void> {
    if (!window.confirm(this.translate.instant('team.revokeConfirm', { email: invitation.email }))) return;
    await this.runFor(invitation.id, 'team.revokeError', async () => {
      await this.service.revokeInvitation(invitation);
      this.invitations.update((list) => list.filter((i) => i.id !== invitation.id));
    });
  }

  /** Runs a row action with its busy flag and maps a failure to the page error banner. */
  private async runFor(id: string, errorKey: string, action: () => Promise<void>): Promise<void> {
    this.busyId.set(id);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      const message = this.service.errorMessage(e, errorKey);
      // Re-sync first (e.g. a rejected role change must not leave the select showing the new value),
      // then show the error — load() clears the banner when it starts.
      await this.load();
      this.error.set(message);
    } finally {
      this.busyId.set(null);
    }
  }

  private replaceMember(updated: MemberDto): void {
    this.members.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
  }
}
