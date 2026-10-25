import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AUDIT_ACTIONS,
  OrganizationMemberStatus,
  PERMISSIONS,
  type AppLocale,
  type AuthResult,
  type AuthTokens,
  type InvitationPreview,
  type JwtPayload,
  type Permission,
  type SessionInfo,
  type UserDto,
} from '@crm/shared';
import { UserEntity } from '../users/entities/user.entity.js';
import { OrganizationEntity } from '../organizations/entities/organization.entity.js';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity.js';
import { OrganizationInvitationEntity } from '../organizations/entities/organization-invitation.entity.js';
import {
  hashInvitationToken,
  isInvitationPending,
} from '../organizations/invitation-token.js';
import { RoleEntity } from '../rbac/entities/role.entity.js';
import { SessionVersionService } from '../security/session-version.service.js';
import { AuditService } from '../audit/audit.service.js';
import { roleAssignmentDenial } from '../organizations/member-policy.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/db-errors.js';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { UsersService } from '../users/users.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { RolesService } from '../rbac/roles.service.js';
import { PipelinesService } from '../deals/pipelines.service.js';
import { parseDurationToMs } from './auth.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

/** Failed sign-ins of one account are recorded at most once per organization in this window. */
const FAILED_LOGIN_AUDIT_WINDOW_MS = 60_000;

interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionVersionService,
    private readonly config: ConfigService,
    private readonly rolesService: RolesService,
    private readonly pipelinesService: PipelinesService,
    private readonly audit: AuditService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,
  ) {}

  /** Registration: creates a user + organization + membership (owner) atomically. */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await argonHash(dto.password);

    const { user, organizationId } = await this.dataSource.transaction(
      async (manager) => {
        const userRepo = manager.getRepository(UserEntity);
        const orgRepo = manager.getRepository(OrganizationEntity);
        const memberRepo = manager.getRepository(OrganizationMemberEntity);

        const createdUser = await userRepo.save(
          userRepo.create({
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            ...(dto.locale ? { locale: dto.locale } : {}),
          }),
        );

        const slug = await this.uniqueSlug(
          orgRepo,
          OrganizationsService.slugify(dto.organizationName),
        );
        const org = await orgRepo.save(
          orgRepo.create({ name: dto.organizationName.trim(), slug }),
        );

        await memberRepo.save(
          memberRepo.create({
            organizationId: org.id,
            userId: createdUser.id,
            status: OrganizationMemberStatus.Active,
            joinedAt: new Date(),
          }),
        );

        // Organization's system roles + owner assignment (within the same transaction).
        await this.rolesService.provisionOrganization(manager, org.id, createdUser.id);
        // Default sales pipeline with stages.
        await this.pipelinesService.provisionDefault(manager, org.id);
        await this.audit.record(
          {
            organizationId: org.id,
            action: AUDIT_ACTIONS.AuthRegister,
            actorId: createdUser.id,
            entityType: 'organization',
            entityId: org.id,
            after: { organization: org.name, email: createdUser.email },
          },
          manager,
        );

        return { user: createdUser, organizationId: org.id };
      },
    );

    const tokens = await this.issueTokens(user, organizationId, randomUUID(), meta);
    return { user: this.toUserDto(user), tokens };
  }

  /** Login by email + password. The active organization is the first active membership. */
  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Unknown email: nothing to attribute an audit entry to.
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      await this.recordFailedLogin(user, 'account_inactive');
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordOk = await argonVerify(user.passwordHash, dto.password);
    if (!passwordOk) {
      await this.recordFailedLogin(user, 'invalid_password');
      throw new UnauthorizedException('Invalid email or password');
    }

    const organizationId = await this.primaryOrganizationId(user.id);
    if (!organizationId) {
      await this.recordFailedLogin(user, 'no_active_membership');
      throw new UnauthorizedException('The user has no active organization');
    }

    await this.applyChosenLocale(user, dto.locale);
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, organizationId, randomUUID(), meta);
    await this.audit.recordBestEffort([
      {
        organizationId,
        action: AUDIT_ACTIONS.AuthLogin,
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
      },
    ]);
    return { user: this.toUserDto(user), tokens };
  }

  /** Refresh token rotation with reuse detection. */
  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.refreshRepo.findOne({ where: { tokenHash } });
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse of an already revoked token → compromise: revoke the entire family.
    if (record.revokedAt) {
      await this.refreshRepo.update(
        { familyId: record.familyId },
        { revokedAt: new Date() },
      );
      await this.audit.recordBestEffort([
        {
          organizationId: record.organizationId,
          action: AUDIT_ACTIONS.AuthTokenReuse,
          actorId: record.userId,
          entityType: 'user',
          entityId: record.userId,
        },
      ]);
      throw new UnauthorizedException('Token reuse detected');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is unavailable');
    }
    if (!(await this.isActiveMember(user.id, record.organizationId))) {
      throw new UnauthorizedException('Organization membership is not active');
    }

    // Rotation: revoke the current token and issue a new one in the same family. Conditional, so
    // two simultaneous refreshes with one token can't both succeed and fork the family.
    const rotated = await this.refreshRepo.update(
      { id: record.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!rotated.affected) {
      throw new UnauthorizedException('Refresh token already used');
    }
    return this.issueTokens(user, record.organizationId, record.familyId, meta);
  }

  /** Logout: revoke a specific refresh token. */
  async logout(rawToken: string): Promise<void> {
    await this.refreshRepo.update(
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Changes the password after verifying the current one, ends every session (all refresh tokens)
   * and returns a fresh token pair so the current session continues.
   * A wrong current password is a 400 (not 401): the client must not treat it as an expired session.
   */
  async changePassword(
    payload: JwtPayload,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is unavailable');
    }
    if (!(await argonVerify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('The current password is incorrect');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('The new password must differ from the current one');
    }
    // Same rule as refresh: no new session for an organization the user no longer belongs to.
    if (!(await this.isActiveMember(user.id, payload.organizationId))) {
      throw new UnauthorizedException('Organization membership is not active');
    }

    const passwordHash = await argonHash(dto.newPassword);
    // One transaction: new password, a new session for this device, every other session revoked.
    const tokens = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(UserEntity).update({ id: user.id }, { passwordHash });
      // Every access token issued before stops working; this session gets the new version.
      user.sessionVersion = await this.sessions.bump(manager, user.id);
      const familyId = randomUUID();
      const tokens = await this.issueTokens(
        user,
        payload.organizationId,
        familyId,
        meta,
        manager.getRepository(RefreshTokenEntity),
      );
      await manager.getRepository(RefreshTokenEntity).update(
        { userId: user.id, revokedAt: IsNull(), familyId: Not(familyId) },
        { revokedAt: new Date() },
      );
      await this.audit.record(
        {
          organizationId: payload.organizationId,
          action: AUDIT_ACTIONS.AuthPasswordChanged,
          actorId: user.id,
          entityType: 'user',
          entityId: user.id,
        },
        manager,
      );
      return tokens;
    });
    await this.sessions.publish(user.id, user.sessionVersion);
    return tokens;
  }

  /** Logout from all devices: revoke all of the user's active tokens. */
  async logoutAll(userId: string, organizationId?: string): Promise<void> {
    // Refresh tokens are revoked and the session version bumped, so access tokens die too.
    const version = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(RefreshTokenEntity)
        .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      return this.sessions.bump(manager, userId);
    });
    await this.sessions.publish(userId, version);
    if (organizationId) {
      await this.audit.recordBestEffort([
        {
          organizationId,
          action: AUDIT_ACTIONS.AuthLogoutAll,
          actorId: userId,
          entityType: 'user',
          entityId: userId,
        },
      ]);
    }
  }

  /** Current session. */
  async me(payload: JwtPayload): Promise<SessionInfo> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const permissions = await this.rolesService.getUserPermissionCodes(
      user.id,
      payload.organizationId,
    );
    return {
      user: this.toUserDto(user),
      organizationId: payload.organizationId,
      permissions: permissions as Permission[],
    };
  }

  /** What the invitee sees before accepting (the token itself is the credential). */
  async previewInvitation(rawToken: string): Promise<InvitationPreview> {
    const invitation = await this.pendingInvitation(rawToken);
    const [org, role, user] = await Promise.all([
      this.dataSource
        .getRepository(OrganizationEntity)
        .findOneOrFail({ where: { id: invitation.organizationId } }),
      this.dataSource
        .getRepository(RoleEntity)
        .findOneOrFail({ where: { id: invitation.roleId } }),
      this.usersService.findByEmail(invitation.email),
    ]);
    return {
      organizationName: org.name,
      email: invitation.email,
      roleName: role.name,
      userExists: Boolean(user),
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Accepts an invitation: creates the account (or verifies the existing account's password),
   * adds the membership with the invited role and signs in to the inviting organization.
   */
  async acceptInvitation(dto: AcceptInvitationDto, meta: RequestMeta): Promise<AuthResult> {
    const invitation = await this.pendingInvitation(dto.token);

    const existing = await this.usersService.findByEmail(invitation.email);
    let passwordHash: string | null = null;
    if (existing) {
      const passwordOk =
        existing.isActive && (await argonVerify(existing.passwordHash, dto.password));
      if (!passwordOk) {
        throw new UnauthorizedException('Invalid password');
      }
    } else {
      if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
        throw new BadRequestException('firstName and lastName are required for a new account');
      }
      passwordHash = await argonHash(dto.password);
    }

    const user = await this.dataSource.transaction(async (manager) => {
      // Claim the invitation atomically: a concurrent accept of the same token updates 0 rows.
      const claimed = await manager
        .createQueryBuilder()
        .update(OrganizationInvitationEntity)
        .set({ acceptedAt: () => 'now()' })
        .where(
          'id = :id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()',
          { id: invitation.id },
        )
        .execute();
      if (!claimed.affected) {
        throw new BadRequestException('The invitation is invalid or has expired');
      }

      const userRepo = manager.getRepository(UserEntity);
      const member =
        existing ??
        (await userRepo.save(
          userRepo.create({
            email: invitation.email,
            passwordHash: passwordHash as string,
            firstName: (dto.firstName as string).trim(),
            lastName: (dto.lastName as string).trim(),
            ...(dto.locale ? { locale: dto.locale } : {}),
          }),
        ));

      // A language picked before accepting wins for an existing account (saved with the membership).
      if (existing && dto.locale && dto.locale !== existing.locale) {
        await userRepo.update({ id: existing.id }, { locale: dto.locale });
        existing.locale = dto.locale;
      }

      const memberRepo = manager.getRepository(OrganizationMemberEntity);
      if (
        await memberRepo.exists({
          where: { organizationId: invitation.organizationId, userId: member.id },
        })
      ) {
        throw new ConflictException('You are already a member of this organization');
      }
      await memberRepo.save(
        memberRepo.create({
          organizationId: invitation.organizationId,
          userId: member.id,
          status: OrganizationMemberStatus.Active,
          invitedById: invitation.invitedById,
          joinedAt: new Date(),
        }),
      );
      await this.rolesService.setUserRole(
        manager,
        invitation.organizationId,
        member.id,
        invitation.roleId,
      );
      const role = await manager
        .getRepository(RoleEntity)
        .findOne({ where: { id: invitation.roleId } });
      await this.audit.record(
        {
          organizationId: invitation.organizationId,
          action: AUDIT_ACTIONS.MemberJoined,
          actorId: member.id,
          entityType: 'invitation',
          entityId: invitation.id,
          after: { email: member.email, role: role?.name ?? null },
        },
        manager,
      );
      return member;
    }).catch((error: unknown) => {
      // The invited role was deleted meanwhile.
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException('The invitation is no longer valid');
      }
      // A concurrent registration/accept created the same account (unique email) first.
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email was just created; try again');
      }
      throw error;
    });

    await this.rolesService.invalidateUserPermissions(invitation.organizationId, user.id);
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, invitation.organizationId, randomUUID(), meta);
    return { user: this.toUserDto(user), tokens };
  }

  // ---------- helpers ----------

  private async issueTokens(
    user: UserEntity,
    organizationId: string,
    familyId: string,
    meta: RequestMeta,
    refreshRepo: Repository<RefreshTokenEntity> = this.refreshRepo,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      organizationId,
      email: user.email,
      sv: user.sessionVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlMs = parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_TTL', '30d'),
    );
    await refreshRepo.save(
      refreshRepo.create({
        userId: user.id,
        organizationId,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + ttlMs),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** A failed sign-in to an existing account is recorded in every organization the person belongs to. */
  private async recordFailedLogin(user: UserEntity, reason: string): Promise<void> {
    const memberships = await this.dataSource
      .getRepository(OrganizationMemberEntity)
      .find({ where: { userId: user.id } });
    // Anyone who knows the email can trigger this: at most one entry per person and organization
    // per minute, and a failing write never turns the 401 into a 500.
    await this.audit.recordThrottled(
      memberships.map((m) => ({
        organizationId: m.organizationId,
        action: AUDIT_ACTIONS.AuthLoginFailed,
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        after: { reason },
      })),
      FAILED_LOGIN_AUDIT_WINDOW_MS,
    );
  }

  /** A language picked explicitly before signing in wins over the saved one and is stored in the profile. */
  private async applyChosenLocale(
    user: UserEntity,
    locale: AppLocale | undefined,
  ): Promise<void> {
    if (!locale || locale === user.locale) return;
    await this.usersService.updateSettings(user.id, { locale });
    user.locale = locale;
  }

  private async pendingInvitation(rawToken: string): Promise<OrganizationInvitationEntity> {
    const invitation = await this.dataSource
      .getRepository(OrganizationInvitationEntity)
      .findOne({ where: { tokenHash: hashInvitationToken(rawToken) } });
    if (!invitation || !isInvitationPending(invitation, new Date())) {
      throw new BadRequestException('The invitation is invalid or has expired');
    }
    await this.assertInviterCanStillGrant(invitation);
    return invitation;
  }

  /**
   * The link carries the inviter's authority: it stays valid only while the inviter is an active
   * member who may still manage members and grant this role (e.g. not demoted since).
   */
  private async assertInviterCanStillGrant(
    invitation: OrganizationInvitationEntity,
  ): Promise<void> {
    const { organizationId, invitedById, roleId } = invitation;
    const role = await this.rolesService.findRole(organizationId, roleId);
    let allowed = false;
    if (invitedById && role) {
      const [permissions, isOwner] = await Promise.all([
        this.rolesService.getUserPermissionCodes(invitedById, organizationId),
        this.rolesService.isOwner(organizationId, invitedById),
      ]);
      allowed =
        permissions.includes(PERMISSIONS.MEMBERS_MANAGE) &&
        roleAssignmentDenial(permissions, isOwner, role) === null;
    }
    if (!allowed) {
      throw new BadRequestException('The invitation is no longer valid');
    }
  }

  private isActiveMember(userId: string, organizationId: string): Promise<boolean> {
    return this.dataSource.getRepository(OrganizationMemberEntity).exists({
      where: { userId, organizationId, status: OrganizationMemberStatus.Active },
    });
  }

  private async primaryOrganizationId(userId: string): Promise<string | null> {
    const member = await this.dataSource
      .getRepository(OrganizationMemberEntity)
      .findOne({
        where: { userId, status: OrganizationMemberStatus.Active },
        order: { createdAt: 'ASC' },
      });
    return member?.organizationId ?? null;
  }

  private async uniqueSlug(
    orgRepo: Repository<OrganizationEntity>,
    base: string,
  ): Promise<string> {
    let slug = base;
    let suffix = 1;
    while (await orgRepo.findOne({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  private toUserDto(u: UserEntity): UserDto {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      timezone: u.timezone,
      locale: u.locale,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
