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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type JwtPayload, type Paginated, type TaskDto } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  @ApiOperation({ summary: 'List of tasks', description: 'Filter by status/priority/assignee, search, pagination.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: TaskQueryDto): Promise<Paginated<TaskDto>> {
    return this.tasks.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TASKS_READ)
  @ApiOperation({ summary: 'Task by id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<TaskDto> {
    return this.tasks.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TASKS_CREATE)
  @ApiOperation({ summary: 'Create task' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto): Promise<TaskDto> {
    return this.tasks.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASKS_UPDATE)
  @ApiOperation({ summary: 'Update task', description: 'Changing status to done sets completedAt.' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.TASKS_DELETE)
  @ApiOperation({ summary: 'Delete task (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tasks.remove(user.organizationId, id);
  }
}
