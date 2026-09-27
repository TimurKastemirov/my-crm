import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload, Permission } from '@crm/shared';
import { RolesService } from '../roles.service.js';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';

/**
 * Проверяет права из @RequirePermissions против агрегированных прав пользователя.
 * Требует, чтобы раньше отработал JwtAuthGuard (положил payload в request.user).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Нет контекста пользователя (нужен JwtAuthGuard)');
    }

    const codes = await this.rolesService.getUserPermissionCodes(
      user.sub,
      user.organizationId,
    );
    const missing = required.filter((p) => !codes.includes(p));
    if (missing.length) {
      throw new ForbiddenException(`Недостаточно прав: ${missing.join(', ')}`);
    }
    return true;
  }
}
