import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { LeadStatus, type DealDto, type LeadDto, type Paginated } from '@crm/shared';
import { LeadEntity } from './entities/lead.entity.js';
import { ContactEntity } from '../contacts/entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto.js';
import { ChangeLeadStatusDto } from './dto/change-lead-status.dto.js';
import { ConvertLeadDto } from './dto/convert-lead.dto.js';
import { LeadQueryDto } from './dto/lead-query.dto.js';
import { DealsService } from '../deals/deals.service.js';
import { PipelinesService } from '../deals/pipelines.service.js';
import {
  normalizePagination,
  resolveSort,
  toPaginated,
} from '../../common/pagination.js';

const SORTABLE = ['createdAt', 'updatedAt', 'status', 'estimatedValue'] as const;

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly repo: Repository<LeadEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepo: Repository<ContactEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    private readonly dealsService: DealsService,
    private readonly pipelinesService: PipelinesService,
  ) {}

  async list(organizationId: string, query: LeadQueryDto): Promise<Paginated<LeadDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const sortBy = resolveSort(query.sortBy, SORTABLE, 'createdAt');
    const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const base: FindOptionsWhere<LeadEntity> = { organizationId };
    if (query.status) base.status = query.status;
    const where: FindOptionsWhere<LeadEntity>[] | FindOptionsWhere<LeadEntity> =
      query.search ? { ...base, source: ILike(`%${query.search}%`) } : base;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: dir } as FindOptionsOrder<LeadEntity>,
      skip,
      take: limit,
    });
    return toPaginated(rows.map((r) => this.toDto(r)), total, page, limit);
  }

  async getById(organizationId: string, id: string): Promise<LeadDto> {
    return this.toDto(await this.mustFind(organizationId, id));
  }

  async create(organizationId: string, ownerId: string, dto: CreateLeadDto): Promise<LeadDto> {
    await this.assertLinks(organizationId, dto.contactId, dto.companyId);
    const entity = await this.repo.save(
      this.repo.create({
        organizationId,
        ownerId,
        source: dto.source ?? null,
        status: dto.status ?? LeadStatus.New,
        contactId: dto.contactId ?? null,
        companyId: dto.companyId ?? null,
        estimatedValue: dto.estimatedValue ?? null,
        currency: dto.currency ?? null,
      }),
    );
    return this.toDto(entity);
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto): Promise<LeadDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.contactId !== undefined || dto.companyId !== undefined) {
      await this.assertLinks(
        organizationId,
        dto.contactId ?? entity.contactId ?? undefined,
        dto.companyId ?? entity.companyId ?? undefined,
      );
    }
    if (dto.source !== undefined) entity.source = dto.source ?? null;
    if (dto.contactId !== undefined) entity.contactId = dto.contactId ?? null;
    if (dto.companyId !== undefined) entity.companyId = dto.companyId ?? null;
    if (dto.estimatedValue !== undefined) entity.estimatedValue = dto.estimatedValue ?? null;
    if (dto.currency !== undefined) entity.currency = dto.currency ?? null;
    // status is changed only via changeStatus (see below).
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  async changeStatus(
    organizationId: string,
    id: string,
    dto: ChangeLeadStatusDto,
  ): Promise<LeadDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.status === LeadStatus.Converted) {
      throw new BadRequestException(
        'The "converted" status is reached by converting a lead into a deal (available via the Deals module)',
      );
    }
    if (dto.status === LeadStatus.Lost && !dto.lostReason) {
      throw new BadRequestException('To move to "lost", provide lostReason');
    }
    entity.status = dto.status;
    entity.lostReason = dto.status === LeadStatus.Lost ? (dto.lostReason ?? null) : null;
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.mustFind(organizationId, id);
    await this.repo.softDelete({ id });
  }

  /** Converts a lead into a deal: creates the deal and marks the lead as converted. */
  async convert(
    organizationId: string,
    ownerId: string,
    id: string,
    dto: ConvertLeadDto,
  ): Promise<{ lead: LeadDto; deal: DealDto }> {
    const lead = await this.mustFind(organizationId, id);
    if (lead.status === LeadStatus.Converted) {
      throw new BadRequestException('Lead already converted');
    }
    if (lead.status === LeadStatus.Lost) {
      throw new BadRequestException('A lost lead cannot be converted');
    }

    const target =
      dto.pipelineId && dto.stageId
        ? { pipelineId: dto.pipelineId, stageId: dto.stageId }
        : await this.pipelinesService.defaultTarget(organizationId);

    const deal = await this.dealsService.create(organizationId, ownerId, {
      pipelineId: target.pipelineId,
      stageId: target.stageId,
      title: dto.title,
      amount: dto.amount ?? lead.estimatedValue ?? undefined,
      currency: lead.currency ?? undefined,
      contactId: lead.contactId ?? undefined,
      companyId: lead.companyId ?? undefined,
    });

    lead.status = LeadStatus.Converted;
    lead.convertedDealId = deal.id;
    lead.lostReason = null;
    await this.repo.save(lead);

    return { lead: this.toDto(lead), deal };
  }

  private async assertLinks(
    organizationId: string,
    contactId: string | undefined,
    companyId: string | undefined,
  ): Promise<void> {
    if (contactId) {
      const contact = await this.contactRepo.findOne({ where: { id: contactId, organizationId } });
      if (!contact) throw new BadRequestException('Contact not found in the organization');
    }
    if (companyId) {
      const company = await this.companyRepo.findOne({ where: { id: companyId, organizationId } });
      if (!company) throw new BadRequestException('Company not found in the organization');
    }
  }

  private async mustFind(organizationId: string, id: string): Promise<LeadEntity> {
    const entity = await this.repo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Lead not found');
    return entity;
  }

  private toDto(l: LeadEntity): LeadDto {
    return {
      id: l.id,
      organizationId: l.organizationId,
      ownerId: l.ownerId,
      source: l.source,
      status: l.status,
      contactId: l.contactId,
      companyId: l.companyId,
      estimatedValue: l.estimatedValue,
      currency: l.currency,
      convertedDealId: l.convertedDealId,
      lostReason: l.lostReason,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }
}
