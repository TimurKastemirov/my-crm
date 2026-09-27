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
  @ApiOperation({ summary: 'Список сделок', description: 'Фильтр по воронке/этапу/статусу, поиск, пагинация.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: DealQueryDto): Promise<Paginated<DealDto>> {
    return this.deals.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEALS_READ)
  @ApiOperation({ summary: 'Сделка по id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<DealDto> {
    return this.deals.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEALS_CREATE)
  @ApiOperation({ summary: 'Создать сделку' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDealDto): Promise<DealDto> {
    return this.deals.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Обновить сделку (кроме этапа/статуса)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
  ): Promise<DealDto> {
    return this.deals.update(user.organizationId, id, dto);
  }

  @Patch(':id/move-stage')
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Переместить по этапу (Kanban)', description: 'Статус выводится из флагов этапа (won/lost/open).' })
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
  @ApiOperation({ summary: 'Отметить сделку выигранной' })
  win(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<DealDto> {
    return this.deals.win(user.organizationId, id);
  }

  @Post(':id/lose')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.DEALS_UPDATE)
  @ApiOperation({ summary: 'Отметить сделку проигранной' })
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
  @ApiOperation({ summary: 'Удалить сделку (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.deals.remove(user.organizationId, id);
  }
}
