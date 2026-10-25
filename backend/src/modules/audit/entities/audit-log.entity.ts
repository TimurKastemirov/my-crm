import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AuditAction } from '@crm/shared';

/** Append-only audit entry (the table rejects UPDATE/DELETE). */
@Entity('audit_logs')
// Indexes (with DESC order) and the append-only trigger live in the migration; declared here
// unmanaged so `migration:generate` doesn't try to remove or recreate them.
@Index('idx_audit_logs_org_created', { synchronize: false })
@Index('idx_audit_logs_org_action', { synchronize: false })
@Index('idx_audit_logs_org_actor', { synchronize: false })
@Index('idx_audit_logs_org_entity', { synchronize: false })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  action!: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 40, nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
