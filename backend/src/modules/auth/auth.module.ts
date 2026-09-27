import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SecurityModule } from '../security/security.module.js';
import { UsersModule } from '../users/users.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { DealsModule } from '../deals/deals.module.js';

@Module({
  imports: [
    SecurityModule,
    UsersModule,
    OrganizationsModule,
    RbacModule,
    DealsModule,
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
