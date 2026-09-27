import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Конфигурация OpenAPI-документа (используется и в рантайме, и в оффлайн-экспорте). */
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('CRM API')
    .setDescription(
      'REST API мультиарендной CRM (NestJS). Базовый префикс — `/api/v1`. ' +
        'Защищённые эндпоинты требуют Bearer access-token — нажмите «Authorize» и вставьте токен из /auth/login.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addTag('auth', 'Аутентификация, сессии и токены')
    .addTag('health', 'Проверки состояния сервиса (liveness / readiness)')
    .build();
}

/** Поднимает Swagger UI на /api/docs и JSON на /api/docs-json. */
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
