import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { PermissionEntity } from './entities/permission.entity.js';
import { RoleEntity } from './entities/role.entity.js';
import { RolePermissionEntity } from './entities/role-permission.entity.js';
import { UserRoleEntity } from './entities/user-role.entity.js';
import { PermissionsService } from './permissions.service.js';
import { RolesService } from './roles.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RolesController } from './roles.controller.js';

@Module({
  imports: [
    SecurityModule,
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
      UserRoleEntity,
    ]),
  ],
  controllers: [RolesController],
  providers: [PermissionsService, RolesService, PermissionsGuard],
  exports: [RolesService, PermissionsGuard],
})
export class RbacModule {}
