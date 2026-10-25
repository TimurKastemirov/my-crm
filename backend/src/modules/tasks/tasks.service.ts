import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository, IsNull } from 'typeorm';
import {
  AUDIT_ACTIONS,
  OrganizationMemberStatus,
  TaskStatus,
  type Paginated,
  type TaskDto,
} from '@crm/shared';
import { TaskEntity } from './entities/task.entity.js';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity.js';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto.js';
import {
  normalizePagination,
  resolveSort,
  toPaginated,
} from '../../common/pagination.js';
import { AuditService } from '../audit/audit.service.js';

const SORTABLE = ['createdAt', 'updatedAt', 'dueAt', 'priority', 'status', 'title'] as const;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly repo: Repository<TaskEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: TaskQueryDto): Promise<Paginated<TaskDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const sortBy = resolveSort(query.sortBy, SORTABLE, 'createdAt');
    const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const base: FindOptionsWhere<TaskEntity> = { organizationId };
    if (query.status) base.status = query.status;
    if (query.priority) base.priority = query.priority;
    if (query.assigneeId) base.assigneeId = query.assigneeId;
    const where: FindOptionsWhere<TaskEntity> | FindOptionsWhere<TaskEntity>[] = query.search
      ? { ...base, title: ILike(`%${query.search}%`) }
      : base;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: dir } as FindOptionsOrder<TaskEntity>,
      skip,
      take: limit,
    });
    return toPaginated(rows.map((r) => this.toDto(r)), total, page, limit);
  }

  async getById(organizationId: string, id: string): Promise<TaskDto> {
    return this.toDto(await this.mustFind(organizationId, id));
  }

  async create(organizationId: string, ownerId: string, dto: CreateTaskDto): Promise<TaskDto> {
    await this.assertAssignee(organizationId, dto.assigneeId);
    const status = dto.status ?? TaskStatus.Open;
    const entity = await this.repo.save(
      this.repo.create({
        organizationId,
        ownerId,
        assigneeId: dto.assigneeId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        status,
        priority: dto.priority ?? undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        completedAt: status === TaskStatus.Done ? new Date() : null,
      }),
    );
    return this.toDto(entity);
  }

  async update(organizationId: string, id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.assigneeId !== undefined) {
      await this.assertAssignee(organizationId, dto.assigneeId);
      entity.assigneeId = dto.assigneeId ?? null;
    }
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.description !== undefined) entity.description = dto.description ?? null;
    if (dto.priority !== undefined) entity.priority = dto.priority;
    if (dto.dueAt !== undefined) entity.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.status !== undefined) {
      entity.status = dto.status;
      entity.completedAt = dto.status === TaskStatus.Done ? new Date() : null;
    }
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const entity = await this.mustFind(organizationId, id);
    // Soft delete and its audit entry commit together; only a short snapshot is kept.
    await this.repo.manager.transaction(async (manager) => {
      // Only a live row: a concurrent delete of the same record must not be audited twice.
      const result = await manager.softDelete(TaskEntity, { id, deletedAt: IsNull() });
      if (!result.affected) throw new NotFoundException('Task not found');
      await this.audit.record(
        {
          organizationId,
          action: AUDIT_ACTIONS.TaskDeleted,
          entityType: 'task',
          entityId: id,
          before: { title: entity.title },
        },
        manager,
      );
    });
  }

  private async assertAssignee(organizationId: string, assigneeId: string | undefined): Promise<void> {
    if (!assigneeId) return;
    const member = await this.memberRepo.findOne({
      where: { organizationId, userId: assigneeId, status: OrganizationMemberStatus.Active },
    });
    if (!member) {
      throw new BadRequestException('Assignee not found among the active members of the organization');
    }
  }

  private async mustFind(organizationId: string, id: string): Promise<TaskEntity> {
    const entity = await this.repo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Task not found');
    return entity;
  }

  private toDto(t: TaskEntity): TaskDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      ownerId: t.ownerId,
      assigneeId: t.assigneeId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
