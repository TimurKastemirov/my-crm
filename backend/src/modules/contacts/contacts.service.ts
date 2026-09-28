import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
import type { ContactDto, Paginated } from '@crm/shared';
import { ContactEntity } from './entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';
import {
  normalizePagination,
  resolveSort,
  toPaginated,
} from '../../common/pagination.js';

const SORTABLE = ['createdAt', 'updatedAt', 'lastName', 'firstName'] as const;

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactEntity)
    private readonly repo: Repository<ContactEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
  ) {}

  async list(organizationId: string, query: ListQueryDto): Promise<Paginated<ContactDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const sortBy = resolveSort(query.sortBy, SORTABLE, 'createdAt');
    const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const s = query.search ? `%${query.search}%` : undefined;
    const where: FindOptionsWhere<ContactEntity>[] | FindOptionsWhere<ContactEntity> = s
      ? [
          { organizationId, firstName: ILike(s) },
          { organizationId, lastName: ILike(s) },
          { organizationId, email: ILike(s) },
          { organizationId, phone: ILike(s) },
        ]
      : { organizationId };

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: dir } as FindOptionsOrder<ContactEntity>,
      skip,
      take: limit,
    });
    return toPaginated(rows.map((r) => this.toDto(r)), total, page, limit);
  }

  async getById(organizationId: string, id: string): Promise<ContactDto> {
    return this.toDto(await this.mustFind(organizationId, id));
  }

  async create(
    organizationId: string,
    ownerId: string,
    dto: CreateContactDto,
  ): Promise<ContactDto> {
    await this.assertCompanyInOrg(organizationId, dto.companyId);
    const entity = await this.repo.save(
      this.repo.create({
        organizationId,
        ownerId,
        companyId: dto.companyId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        position: dto.position ?? null,
      }),
    );
    return this.toDto(entity);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<ContactDto> {
    const entity = await this.mustFind(organizationId, id);
    if (dto.companyId !== undefined) {
      await this.assertCompanyInOrg(organizationId, dto.companyId);
      entity.companyId = dto.companyId ?? null;
    }
    if (dto.firstName !== undefined) entity.firstName = dto.firstName;
    if (dto.lastName !== undefined) entity.lastName = dto.lastName;
    if (dto.email !== undefined) entity.email = dto.email ?? null;
    if (dto.phone !== undefined) entity.phone = dto.phone ?? null;
    if (dto.position !== undefined) entity.position = dto.position ?? null;
    await this.repo.save(entity);
    return this.toDto(entity);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.mustFind(organizationId, id);
    await this.repo.softDelete({ id });
  }

  private async assertCompanyInOrg(
    organizationId: string,
    companyId: string | undefined,
  ): Promise<void> {
    if (!companyId) return;
    const company = await this.companyRepo.findOne({
      where: { id: companyId, organizationId },
    });
    if (!company) {
      throw new BadRequestException('Company not found in the organization');
    }
  }

  private async mustFind(organizationId: string, id: string): Promise<ContactEntity> {
    const entity = await this.repo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Contact not found');
    return entity;
  }

  private toDto(c: ContactEntity): ContactDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      ownerId: c.ownerId,
      companyId: c.companyId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      position: c.position,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
