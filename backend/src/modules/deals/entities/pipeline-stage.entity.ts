import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pipeline_stages')
@Index('idx_pipeline_stages_org_pipeline', ['organizationId', 'pipelineId'])
export class PipelineStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'pipeline_id', type: 'uuid' })
  pipelineId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'int', default: 0 })
  probability!: number;

  @Column({ name: 'is_won', type: 'boolean', default: false })
  isWon!: boolean;

  @Column({ name: 'is_lost', type: 'boolean', default: false })
  isLost!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
