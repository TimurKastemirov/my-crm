import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { TaskEntity } from './entities/task.entity.js';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity.js';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';

@Module({
  imports: [
    SecurityModule,
    RbacModule,
    // OrganizationMember — для проверки, что исполнитель состоит в организации.
    TypeOrmModule.forFeature([TaskEntity, OrganizationMemberEntity]),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
