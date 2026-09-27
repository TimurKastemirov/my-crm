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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS, type JwtPayload, type RoleDto } from '@crm/shared';
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
  @ApiOperation({ summary: 'Справочник прав', description: 'Все доступные коды прав.' })
  @ApiOkResponse({ description: 'Список прав' })
  listPermissions() {
    return this.permissions.list();
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Роли организации' })
  @ApiOkResponse({ description: 'Список ролей с их правами' })
  listRoles(@CurrentUser() user: JwtPayload): Promise<RoleDto[]> {
    return this.roles.listRoles(user.organizationId);
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Создать роль' })
  @ApiOkResponse({ description: 'Созданная роль' })
  createRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleDto> {
    return this.roles.createRole(user.organizationId, dto);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Обновить роль', description: 'Системные роли неизменяемы.' })
  @ApiOkResponse({ description: 'Обновлённая роль' })
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.roles.updateRole(user.organizationId, id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Удалить роль', description: 'Системные роли удалять нельзя.' })
  @ApiNoContentResponse({ description: 'Роль удалена' })
  deleteRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.roles.deleteRole(user.organizationId, id);
  }
}
