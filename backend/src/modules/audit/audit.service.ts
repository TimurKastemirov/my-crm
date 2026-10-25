import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, MoreThan, Repository } from 'typeorm';
import type {
  AuditAction,
  AuditLogDto,
  AuditLogQuery,
  Paginated,
} from '@crm/shared';
import { currentRequest } from '../../common/request-context.js';
import { normalizePagination, toPaginated } from '../../common/pagination.js';
import { UserEntity } from '../users/entities/user.entity.js';
import { AuditLogEntity } from './entities/audit-log.entity.js';

export interface AuditEntry {
  organizationId: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string | null;
  /** Short snapshots only — never full records with personal data. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Defaults to the signed-in user of the current request. */
  actorId?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Appends an entry. Pass the transaction's manager so the entry commits (or rolls back)
   * together with the audited change. IP and user agent come from the current request.
   */
  async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    await this.recordMany([entry], manager);
  }

  async recordMany(
    entries: AuditEntry[],
    manager?: EntityManager,
  ): Promise<void> {
    if (entries.length === 0) return;
    const req = currentRequest();
    const userAgent = req?.headers['user-agent'];
    const repo = manager ? manager.getRepository(AuditLogEntity) : this.repo;
    await repo.save(
      entries.map((e) =>
        repo.create({
          organizationId: e.organizationId,
          actorId:
            e.actorId !== undefined ? e.actorId : (req?.user?.sub ?? null),
          action: e.action,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          ip: req?.ip ? normalizeIp(req.ip) : null,
          userAgent: userAgent ? String(userAgent).slice(0, 256) : null,
          before: e.before ?? null,
          after: e.after ?? null,
        }),
      ),
    );
  }

  /**
   * For events recorded after the action already happened outside a transaction (sign-in,
   * sign-out everywhere): a failing audit write is logged instead of failing the request.
   */
  async recordBestEffort(entries: AuditEntry[]): Promise<void> {
    try {
      await this.recordMany(entries);
    } catch (error) {
      this.logger.error(
        `Audit write failed for ${entries.map((e) => e.action).join(', ')}`,
        error,
      );
    }
  }

  /**
   * Records each entry unless the same action by the same actor was already recorded in that
   * organization within `windowMs` — keeps unauthenticated noise (failed sign-ins) bounded.
   */
  async recordThrottled(
    entries: AuditEntry[],
    windowMs: number,
  ): Promise<void> {
    const since = new Date(Date.now() - windowMs);
    const fresh: AuditEntry[] = [];
    try {
      for (const e of entries) {
        const recent = await this.repo.exists({
          where: {
            organizationId: e.organizationId,
            action: e.action,
            actorId: e.actorId ?? undefined,
            createdAt: MoreThan(since),
          },
        });
        if (!recent) fresh.push(e);
      }
    } catch (error) {
      this.logger.error('Audit throttle check failed', error);
      return;
    }
    await this.recordBestEffort(fresh);
  }

  /** Entries of the organization, newest first. */
  async list(
    organizationId: string,
    query: AuditLogQuery,
  ): Promise<Paginated<AuditLogDto>> {
    const { page, limit, skip } = normalizePagination(query);
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.organization_id = :organizationId', { organizationId });
    if (query.action)
      qb.andWhere('a.action = :action', { action: query.action });
    if (query.actorId)
      qb.andWhere('a.actor_id = :actorId', { actorId: query.actorId });
    if (query.entityType)
      qb.andWhere('a.entity_type = :entityType', {
        entityType: query.entityType,
      });
    if (query.entityId)
      qb.andWhere('a.entity_id = :entityId', { entityId: query.entityId });
    if (query.from) qb.andWhere('a.created_at >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.created_at < :to', { to: query.to });

    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id)),
    ];
    const actors = actorIds.length
      ? await this.userRepo.find({
          where: { id: In(actorIds) },
          select: { id: true, email: true, firstName: true, lastName: true },
          withDeleted: true,
        })
      : [];
    const actorById = new Map(actors.map((u) => [u.id, u]));

    return toPaginated(
      rows.map((r) => {
        const actor = r.actorId ? actorById.get(r.actorId) : undefined;
        return {
          id: r.id,
          organizationId: r.organizationId,
          actor: actor
            ? {
                id: actor.id,
                email: actor.email,
                firstName: actor.firstName,
                lastName: actor.lastName,
              }
            : null,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          ip: r.ip,
          userAgent: r.userAgent,
          before: r.before,
          after: r.after,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
    );
  }
}

/** "::ffff:203.0.113.5" (IPv4 mapped into IPv6 by the socket) → "203.0.113.5". */
export function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '').slice(0, 64);
}
