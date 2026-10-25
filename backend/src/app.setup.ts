import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

/**
 * HTTP-level setup shared by main.ts and the e2e harness, so tests run the real configuration.
 */
export function configureApp(app: INestApplication): void {
  // Behind a reverse proxy (nginx in prod) req.ip must come from X-Forwarded-For — but only from
  // the configured number of trusted hops, otherwise clients could spoof their IP (audit, rate limits).
  const hops = app.get(ConfigService).get<number>('TRUST_PROXY_HOPS', 0);
  if (hops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', hops);
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
