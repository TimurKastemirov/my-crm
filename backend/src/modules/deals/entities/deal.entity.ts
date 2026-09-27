import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DealStatus } from '@crm/shared';

@Entity('deals')
@Index('idx_deals_org_pipeline_stage', ['organizationId', 'pipelineId', 'stageId'])
@Index('idx_deals_org_owner_status', ['organizationId', 'ownerId', 'status'])
export class DealEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId!: string;

  @Column({ name: 'stage_id', type: 'uuid' })
  stageId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'char', length: 3, nullable: true })
  currency!: string | null;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ type: 'varchar', length: 8, default: DealStatus.Open })
  status!: DealStatus;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate!: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'lost_reason', type: 'varchar', length: 255, nullable: true })
  lostReason!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
