import { Entity, PrimaryColumn } from 'typeorm';

/** Role ↔ permission link (many-to-many as an explicit table). */
@Entity('role_permissions')
export class RolePermissionEntity {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;
}
