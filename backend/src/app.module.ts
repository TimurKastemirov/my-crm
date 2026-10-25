import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './config/redis/redis.module.js';
import { PostgresModule } from './config/postgres/postgres.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ReadinessModule } from './modules/health/readiness.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { ContactsModule } from './modules/contacts/contacts.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { DealsModule } from './modules/deals/deals.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { validateEnv } from './config/env.validation.js';
import { AuditCoreModule } from './modules/audit/audit-core.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { RequestContextMiddleware } from './common/request-context.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PostgresModule,
    RedisModule,
    AuditCoreModule,
    HealthModule,
    ReadinessModule,
    AuthModule,
    RbacModule,
    OrganizationsModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    DealsModule,
    TasksModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
