import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** OpenAPI document configuration (used both at runtime and in offline export). */
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription(
      'REST API for a multi-tenant CRM (NestJS). Base prefix — `/api/v1`. ' +
        'Protected endpoints require a Bearer access token — click "Authorize" and paste the token from /auth/login.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addTag('auth', 'Authentication, sessions and tokens')
    .addTag('health', 'Service health checks (liveness / readiness)')
    .build();
}

/** Spins up Swagger UI at /api/docs and JSON at /api/docs-json. */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
