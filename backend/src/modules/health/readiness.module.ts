import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ReadinessController } from './readiness.controller.js';
import { RedisHealthIndicator } from './redis.health.js';

/**
 * Readiness-проверки (PG + Redis). Подключается в AppModule.
 * RedisService приходит из глобального RedisModule; DataSource — из PostgresModule (TypeOrmModule).
 */
@Module({
  imports: [TerminusModule],
  controllers: [ReadinessController],
  providers: [RedisHealthIndicator],
})
export class ReadinessModule {}
