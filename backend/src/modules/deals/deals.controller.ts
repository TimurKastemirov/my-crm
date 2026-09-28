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
import { PERMISSIONS, type DealDto, type JwtPayload, type Paginated } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { DealsService } from './deals.service.js';
import {
  CreateDealDto,
  DealQueryDto,
  LoseDealDto,
  MoveStageDto,
  UpdateDealDto,
} from './dto/deal.dto.js';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEALS_READ)
  @ApiOperation({ summary: 'List of deals', description: 'Filter by pipeline/stage/status, search, pagination.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: DealQueryDto): Promise<Paginated<DealDto>> {
    return this.deals.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEALS_READ)
  @ApiOperation({ summary: 'Deal by id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<DealDto> {
    return this.deals.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEALS_CREATE)
  @ApiOperation({ summary: 'Create deal' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDealDto): Promise<DealDto> {
    return this.deals.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Update deal (except stage/status)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
  ): Promise<DealDto> {
    return this.deals.update(user.organizationId, id, dto);
  }

  @Patch(':id/move-stage')
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Move by stage (Kanban)', description: 'Status is derived from the stage flags (won/lost/open).' })
  moveStage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveStageDto,
  ): Promise<DealDto> {
    return this.deals.moveStage(user.organizationId, id, dto.stageId);
  }

  @Post(':id/win')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Mark deal as won' })
  win(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<DealDto> {
    return this.deals.win(user.organizationId, id);
  }

  @Post(':id/lose')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Mark deal as lost' })
  lose(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LoseDealDto,
  ): Promise<DealDto> {
    return this.deals.lose(user.organizationId, id, dto.lostReason ?? null);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.DEALS_DELETE)
  @ApiOperation({ summary: 'Delete deal (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.deals.remove(user.organizationId, id);
  }
}
