import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Assignment of a role to a user within an organization. */
@Entity('user_roles')
export class UserRoleEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @Index('idx_user_roles_org')
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;
}
