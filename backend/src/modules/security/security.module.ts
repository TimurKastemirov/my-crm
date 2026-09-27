import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { parseDurationToMs } from '../auth/auth.util.js';

/**
 * Общий модуль безопасности: настройка JwtModule (подпись access-токенов) и JwtAuthGuard.
 * Импортируется и AuthModule, и RbacModule — чтобы не дублировать конфиг JWT и не ловить
 * циклическую зависимость между модулями.
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
