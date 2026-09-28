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
 * Readiness (spec §10.4): checks external dependencies — PostgreSQL and Redis.
 * Used by the orchestrator (docker-compose healthcheck) to decide whether it's "ready to accept traffic".
 * Kept separate from liveness (HealthController) so liveness/e2e don't require infrastructure.
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
    description: 'Readiness to accept traffic: checks PostgreSQL and Redis.',
  })
  @ApiOkResponse({ description: 'All dependencies are available' })
  @ApiServiceUnavailableResponse({ description: 'One of the dependencies is unavailable' })
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
