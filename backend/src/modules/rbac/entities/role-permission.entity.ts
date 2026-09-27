import { Entity, PrimaryColumn } from 'typeorm';

/** Связь роль ↔ право (many-to-many как явная таблица). */
@Entity('role_permissions')
export class RolePermissionEntity {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;
}
