import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PERMISSIONS,
  type AuditLogDto,
  type JwtPayload,
  type Paginated,
} from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { AuditService } from './audit.service.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    summary: 'Audit log',
    description:
      'Key operations of the organization (sign-in, access control changes, deletions), newest first. Filters: action, actor, entity, period.',
  })
  @ApiOkResponse({ description: 'Page of audit entries' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: AuditLogQueryDto,
  ): Promise<Paginated<AuditLogDto>> {
    return this.audit.list(user.organizationId, query);
  }
}
