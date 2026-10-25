import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient!: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      retryStrategy: (times: number) => {
        this.logger.warn(`Retrying Redis connection: attempt ${times}`);
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      // Fail fast when Redis is unreachable: callers fall back to PostgreSQL instead of hanging.
      commandTimeout: 1000,
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redisClient.on('error', (err: any) => {
      this.logger.error('Redis connection error', err);
    });
  }

  onModuleDestroy() {
    if (this.redisClient) {
      void this.redisClient.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redisClient.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key} from Redis`, error);
      return null; // Handle Redis unavailability gracefully without throwing
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.redisClient.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key} in Redis`, error);
    }
  }

  /**
   * Sets an integer value only if the key is absent or holds a smaller number — out-of-order
   * writers can't move it backwards. Never throws.
   */
  async setIfGreater(key: string, value: number, ttlSeconds: number): Promise<void> {
    try {
      await this.redisClient.eval(
        `local cur = redis.call('GET', KEYS[1])
         if (not cur) or (tonumber(cur) == nil) or (tonumber(cur) < tonumber(ARGV[1])) then
           redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
         end
         return 1`,
        1,
        key,
        String(value),
        String(ttlSeconds),
      );
    } catch (error) {
      this.logger.error(`Error setting key ${key} in Redis`, error);
    }
  }

  /** SET … NX: writes only if the key is absent (true when written). Never throws. */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      return (await this.redisClient.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
    } catch (error) {
      this.logger.error(`Error setting key ${key} in Redis`, error);
      return false;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key} from Redis`, error);
    }
  }

  /** Ping for health checks. Throws if the connection is unavailable. */
  async ping(): Promise<boolean> {
    const res = await this.redisClient.ping();
    return res === 'PONG';
  }
}
