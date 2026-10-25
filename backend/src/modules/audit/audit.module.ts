import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuditController } from './audit.controller.js';

@Module({
  imports: [SecurityModule, RbacModule],
  controllers: [AuditController],
})
export class AuditModule {}
