import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { parseDurationToMs } from '../auth/auth.util.js';

/**
 * Shared security module: JwtModule setup (access token signing) and JwtAuthGuard.
 * Imported by both AuthModule and RbacModule — to avoid duplicating the JWT config and
 * avoid a circular dependency between modules.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: Math.floor(
            parseDurationToMs(config.get<string>('JWT_ACCESS_TTL', '15m')) / 1000,
          ),
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class SecurityModule {}
