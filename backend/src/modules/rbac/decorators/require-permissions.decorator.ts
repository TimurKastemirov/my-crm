import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@crm/shared';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/** Помечает роут требуемыми правами. Работает в паре с PermissionsGuard (после JwtAuthGuard). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
