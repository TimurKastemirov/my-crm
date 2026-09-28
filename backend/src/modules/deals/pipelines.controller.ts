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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type JwtPayload, type PipelineDto, type PipelineStageDto } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { PipelinesService } from './pipelines.service.js';
import {
  CreatePipelineDto,
  CreateStageDto,
  UpdatePipelineDto,
  UpdateStageDto,
} from './dto/pipeline.dto.js';

@ApiTags('pipelines')
@ApiBearerAuth()
@Controller('pipelines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEALS_READ)
  @ApiOperation({ summary: 'Pipelines with stages' })
  list(@CurrentUser() user: JwtPayload): Promise<PipelineDto[]> {
    return this.pipelines.listPipelines(user.organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Create pipeline' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePipelineDto): Promise<PipelineDto> {
    return this.pipelines.createPipeline(user.organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Update pipeline' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePipelineDto,
  ): Promise<PipelineDto> {
    return this.pipelines.updatePipeline(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Delete pipeline (cannot delete default or one with deals)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.pipelines.deletePipeline(user.organizationId, id);
  }

  @Get(':id/stages')
  @RequirePermissions(PERMISSIONS.DEALS_READ)
  @ApiOperation({ summary: 'Pipeline stages' })
  listStages(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PipelineStageDto[]> {
    return this.pipelines.listStages(user.organizationId, id);
  }

  @Post(':id/stages')
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Add stage' })
  createStage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStageDto,
  ): Promise<PipelineStageDto> {
    return this.pipelines.createStage(user.organizationId, id, dto);
  }

  @Patch(':id/stages/:stageId')
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Update stage' })
  updateStage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: UpdateStageDto,
  ): Promise<PipelineStageDto> {
    return this.pipelines.updateStage(user.organizationId, id, stageId, dto);
  }

  @Delete(':id/stages/:stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.PIPELINES_MANAGE)
  @ApiOperation({ summary: 'Delete stage (cannot delete one with deals)' })
  removeStage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ): Promise<void> {
    return this.pipelines.deleteStage(user.organizationId, id, stageId);
  }
}
