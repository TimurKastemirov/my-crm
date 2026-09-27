import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './config/redis/redis.module.js';
import { PostgresModule } from './config/postgres/postgres.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ReadinessModule } from './modules/health/readiness.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { ContactsModule } from './modules/contacts/contacts.module.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PostgresModule,
    RedisModule,
    HealthModule,
    ReadinessModule,
    AuthModule,
    RbacModule,
    CompaniesModule,
    ContactsModule,
  ],
})
export class AppModule {}
