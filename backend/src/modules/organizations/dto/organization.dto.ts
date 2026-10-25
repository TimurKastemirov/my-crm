import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  OrganizationMemberStatus,
  type CreateInvitationRequest,
  type UpdateMemberRequest,
  type UpdateOrganizationRequest,
} from '@crm/shared';

export class UpdateOrganizationDto implements UpdateOrganizationRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}

export class CreateInvitationDto implements CreateInvitationRequest {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** Role to grant on acceptance (see GET /organizations/members/assignable-roles). */
  @IsUUID()
  roleId!: string;
}

export class UpdateMemberDto implements UpdateMemberRequest {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsIn([OrganizationMemberStatus.Active, OrganizationMemberStatus.Suspended])
  status?: 'active' | 'suspended';
}
