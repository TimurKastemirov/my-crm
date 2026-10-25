import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AUDIT_ACTIONS,
  type OrganizationDto,
  type UpdateOrganizationRequest,
} from '@crm/shared';
import { AuditService } from '../audit/audit.service.js';
import { OrganizationEntity } from './entities/organization.entity.js';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly repo: Repository<OrganizationEntity>,
    private readonly audit: AuditService,
  ) {}

  findById(id: string): Promise<OrganizationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async getCurrent(id: string): Promise<OrganizationDto> {
    return this.toDto(await this.mustFind(id));
  }

  /** Renames the organization; the slug stays stable. */
  async updateCurrent(
    id: string,
    dto: UpdateOrganizationRequest,
  ): Promise<OrganizationDto> {
    const org = await this.mustFind(id);
    const before = { name: org.name };
    org.name = dto.name.trim();
    await this.repo.manager.transaction(async (manager) => {
      await manager.save(org);
      await this.audit.record(
        {
          organizationId: id,
          action: AUDIT_ACTIONS.OrganizationUpdated,
          entityType: 'organization',
          entityId: id,
          before,
          after: { name: org.name },
        },
        manager,
      );
    });
    return this.toDto(org);
  }

  private async mustFind(id: string): Promise<OrganizationEntity> {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  private toDto(org: OrganizationEntity): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  /** Base slug derived from the name (uniqueness is ensured at creation time). */
  static slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 160) || 'org'
    );
  }
}
