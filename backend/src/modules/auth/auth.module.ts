import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { parseDurationToMs } from './auth.util.js';
import { UsersModule } from '../users/users.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        // expiresIn в секундах (число) — избегаем брендированного StringValue из jsonwebtoken.
        signOptions: {
          expiresIn: Math.floor(
            parseDurationToMs(config.get<string>('JWT_ACCESS_TTL', '15m')) / 1000,
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
