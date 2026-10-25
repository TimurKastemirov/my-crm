import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PERMISSIONS,
  type CreateInvitationResult,
  type InvitationDto,
  type JwtPayload,
  type MemberDto,
  type OrganizationDto,
  type RoleRef,
} from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { OrganizationsService } from './organizations.service.js';
import { MembersService } from './members.service.js';
import {
  CreateInvitationDto,
  UpdateMemberDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly members: MembersService,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: 'Current organization',
    description: 'The active organization of the session.',
  })
  @ApiOkResponse({ description: 'Organization' })
  getCurrent(@CurrentUser() user: JwtPayload): Promise<OrganizationDto> {
    return this.organizations.getCurrent(user.organizationId);
  }

  @Patch('current')
  @RequirePermissions(PERMISSIONS.ORGANIZATIONS_MANAGE)
  @ApiOperation({
    summary: 'Update current organization',
    description: 'Renames the organization.',
  })
  @ApiOkResponse({ description: 'Updated organization' })
  updateCurrent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    return this.organizations.updateCurrent(user.organizationId, dto);
  }

  @Get('members')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Members',
    description: 'All members of the organization with their role and status.',
  })
  @ApiOkResponse({ description: 'List of members' })
  listMembers(@CurrentUser() user: JwtPayload): Promise<MemberDto[]> {
    return this.members.list(user.organizationId);
  }

  @Get('members/assignable-roles')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Assignable roles',
    description:
      'Roles the current user may grant: only the owner grants owner, and never a role with permissions the user lacks.',
  })
  @ApiOkResponse({ description: 'List of roles' })
  assignableRoles(@CurrentUser() user: JwtPayload): Promise<RoleRef[]> {
    return this.members.assignableRoles(user.organizationId, user.sub);
  }

  @Post('members')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Invite a member',
    description:
      'Creates a one-time invitation link (valid for 7 days). The token is returned only in this response. A pending invitation for the same email is replaced.',
  })
  @ApiCreatedResponse({ description: 'Invitation and its one-time token' })
  @ApiConflictResponse({ description: 'The person is already a member' })
  @ApiForbiddenResponse({
    description: 'The role cannot be granted by the current user',
  })
  invite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreateInvitationResult> {
    return this.members.invite(user.organizationId, user.sub, dto);
  }

  @Patch('members/:id')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Update a member',
    description:
      'Changes the role and/or suspends/reactivates. Suspension revokes the member’s sessions.',
  })
  @ApiOkResponse({ description: 'Updated member' })
  @ApiForbiddenResponse({
    description: 'Self-change, owner protection or privilege escalation',
  })
  @ApiNotFoundResponse({ description: 'Member not found' })
  updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberDto> {
    return this.members.update(user.organizationId, user.sub, id, dto);
  }

  @Delete('members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({
    summary: 'Remove a member',
    description: 'Removes the membership and revokes the member’s sessions.',
  })
  @ApiNoContentResponse({ description: 'Member removed' })
  @ApiForbiddenResponse({ description: 'Self-removal or owner protection' })
  @ApiNotFoundResponse({ description: 'Member not found' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.members.remove(user.organizationId, user.sub, id);
  }

  @Get('invitations')
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'Pending invitations' })
  @ApiOkResponse({ description: 'List of pending invitations' })
  listInvitations(@CurrentUser() user: JwtPayload): Promise<InvitationDto[]> {
    return this.members.listInvitations(user.organizationId);
  }

  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.MEMBERS_MANAGE)
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiNoContentResponse({ description: 'Invitation revoked' })
  @ApiNotFoundResponse({ description: 'Pending invitation not found' })
  revokeInvitation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.members.revokeInvitation(user.organizationId, id);
  }
}
