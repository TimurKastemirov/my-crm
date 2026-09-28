import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@crm/shared';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/** Marks a route with required permissions. Works together with PermissionsGuard (after JwtAuthGuard). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
