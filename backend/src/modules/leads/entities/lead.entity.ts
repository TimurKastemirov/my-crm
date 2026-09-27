import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeadStatus } from '@crm/shared';

@Entity('leads')
@Index('idx_leads_org_owner', ['organizationId', 'ownerId'])
@Index('idx_leads_org_status', ['organizationId', 'status'])
export class LeadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  source!: string | null;

  @Column({ type: 'varchar', length: 16, default: LeadStatus.New })
  status!: LeadStatus;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  // numeric хранится как строка (точность); null — если не задано.
  @Column({ name: 'estimated_value', type: 'numeric', precision: 18, scale: 2, nullable: true })
  estimatedValue!: string | null;

  @Column({ type: 'char', length: 3, nullable: true })
  currency!: string | null;

  // FK на deals появится вместе с модулем Deals.
  @Column({ name: 'converted_deal_id', type: 'uuid', nullable: true })
  convertedDealId!: string | null;

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
