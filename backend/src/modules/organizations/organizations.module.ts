import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { UserEntity } from '../users/entities/user.entity.js';
import { RefreshTokenEntity } from '../auth/entities/refresh-token.entity.js';
import { OrganizationEntity } from './entities/organization.entity.js';
import { OrganizationMemberEntity } from './entities/organization-member.entity.js';
import { OrganizationInvitationEntity } from './entities/organization-invitation.entity.js';
import { OrganizationsService } from './organizations.service.js';
import { MembersService } from './members.service.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  imports: [
    SecurityModule,
    RbacModule,
    // User — member profile and invite lookup; RefreshToken — revoking sessions of removed members.
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrganizationMemberEntity,
      OrganizationInvitationEntity,
      UserEntity,
      RefreshTokenEntity,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, MembersService],
  exports: [OrganizationsService, TypeOrmModule],
})
export class OrganizationsModule {}
