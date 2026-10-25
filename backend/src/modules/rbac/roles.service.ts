import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  OrganizationMemberStatus,
  redisKeys,
  SystemRole,
  type Permission,
  type RoleDto,
  type RoleRef,
  type RoleSummaryDto,
} from '@crm/shared';
import { RedisService } from '../../config/redis/redis.service.js';
import { PermissionEntity } from './entities/permission.entity.js';
import { RoleEntity } from './entities/role.entity.js';
import { RolePermissionEntity } from './entities/role-permission.entity.js';
import { UserRoleEntity } from './entities/user-role.entity.js';
import { SYSTEM_ROLE_NAMES, SYSTEM_ROLE_PERMISSIONS } from './system-roles.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { roleCodeFromName } from './role-code.js';
import { grantDenial, roleChangeDenial } from './role-policy.js';
import { isUniqueViolation } from '../../common/db-errors.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

const PERMISSION_CACHE_TTL_SECONDS = 300;
const NO_USAGE = { memberCount: 0, invitationCount: 0 };

@Injectable()
export class RolesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Provisioning for a new organization: creates system roles with their permissions and
   * assigns the owner. Called inside the registration transaction (shared EntityManager).
   */
  async provisionOrganization(
    manager: EntityManager,
    organizationId: string,
    ownerUserId: string,
  ): Promise<void> {
    const permissions = await manager.getRepository(PermissionEntity).find();
    const idByCode = new Map(permissions.map((p) => [p.code, p.id]));
    const roleRepo = manager.getRepository(RoleEntity);
    const rolePermRepo = manager.getRepository(RolePermissionEntity);

    let ownerRoleId: string | null = null;
    for (const code of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRole[]) {
      const role = await roleRepo.save(
        roleRepo.create({
          organizationId,
          code,
          name: SYSTEM_ROLE_NAMES[code],
          isSystem: true,
        }),
      );
      const rows = SYSTEM_ROLE_PERMISSIONS[code]
        .map((c) => idByCode.get(c))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));
      if (rows.length) {
        await rolePermRepo.insert(rows);
      }
      if (code === SystemRole.Owner) {
        ownerRoleId = role.id;
      }
    }

    if (ownerRoleId) {
      await manager
        .getRepository(UserRoleEntity)
        .insert({ userId: ownerUserId, roleId: ownerRoleId, organizationId });
    }
  }

  /**
   * Aggregated permission codes of a user in an organization (cached in Redis).
   * Only an ACTIVE membership grants permissions: a suspended or removed member gets none.
   */
  async getUserPermissionCodes(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    const key = redisKeys.userPermissions(organizationId, userId);
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        // corrupted cache — recompute below
      }
    }

    const rows: Array<{ code: string }> = await this.dataSource.query(
      `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN organization_members om
           ON om.user_id = ur.user_id
          AND om.organization_id = ur.organization_id
          AND om.status = $3
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1 AND ur.organization_id = $2`,
      [userId, organizationId, OrganizationMemberStatus.Active],
    );
    const codes = rows.map((r) => r.code);
    await this.redis.set(
      key,
      JSON.stringify(codes),
      PERMISSION_CACHE_TTL_SECONDS,
    );
    return codes;
  }

  /** Drops the cached permissions so a role/status change takes effect on the next request. */
  async invalidateUserPermissions(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.redis.del(redisKeys.userPermissions(organizationId, userId));
  }

  /** Replaces the user's role in the organization (a member has exactly one role). */
  async setUserRole(
    manager: EntityManager,
    organizationId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    const repo = manager.getRepository(UserRoleEntity);
    await repo.delete({ organizationId, userId });
    await repo.insert({ organizationId, userId, roleId });
  }

  /** A role of the organization with its permission codes, or null if it doesn't exist there. */
  async findRole(
    organizationId: string,
    roleId: string,
  ): Promise<RoleDto | null> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, organizationId },
    });
    if (!role) {
      return null;
    }
    return this.toRoleDto(role, await this.permissionCodesForRole(role.id));
  }

  /** userId → role for the given users of the organization (first role if several). */
  async rolesByUser(
    organizationId: string,
    userIds: string[],
  ): Promise<Map<string, RoleRef>> {
    const result = new Map<string, RoleRef>();
    if (userIds.length === 0) {
      return result;
    }
    const rows: Array<{
      user_id: string;
      id: string;
      name: string;
      code: string;
      is_system: boolean;
    }> = await this.dataSource.query(
      `SELECT ur.user_id, r.id, r.name, r.code, r.is_system
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.organization_id = $1 AND ur.user_id = ANY($2)
        ORDER BY r.is_system DESC, r.name ASC`,
      [organizationId, userIds],
    );
    for (const row of rows) {
      if (!result.has(row.user_id)) {
        result.set(row.user_id, {
          id: row.id,
          name: row.name,
          code: row.code,
          isSystem: row.is_system,
        });
      }
    }
    return result;
  }

  /** Whether the user holds the system owner role in the organization. */
  /** Permission codes of the user's roles in the organization, regardless of membership status. */
  async rolePermissionCodes(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const rows: Array<{ code: string }> = await this.dataSource.query(
      `SELECT DISTINCT p.code
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.organization_id = $1 AND ur.user_id = $2`,
      [organizationId, userId],
    );
    return rows.map((r) => r.code);
  }

  async isOwner(organizationId: string, userId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.organization_id = $1 AND ur.user_id = $2
          AND r.is_system = true AND r.code = $3
        LIMIT 1`,
      [organizationId, userId, SystemRole.Owner],
    );
    return rows.length > 0;
  }

  async listRoles(organizationId: string): Promise<RoleDto[]> {
    const roles = await this.roleRepo.find({
      where: { organizationId },
      order: { isSystem: 'DESC', name: 'ASC' },
    });
    if (roles.length === 0) {
      return [];
    }
    const rows: Array<{ role_id: string; code: string }> =
      await this.dataSource.query(
        `SELECT rp.role_id, p.code
           FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ANY($1)`,
        [roles.map((r) => r.id)],
      );
    const byRole = new Map<string, string[]>();
    for (const row of rows) {
      const list = byRole.get(row.role_id) ?? [];
      list.push(row.code);
      byRole.set(row.role_id, list);
    }
    return roles.map((r) => this.toRoleDto(r, byRole.get(r.id) ?? []));
  }

  /** Roles with their usage counts — for the roles screen. */
  async listRoleSummaries(
    organizationId: string,
    actorId: string,
  ): Promise<RoleSummaryDto[]> {
    const [roles, mine] = await Promise.all([
      this.listRoles(organizationId),
      this.userRoleRepo().find({ where: { organizationId, userId: actorId } }),
    ]);
    const usage = await this.usageCounts(organizationId, roles.map((r) => r.id));
    const mineIds = new Set(mine.map((r) => r.roleId));
    return roles.map((r) => ({
      ...r,
      ...(usage.get(r.id) ?? NO_USAGE),
      assignedToMe: mineIds.has(r.id),
    }));
  }

  async createRole(
    organizationId: string,
    actorId: string,
    dto: CreateRoleDto,
  ): Promise<RoleSummaryDto> {
    const permissions = await this.resolvePermissions(dto.permissions);
    const actorPermissions = await this.getUserPermissionCodes(actorId, organizationId);
    this.deny(grantDenial(actorPermissions, permissions.map((p) => p.code)));

    // A concurrent create can take the same generated code: re-read and retry a few times.
    let role: RoleEntity | null = null;
    for (let attempt = 0; !role; attempt++) {
      const taken = new Set(
        (await this.roleRepo.find({ where: { organizationId }, select: { code: true } })).map(
          (r) => r.code,
        ),
      );
      if (dto.code && taken.has(dto.code)) {
        throw new ConflictException(`A role with the code "${dto.code}" already exists`);
      }
      const code = dto.code ?? roleCodeFromName(dto.name, taken);
      try {
        role = await this.insertRole(organizationId, code, dto, permissions);
      } catch (error) {
        if (!isUniqueViolation(error) || dto.code || attempt >= 2) {
          if (isUniqueViolation(error)) {
            throw new ConflictException('A role with this code was just created; try again');
          }
          throw error;
        }
      }
    }
    return {
      ...this.toRoleDto(role, permissions.map((p) => p.code)),
      ...NO_USAGE,
      assignedToMe: false,
    };
  }

  async updateRole(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<RoleSummaryDto> {
    const permissions = dto.permissions ? await this.resolvePermissions(dto.permissions) : null;

    // Checks and the write share one transaction with the role row locked, so a concurrent edit
    // can't be lost and the checks see the permissions that are actually replaced.
    const { role, codes } = await this.dataSource.transaction(async (manager) => {
      const role = await this.lockEditableRole(manager, organizationId, id, 'modified');
      const current = await this.permissionCodesForRole(role.id, manager);
      await this.assertCanChange(organizationId, actorId, role.id, current);
      if (permissions) {
        const actorPermissions = await this.getUserPermissionCodes(actorId, organizationId);
        this.deny(grantDenial(actorPermissions, permissions.map((p) => p.code)));
      }
      if (dto.name !== undefined) role.name = dto.name;
      if (dto.description !== undefined) role.description = dto.description?.trim() || null;

      await manager.getRepository(RoleEntity).save(role);
      if (permissions) {
        const rolePermRepo = manager.getRepository(RolePermissionEntity);
        await rolePermRepo.delete({ roleId: role.id });
        if (permissions.length) {
          await rolePermRepo.insert(
            permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
          );
        }
      }
      return { role, codes: permissions ? permissions.map((p) => p.code) : current };
    });
    if (permissions) {
      // Holders of the role get the new permissions on their very next request.
      await this.invalidateRoleHolders(organizationId, role.id);
    }
    const usage = await this.usageCounts(organizationId, [role.id]);
    return {
      ...this.toRoleDto(role, codes),
      ...(usage.get(role.id) ?? NO_USAGE),
      // Editing your own role is forbidden above.
      assignedToMe: false,
    };
  }

  /** Deletes an unused custom role; a role assigned to members or pending invitations is kept (409). */
  async deleteRole(organizationId: string, actorId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // The row lock makes a concurrent assignment/invitation (FK check on the role) either commit
      // first — and be counted below — or wait and then fail, instead of being cascaded away.
      const role = await this.lockEditableRole(manager, organizationId, id, 'deleted');
      await this.assertCanChange(
        organizationId,
        actorId,
        role.id,
        await this.permissionCodesForRole(role.id, manager),
      );
      const { memberCount, invitationCount } =
        (await this.usageCounts(organizationId, [role.id], manager)).get(role.id) ?? NO_USAGE;
      if (memberCount || invitationCount) {
        throw new ConflictException(
          `The role is in use (${memberCount} member(s), ${invitationCount} pending invitation(s)); reassign them first`,
        );
      }
      // FK ON DELETE CASCADE removes role_permissions and expired/used invitations.
      await manager.getRepository(RoleEntity).delete({ id: role.id });
    });
  }

  // ---------- helpers ----------

  private insertRole(
    organizationId: string,
    code: string,
    dto: CreateRoleDto,
    permissions: PermissionEntity[],
  ): Promise<RoleEntity> {
    return this.dataSource.transaction(async (manager) => {
      const roleRepo = manager.getRepository(RoleEntity);
      const saved = await roleRepo.save(
        roleRepo.create({
          organizationId,
          name: dto.name,
          code,
          description: dto.description?.trim() || null,
          isSystem: false,
        }),
      );
      if (permissions.length) {
        await manager
          .getRepository(RolePermissionEntity)
          .insert(permissions.map((p) => ({ roleId: saved.id, permissionId: p.id })));
      }
      return saved;
    });
  }

  private deny(reason: string | null): void {
    if (reason) throw new ForbiddenException(reason);
  }

  private async lockEditableRole(
    manager: EntityManager,
    organizationId: string,
    id: string,
    action: 'modified' | 'deleted',
  ): Promise<RoleEntity> {
    const role = await manager.getRepository(RoleEntity).findOne({
      where: { id, organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenException(`A system role cannot be ${action}`);
    }
    return role;
  }

  private async assertCanChange(
    organizationId: string,
    actorId: string,
    roleId: string,
    rolePermissions: string[],
  ): Promise<void> {
    const [actorPermissions, actorRoles] = await Promise.all([
      this.getUserPermissionCodes(actorId, organizationId),
      this.userRoleRepo().find({ where: { organizationId, userId: actorId } }),
    ]);
    this.deny(
      roleChangeDenial({
        actorPermissions,
        actorRoleIds: actorRoles.map((r) => r.roleId),
        role: { id: roleId, permissions: rolePermissions },
      }),
    );
  }

  private userRoleRepo(): Repository<UserRoleEntity> {
    return this.dataSource.getRepository(UserRoleEntity);
  }

  private async invalidateRoleHolders(organizationId: string, roleId: string): Promise<void> {
    const holders = await this.userRoleRepo().find({ where: { organizationId, roleId } });
    await Promise.all(
      holders.map((h) => this.invalidateUserPermissions(organizationId, h.userId)),
    );
  }

  /** roleId → members holding it and pending invitations granting it. */
  private async usageCounts(
    organizationId: string,
    roleIds: string[],
    runner: Pick<EntityManager, 'query'> = this.dataSource,
  ): Promise<Map<string, { memberCount: number; invitationCount: number }>> {
    const result = new Map<string, { memberCount: number; invitationCount: number }>();
    if (roleIds.length === 0) return result;
    const rows: Array<{ role_id: string; members: string; invitations: string }> =
      await runner.query(
        `SELECT r.id AS role_id,
                (SELECT count(*) FROM user_roles ur
                  WHERE ur.role_id = r.id AND ur.organization_id = $1) AS members,
                (SELECT count(*) FROM organization_invitations i
                  WHERE i.role_id = r.id AND i.organization_id = $1
                    AND i.accepted_at IS NULL AND i.revoked_at IS NULL
                    AND i.expires_at > now()) AS invitations
           FROM roles r
          WHERE r.id = ANY($2) AND r.organization_id = $1`,
        [organizationId, roleIds],
      );
    for (const row of rows) {
      result.set(row.role_id, {
        memberCount: Number(row.members),
        invitationCount: Number(row.invitations),
      });
    }
    return result;
  }

  private async resolvePermissions(
    codes: string[],
  ): Promise<PermissionEntity[]> {
    const unique = [...new Set(codes)];
    if (unique.length === 0) {
      return [];
    }
    const permissions = await this.permissionRepo.find({
      where: { code: In(unique) },
    });
    if (permissions.length !== unique.length) {
      const found = new Set(permissions.map((p) => p.code));
      const unknown = unique.filter((c) => !found.has(c));
      throw new BadRequestException(
        `Unknown permission codes: ${unknown.join(', ')}`,
      );
    }
    return permissions;
  }

  private async permissionCodesForRole(
    roleId: string,
    runner: Pick<EntityManager, 'query'> = this.dataSource,
  ): Promise<string[]> {
    const rows: Array<{ code: string }> = await runner.query(
      `SELECT p.code FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1`,
      [roleId],
    );
    return rows.map((r) => r.code);
  }

  private toRoleDto(role: RoleEntity, permissions: string[]): RoleDto {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      isSystem: role.isSystem,
      description: role.description,
      permissions: permissions as Permission[],
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }
}
