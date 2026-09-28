import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ReadinessController } from './readiness.controller.js';
import { RedisHealthIndicator } from './redis.health.js';

/**
 * Readiness checks (PG + Redis). Wired up in AppModule.
 * RedisService comes from the global RedisModule; DataSource — from PostgresModule (TypeOrmModule).
 */
@Module({
  imports: [TerminusModule],
  controllers: [ReadinessController],
  providers: [RedisHealthIndicator],
})
export class ReadinessModule {}
