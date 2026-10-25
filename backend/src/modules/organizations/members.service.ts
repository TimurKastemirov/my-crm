import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  OrganizationMemberStatus,
  type CreateInvitationResult,
  type InvitationDto,
  type MemberDto,
  type RoleRef,
} from '@crm/shared';
import { RolesService } from '../rbac/roles.service.js';
import { UserRoleEntity } from '../rbac/entities/user-role.entity.js';
import { UserEntity } from '../users/entities/user.entity.js';
import { RefreshTokenEntity } from '../auth/entities/refresh-token.entity.js';
import { OrganizationMemberEntity } from './entities/organization-member.entity.js';
import { OrganizationInvitationEntity } from './entities/organization-invitation.entity.js';
import {
  hashInvitationToken,
  INVITATION_TTL_MS,
  newInvitationToken,
} from './invitation-token.js';
import { memberChangeDenial, roleAssignmentDenial } from './member-policy.js';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../../common/db-errors.js';
import {
  CreateInvitationDto,
  UpdateMemberDto,
} from './dto/organization.dto.js';

/** Members and invitations of the current organization. Every method is scoped by organizationId. */
@Injectable()
export class MembersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly roles: RolesService,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    @InjectRepository(OrganizationInvitationEntity)
    private readonly invitationRepo: Repository<OrganizationInvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** All members (a team is small, so the list is not paginated). */
  async list(organizationId: string): Promise<MemberDto[]> {
    const members = await this.memberRepo.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
    return this.toMemberDtos(organizationId, members);
  }

  /** Roles the actor is allowed to grant (no privilege escalation). */
  async assignableRoles(
    organizationId: string,
    actorId: string,
  ): Promise<RoleRef[]> {
    const { permissions, isOwner } = await this.actor(organizationId, actorId);
    const roles = await this.roles.listRoles(organizationId);
    return roles
      .filter((r) => roleAssignmentDenial(permissions, isOwner, r) === null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        isSystem: r.isSystem,
      }));
  }

  /** Creates an invitation; a pending invitation for the same email is replaced. */
  async invite(
    organizationId: string,
    actorId: string,
    dto: CreateInvitationDto,
  ): Promise<CreateInvitationResult> {
    const email = dto.email.trim().toLowerCase();
    const role = await this.assignableRole(organizationId, actorId, dto.roleId);

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (
      existingUser &&
      (await this.memberRepo.exists({
        where: { organizationId, userId: existingUser.id },
      }))
    ) {
      throw new ConflictException(
        'This person is already a member of the organization',
      );
    }

    const token = newInvitationToken();
    const invitation = await this.dataSource
      .transaction(async (manager) => {
        const repo = manager.getRepository(OrganizationInvitationEntity);
        await repo.update(
          { organizationId, email, acceptedAt: IsNull(), revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return repo.save(
          repo.create({
            organizationId,
            email,
            roleId: role.id,
            tokenHash: hashInvitationToken(token),
            invitedById: actorId,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          }),
        );
      })
      .catch((error: unknown) => {
        // A concurrent invitation for the same email won the partial unique index.
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'The role was just deleted; pick another one',
          );
        }
        if (isUniqueViolation(error)) {
          throw new ConflictException(
            'An invitation for this email is being created right now; try again',
          );
        }
        throw error;
      });
    return { invitation: this.toInvitationDto(invitation, role), token };
  }

  /** Pending (not accepted, not revoked, not expired) invitations. */
  async listInvitations(organizationId: string): Promise<InvitationDto[]> {
    const invitations = await this.invitationRepo.find({
      where: {
        organizationId,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
    const roles = await this.roles.listRoles(organizationId);
    const roleById = new Map(roles.map((r) => [r.id, r]));
    return invitations.flatMap((inv) => {
      const role = roleById.get(inv.roleId);
      return role ? [this.toInvitationDto(inv, role)] : [];
    });
  }

  async revokeInvitation(organizationId: string, id: string): Promise<void> {
    const result = await this.invitationRepo.update(
      { id, organizationId, acceptedAt: IsNull(), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) {
      throw new NotFoundException('Invitation not found');
    }
  }

  /** Changes the member's role and/or status (active ↔ suspended). */
  async update(
    organizationId: string,
    actorId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberDto> {
    if (dto.roleId === undefined && dto.status === undefined) {
      throw new BadRequestException(
        'Nothing to update: pass roleId and/or status',
      );
    }
    const member = await this.mustFindMember(organizationId, memberId);
    await this.assertCanChange(organizationId, actorId, member.userId);
    const role =
      dto.roleId !== undefined
        ? await this.assignableRole(organizationId, actorId, dto.roleId)
        : null;

    await this.dataSource
      .transaction(async (manager) => {
        if (role) {
          await this.roles.setUserRole(
            manager,
            organizationId,
            member.userId,
            role.id,
          );
        }
        if (dto.status !== undefined && dto.status !== member.status) {
          member.status = dto.status;
          await manager.getRepository(OrganizationMemberEntity).save(member);
          if (dto.status === OrganizationMemberStatus.Suspended) {
            await this.revokeSessions(manager, organizationId, member.userId);
            await this.revokeInvitationsBy(
              manager,
              organizationId,
              member.userId,
            );
          }
        }
      })
      .catch((error: unknown) => {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException(
            'The role was just deleted; pick another one',
          );
        }
        throw error;
      });
    await this.roles.invalidateUserPermissions(organizationId, member.userId);

    const [updated] = await this.toMemberDtos(organizationId, [member]);
    return updated;
  }

  /** Removes the member from the organization (the user account itself stays). */
  async remove(
    organizationId: string,
    actorId: string,
    memberId: string,
  ): Promise<void> {
    const member = await this.mustFindMember(organizationId, memberId);
    await this.assertCanChange(organizationId, actorId, member.userId);

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(UserRoleEntity)
        .delete({ organizationId, userId: member.userId });
      await manager
        .getRepository(OrganizationMemberEntity)
        .delete({ id: member.id });
      await this.revokeSessions(manager, organizationId, member.userId);
      await this.revokeInvitationsBy(manager, organizationId, member.userId);
    });
    await this.roles.invalidateUserPermissions(organizationId, member.userId);
  }

  // ---------- helpers ----------

  private async actor(
    organizationId: string,
    actorId: string,
  ): Promise<{ permissions: string[]; isOwner: boolean }> {
    const [permissions, isOwner] = await Promise.all([
      this.roles.getUserPermissionCodes(actorId, organizationId),
      this.roles.isOwner(organizationId, actorId),
    ]);
    return { permissions, isOwner };
  }

  /** The role must exist in this organization and be grantable by the actor. */
  private async assignableRole(
    organizationId: string,
    actorId: string,
    roleId: string,
  ) {
    const role = await this.roles.findRole(organizationId, roleId);
    if (!role) {
      throw new BadRequestException('Role not found in the organization');
    }
    const { permissions, isOwner } = await this.actor(organizationId, actorId);
    const denial = roleAssignmentDenial(permissions, isOwner, role);
    if (denial) {
      throw new ForbiddenException(denial);
    }
    return role;
  }

  private async assertCanChange(
    organizationId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    const [actor, targetIsOwner, targetPermissions] = await Promise.all([
      this.actor(organizationId, actorId),
      this.roles.isOwner(organizationId, targetUserId),
      this.roles.rolePermissionCodes(organizationId, targetUserId),
    ]);
    const denial = memberChangeDenial({
      actorUserId: actorId,
      actorIsOwner: actor.isOwner,
      actorPermissions: actor.permissions,
      targetUserId,
      targetIsOwner,
      targetPermissions,
    });
    if (denial) {
      throw new ForbiddenException(denial);
    }
  }

  /** Revokes the user's refresh tokens for this organization (access tokens lose permissions via the guard). */
  private async revokeSessions(
    manager: EntityManager,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await manager
      .getRepository(RefreshTokenEntity)
      .update(
        { organizationId, userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
  }

  /**
   * Revokes pending invitations created by the member: a suspended/removed inviter's links must not
   * keep granting access. (Accepting also re-checks that the inviter may still grant the role.)
   */
  private async revokeInvitationsBy(
    manager: EntityManager,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await manager.getRepository(OrganizationInvitationEntity).update(
      {
        organizationId,
        invitedById: userId,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
      },
      { revokedAt: new Date() },
    );
  }

  private async mustFindMember(
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMemberEntity> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private async toMemberDtos(
    organizationId: string,
    members: OrganizationMemberEntity[],
  ): Promise<MemberDto[]> {
    const userIds = members.map((m) => m.userId);
    const [users, roles] = await Promise.all([
      userIds.length ? this.userRepo.findBy(userIds.map((id) => ({ id }))) : [],
      this.roles.rolesByUser(organizationId, userIds),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    return members.flatMap((m) => {
      const user = userById.get(m.userId);
      if (!user) return [];
      return [
        {
          id: m.id,
          organizationId: m.organizationId,
          userId: m.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: m.status,
          role: roles.get(m.userId) ?? null,
          joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        },
      ];
    });
  }

  private toInvitationDto(
    inv: OrganizationInvitationEntity,
    role: { id: string; name: string; code: string; isSystem: boolean },
  ): InvitationDto {
    return {
      id: inv.id,
      organizationId: inv.organizationId,
      email: inv.email,
      role: {
        id: role.id,
        name: role.name,
        code: role.code,
        isSystem: role.isSystem,
      },
      invitedById: inv.invitedById,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    };
  }
}
