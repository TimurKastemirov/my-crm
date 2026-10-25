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
} from '@crm/shared';
import { RedisService } from '../../config/redis/redis.service.js';
import { PermissionEntity } from './entities/permission.entity.js';
import { RoleEntity } from './entities/role.entity.js';
import { RolePermissionEntity } from './entities/role-permission.entity.js';
import { UserRoleEntity } from './entities/user-role.entity.js';
import { SYSTEM_ROLE_NAMES, SYSTEM_ROLE_PERMISSIONS } from './system-roles.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

const PERMISSION_CACHE_TTL_SECONDS = 300;

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

  async createRole(
    organizationId: string,
    dto: CreateRoleDto,
  ): Promise<RoleDto> {
    const permissions = await this.resolvePermissions(dto.permissions);
    const exists = await this.roleRepo.findOne({
      where: { organizationId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException(
        `A role with the code "${dto.code}" already exists`,
      );
    }
    const role = await this.roleRepo.save(
      this.roleRepo.create({
        organizationId,
        name: dto.name,
        code: dto.code,
        description: dto.description ?? null,
        isSystem: false,
      }),
    );
    if (permissions.length) {
      await this.rolePermRepo.insert(
        permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      );
    }
    return this.toRoleDto(
      role,
      permissions.map((p) => p.code),
    );
  }

  async updateRole(
    organizationId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    const role = await this.roleRepo.findOne({ where: { id, organizationId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenException('A system role cannot be modified');
    }
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    await this.roleRepo.save(role);

    let codes: string[];
    if (dto.permissions) {
      const permissions = await this.resolvePermissions(dto.permissions);
      await this.rolePermRepo.delete({ roleId: role.id });
      if (permissions.length) {
        await this.rolePermRepo.insert(
          permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        );
      }
      codes = permissions.map((p) => p.code);
    } else {
      codes = await this.permissionCodesForRole(role.id);
    }
    // Role permissions changed — user caches will refresh via TTL (see PERMISSION_CACHE_TTL_SECONDS).
    return this.toRoleDto(role, codes);
  }

  async deleteRole(organizationId: string, id: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id, organizationId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.isSystem) {
      throw new ForbiddenException('A system role cannot be deleted');
    }
    // FK ON DELETE CASCADE will remove role_permissions and user_roles.
    await this.roleRepo.delete({ id: role.id });
  }

  // ---------- helpers ----------

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

  private async permissionCodesForRole(roleId: string): Promise<string[]> {
    const rows: Array<{ code: string }> = await this.dataSource.query(
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
