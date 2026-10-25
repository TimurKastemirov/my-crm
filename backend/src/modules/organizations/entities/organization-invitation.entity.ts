import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One-time invitation to join an organization with a given role. Only the token hash is stored. */
@Entity('organization_invitations')
// At most one pending invitation per email within an organization (mirrors the migration).
@Index('uq_org_invitations_pending', ['organizationId', 'email'], {
  unique: true,
  where: '"accepted_at" IS NULL AND "revoked_at" IS NULL',
})
export class OrganizationInvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  // Stored in lowercase, like users.email.
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @Index('uq_org_invitations_token', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'invited_by_id', type: 'uuid', nullable: true })
  invitedById!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
