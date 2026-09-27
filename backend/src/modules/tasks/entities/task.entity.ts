import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskPriority, TaskStatus } from '@crm/shared';

@Entity('tasks')
@Index('idx_tasks_org_assignee_status', ['organizationId', 'assigneeId', 'status'])
@Index('idx_tasks_org_due', ['organizationId', 'dueAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16, default: TaskStatus.Open })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 8, default: TaskPriority.Normal })
  priority!: TaskPriority;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
