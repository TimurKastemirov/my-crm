import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, Repository, IsNull } from 'typeorm';
import { ownMatchSubquery, searchIdsIn, toSearchQuery } from '../../common/search.js';
import { AUDIT_ACTIONS, type CompanyDto, type Paginated } from '@crm/shared';
import { CompanyEntity } from './entities/company.entity.js';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import {
  normalizePagination,
  resolveSort,
  toPaginated,
} from '../../common/pagination.js';
import { AuditService } from '../audit/audit.service.js';

const SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly repo: Repository<CompanyEntity>,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: ListQueryDto): Promise<Paginated<CompanyDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const sortBy = resolveSort(query.sortBy, SORTABLE, 'createdAt');
    const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const where: FindOptionsWhere<CompanyEntity> = { organizationId };
    if (query.search) {
      // Name, website parts and industry, by word prefix.
      const searchQuery = toSearchQuery(query.search);
      if (!searchQuery) return toPaginated([], 0, page, limit);
      where.id = searchIdsIn(ownMatchSubquery('companies'), organizationId, searchQuery);
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: dir } as FindOptionsOrder<CompanyEntity>,
      skip,
      take: limit,
    });
    return toPaginated(rows.map((r) => this.toDto(r)), total, page, limit);
  }

  async getById(organizationId: string, id: string): Promise<CompanyDto> {
    return this.toDto(await this.mustFind(organizationId, id));
  }

  async create(
    organizationId: string,
    ownerId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyDto> {
    const entity = await this.repo.save(
      this.repo.create({
        organizationId,
        ownerId,
        name: dto.name,
        website: dto.website ?? null,
        industry: dto.industry ?? null,
        size: dto.size ?? null,
      }),
    );
    return this.toDto(entity);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.website !== undefined) entity.website = dto.website ?? null;
    if (dto.industry !== undefined) entity.industry = dto.industry ?? null;
    if (dto.size !== undefined) entity.size = dto.size ?? null;
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const entity = await this.mustFind(organizationId, id);
    // Soft delete and its audit entry commit together; only a short snapshot is kept.
    await this.repo.manager.transaction(async (manager) => {
      // Only a live row: a concurrent delete of the same record must not be audited twice.
      const result = await manager.softDelete(CompanyEntity, { id, deletedAt: IsNull() });
      if (!result.affected) throw new NotFoundException('Company not found');
      await this.audit.record(
        {
          organizationId,
          action: AUDIT_ACTIONS.CompanyDeleted,
          entityType: 'company',
          entityId: id,
          before: { name: entity.name },
        },
        manager,
      );
    });
  }

  private async mustFind(organizationId: string, id: string): Promise<CompanyEntity> {
    const entity = await this.repo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Company not found');
    return entity;
  }

  private toDto(c: CompanyEntity): CompanyDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      ownerId: c.ownerId,
      name: c.name,
      website: c.website,
      industry: c.industry,
      size: c.size,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
