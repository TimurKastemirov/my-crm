import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { redisKeys } from '@crm/shared';
import { RedisService } from '../../config/redis/redis.service.js';
import { UserEntity } from '../users/entities/user.entity.js';

const CACHE_TTL_SECONDS = 60;
/** Cached marker for "no such user", so tokens of a deleted account don't query the DB each time. */
const MISSING = 'missing';

/**
 * The user's session version (`users.session_version`): access tokens carry it and are rejected
 * once it moves on. PostgreSQL is the source of truth; Redis caches it for the per-request check.
 */
@Injectable()
export class SessionVersionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  /** Current version, or null when the user doesn't exist. */
  async current(userId: string): Promise<number | null> {
    const key = redisKeys.sessionVersion(userId);
    const cached = await this.redis.get(key);
    if (cached === MISSING) return null;
    if (cached !== null && /^\d+$/.test(cached)) return Number(cached);

    const rows: Array<{ session_version: number }> =
      await this.dataSource.query(
        `SELECT session_version FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [userId],
      );
    if (!rows.length) {
      await this.redis.setIfAbsent(key, MISSING, CACHE_TTL_SECONDS);
      return null;
    }
    // NX: a value written by a concurrent bump must not be overwritten with this (older) read.
    await this.redis.setIfAbsent(
      key,
      String(rows[0].session_version),
      CACHE_TTL_SECONDS,
    );
    return rows[0].session_version;
  }

  /**
   * Bumps the version inside the caller's transaction and returns the new value. Call
   * `publish(userId, version)` after the transaction commits.
   */
  async bump(manager: EntityManager, userId: string): Promise<number> {
    const result = await manager
      .createQueryBuilder()
      .update(UserEntity)
      .set({ sessionVersion: () => 'session_version + 1' })
      .where('id = :userId', { userId })
      .returning('session_version')
      .execute();
    const rows = result.raw as Array<{ session_version: number }>;
    if (!rows.length) throw new Error(`User ${userId} not found`);
    return rows[0].session_version;
  }

  /**
   * Makes a committed bump visible to the guard right away. Monotonic, so concurrent bumps
   * published out of order can't leave an older version cached. If Redis is down the cached
   * value (if any) expires within CACHE_TTL_SECONDS.
   */
  async publish(userId: string, version: number): Promise<void> {
    await this.redis.setIfGreater(
      redisKeys.sessionVersion(userId),
      version,
      CACHE_TTL_SECONDS,
    );
  }
}
