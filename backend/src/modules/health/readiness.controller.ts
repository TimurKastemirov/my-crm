import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis.health.js';

/**
 * Readiness (§10.4 ТЗ): проверяет внешние зависимости — PostgreSQL и Redis.
 * Используется оркестратором (docker-compose healthcheck) для решения «готов принимать трафик».
 * Отдельно от liveness (HealthController), чтобы liveness/e2e не требовали инфраструктуры.
 */
@ApiTags('health')
@Controller('health')
export class ReadinessController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness',
    description: 'Готовность принимать трафик: проверка PostgreSQL и Redis.',
  })
  @ApiOkResponse({ description: 'Все зависимости доступны' })
  @ApiServiceUnavailableResponse({ description: 'Одна из зависимостей недоступна' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
