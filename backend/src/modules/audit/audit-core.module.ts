import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity.js';
import { AuditLogEntity } from './entities/audit-log.entity.js';
import { AuditService } from './audit.service.js';

/**
 * AuditService for every module (global, no feature imports) — kept apart from the controller
 * module so modules that write entries don't form an import cycle with RBAC.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, UserEntity])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditCoreModule {}
