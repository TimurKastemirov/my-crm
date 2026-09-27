import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { DealStatus, type DealDto, type Paginated } from '@crm/shared';
import { DealEntity } from './entities/deal.entity.js';
import { PipelineStageEntity } from './entities/pipeline-stage.entity.js';
import { ContactEntity } from '../contacts/entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { CreateDealDto, DealQueryDto, UpdateDealDto } from './dto/deal.dto.js';
import {
  normalizePagination,
  resolveSort,
  toPaginated,
} from '../../common/pagination.js';

const SORTABLE = ['createdAt', 'updatedAt', 'amount', 'title', 'expectedCloseDate'] as const;

@Injectable()
export class DealsService {
  constructor(
    @InjectRepository(DealEntity)
    private readonly repo: Repository<DealEntity>,
    @InjectRepository(PipelineStageEntity)
    private readonly stageRepo: Repository<PipelineStageEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepo: Repository<ContactEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
  ) {}

  async list(organizationId: string, query: DealQueryDto): Promise<Paginated<DealDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const sortBy = resolveSort(query.sortBy, SORTABLE, 'createdAt');
    const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const base: FindOptionsWhere<DealEntity> = { organizationId };
    if (query.pipelineId) base.pipelineId = query.pipelineId;
    if (query.stageId) base.stageId = query.stageId;
    if (query.status) base.status = query.status;
    const where: FindOptionsWhere<DealEntity> | FindOptionsWhere<DealEntity>[] = query.search
      ? { ...base, title: ILike(`%${query.search}%`) }
      : base;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: dir } as FindOptionsOrder<DealEntity>,
      skip,
      take: limit,
    });
    return toPaginated(rows.map((r) => this.toDto(r)), total, page, limit);
  }

  async getById(organizationId: string, id: string): Promise<DealDto> {
    return this.toDto(await this.mustFind(organizationId, id));
  }

  async create(organizationId: string, ownerId: string, dto: CreateDealDto): Promise<DealDto> {
    await this.assertStage(organizationId, dto.pipelineId, dto.stageId);
    await this.assertLinks(organizationId, dto.contactId, dto.companyId);
    const entity = await this.repo.save(
      this.repo.create({
        organizationId,
        ownerId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        title: dto.title,
        amount: dto.amount ?? '0',
        currency: dto.currency ?? null,
        contactId: dto.contactId ?? null,
        companyId: dto.companyId ?? null,
        status: DealStatus.Open,
        expectedCloseDate: dto.expectedCloseDate ?? null,
      }),
    );
    return this.toDto(entity);
  }

  async update(organizationId: string, id: string, dto: UpdateDealDto): Promise<DealDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.contactId !== undefined || dto.companyId !== undefined) {
      await this.assertLinks(
        organizationId,
        dto.contactId ?? entity.contactId ?? undefined,
        dto.companyId ?? entity.companyId ?? undefined,
      );
    }
    if (dto.title !== undefined) entity.title = dto.title;
    if (dto.amount !== undefined) entity.amount = dto.amount ?? '0';
    if (dto.currency !== undefined) entity.currency = dto.currency ?? null;
    if (dto.contactId !== undefined) entity.contactId = dto.contactId ?? null;
    if (dto.companyId !== undefined) entity.companyId = dto.companyId ?? null;
    if (dto.expectedCloseDate !== undefined) entity.expectedCloseDate = dto.expectedCloseDate ?? null;
    // pipeline/stage/status меняются через move-stage / win / lose.
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  /** Перемещение по этапам (Kanban). Статус выводится из флагов целевого этапа. */
  async moveStage(organizationId: string, id: string, stageId: string): Promise<DealDto> {
    const deal = await this.mustFind(organizationId, id);
    const stage = await this.assertStage(organizationId, deal.pipelineId, stageId);
    deal.stageId = stage.id;
    if (stage.isWon) {
      deal.status = DealStatus.Won;
      deal.closedAt = new Date();
    } else if (stage.isLost) {
      deal.status = DealStatus.Lost;
      deal.closedAt = new Date();
    } else {
      deal.status = DealStatus.Open;
      deal.closedAt = null;
      deal.lostReason = null;
    }
    await this.repo.save(deal);
    return this.toDto(deal);
  }

  async win(organizationId: string, id: string): Promise<DealDto> {
    const deal = await this.mustFind(organizationId, id);
    deal.status = DealStatus.Won;
    deal.closedAt = new Date();
    deal.lostReason = null;
    await this.repo.save(deal);
    return this.toDto(deal);
  }

  async lose(organizationId: string, id: string, lostReason: string | null): Promise<DealDto> {
    const deal = await this.mustFind(organizationId, id);
    deal.status = DealStatus.Lost;
    deal.closedAt = new Date();
    deal.lostReason = lostReason;
    await this.repo.save(deal);
    return this.toDto(deal);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.mustFind(organizationId, id);
    await this.repo.softDelete({ id });
  }

  private async assertStage(
    organizationId: string,
    pipelineId: string,
    stageId: string,
  ): Promise<PipelineStageEntity> {
    const stage = await this.stageRepo.findOne({ where: { id: stageId, pipelineId, organizationId } });
    if (!stage) throw new BadRequestException('Этап не найден в указанной воронке организации');
    return stage;
  }

  private async assertLinks(
    organizationId: string,
    contactId: string | undefined,
    companyId: string | undefined,
  ): Promise<void> {
    if (contactId) {
      const c = await this.contactRepo.findOne({ where: { id: contactId, organizationId } });
      if (!c) throw new BadRequestException('Контакт не найден в организации');
    }
    if (companyId) {
      const c = await this.companyRepo.findOne({ where: { id: companyId, organizationId } });
      if (!c) throw new BadRequestException('Компания не найдена в организации');
    }
  }

  private async mustFind(organizationId: string, id: string): Promise<DealEntity> {
    const entity = await this.repo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Сделка не найдена');
    return entity;
  }

  private toDto(d: DealEntity): DealDto {
    return {
      id: d.id,
      organizationId: d.organizationId,
      ownerId: d.ownerId,
      pipelineId: d.pipelineId,
      stageId: d.stageId,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      contactId: d.contactId,
      companyId: d.companyId,
      status: d.status,
      expectedCloseDate: d.expectedCloseDate,
      closedAt: d.closedAt ? d.closedAt.toISOString() : null,
      lostReason: d.lostReason,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
