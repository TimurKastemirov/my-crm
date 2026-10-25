import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS, type JwtPayload, type RoleSummaryDto } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RolesService } from './roles.service.js';
import { PermissionsService } from './permissions.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@ApiTags('rbac')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly roles: RolesService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Permission catalog', description: 'All available permission codes.' })
  @ApiOkResponse({ description: 'List of permissions' })
  listPermissions() {
    return this.permissions.list();
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Organization roles' })
  @ApiOkResponse({ description: 'List of roles with their permissions and usage counts' })
  listRoles(@CurrentUser() user: JwtPayload): Promise<RoleSummaryDto[]> {
    return this.roles.listRoleSummaries(user.organizationId, user.sub);
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Create a role',
    description: 'Only permissions the current user holds can be granted. The code is generated from the name when omitted.',
  })
  @ApiCreatedResponse({ description: 'Created role' })
  @ApiForbiddenResponse({ description: 'Granting permissions the current user lacks' })
  createRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleSummaryDto> {
    return this.roles.createRole(user.organizationId, user.sub, dto);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Update a role',
    description:
      'System roles are immutable. Not your own role, not a role with permissions you lack, and only permissions you hold. Holders get the change immediately.',
  })
  @ApiOkResponse({ description: 'Updated role' })
  @ApiForbiddenResponse({ description: 'System role, own role or privilege escalation' })
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleSummaryDto> {
    return this.roles.updateRole(user.organizationId, user.sub, id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({
    summary: 'Delete a role',
    description: 'System roles cannot be deleted; a role assigned to members or pending invitations is kept (409).',
  })
  @ApiNoContentResponse({ description: 'Role deleted' })
  @ApiConflictResponse({ description: 'The role is in use' })
  deleteRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.roles.deleteRole(user.organizationId, user.sub, id);
  }
}
