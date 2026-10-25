import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CreateInvitationRequest,
  CreateInvitationResult,
  InvitationDto,
  MemberDto,
  OrganizationDto,
  RoleRef,
  UpdateMemberRequest,
} from '@crm/shared';
import { ApiClient } from '../../core/api-client';

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly api = inject(ApiClient);

  organization(): Promise<OrganizationDto> {
    return firstValueFrom(this.api.get<OrganizationDto>('/organizations/current'));
  }

  renameOrganization(name: string): Promise<OrganizationDto> {
    return firstValueFrom(this.api.patch<OrganizationDto>('/organizations/current', { name }));
  }

  members(): Promise<MemberDto[]> {
    return firstValueFrom(this.api.get<MemberDto[]>('/organizations/members'));
  }

  assignableRoles(): Promise<RoleRef[]> {
    return firstValueFrom(this.api.get<RoleRef[]>('/organizations/members/assignable-roles'));
  }

  invite(body: CreateInvitationRequest): Promise<CreateInvitationResult> {
    return firstValueFrom(this.api.post<CreateInvitationResult>('/organizations/members', body));
  }

  updateMember(id: string, body: UpdateMemberRequest): Promise<MemberDto> {
    return firstValueFrom(this.api.patch<MemberDto>(`/organizations/members/${id}`, body));
  }

  removeMember(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/organizations/members/${id}`));
  }

  invitations(): Promise<InvitationDto[]> {
    return firstValueFrom(this.api.get<InvitationDto[]>('/organizations/invitations'));
  }

  revokeInvitation(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/organizations/invitations/${id}`));
  }
}
