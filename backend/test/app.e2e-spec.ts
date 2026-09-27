import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module.js';

/**
 * Health e2e (§4.1 / §9 ТЗ). Заменяет устаревший scaffold-тест, который ждал
 * 'Hello World!' от уже удалённого AppController.
 *
 * Импортируем только HealthModule — чтобы e2e гонялся без внешней инфраструктуры
 * (PostgreSQL/Redis). Полноценный e2e всего AppModule требует docker-compose и
 * добавляется на этапе Docker (§10).
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 200, status ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });
});
