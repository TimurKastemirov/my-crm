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
import {
  PERMISSIONS,
  type DealDto,
  type JwtPayload,
  type LeadDto,
  type Paginated,
} from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { LeadsService } from './leads.service.js';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto.js';
import { ChangeLeadStatusDto } from './dto/change-lead-status.dto.js';
import { ConvertLeadDto } from './dto/convert-lead.dto.js';
import { LeadQueryDto } from './dto/lead-query.dto.js';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LEADS_READ)
  @ApiOperation({ summary: 'List of leads', description: 'Filter by status, search by source, pagination. Own organization only.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: LeadQueryDto): Promise<Paginated<LeadDto>> {
    return this.leads.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LEADS_READ)
  @ApiOperation({ summary: 'Lead by id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<LeadDto> {
    return this.leads.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LEADS_CREATE)
  @ApiOperation({ summary: 'Create lead' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLeadDto): Promise<LeadDto> {
    return this.leads.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @ApiOperation({ summary: 'Update lead (except status)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadDto> {
    return this.leads.update(user.organizationId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.LEADS_UPDATE)
  @ApiOperation({
    summary: 'Change lead status',
    description: 'new/contacted/qualified/lost (lostReason is required for lost). The "converted" status is reached via conversion into a deal (Deals module).',
  })
  changeStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeLeadStatusDto,
  ): Promise<LeadDto> {
    return this.leads.changeStatus(user.organizationId, id, dto);
  }

  @Post(':id/convert')
  @RequirePermissions(PERMISSIONS.LEADS_CONVERT)
  @ApiOperation({
    summary: 'Convert lead into a deal',
    description: 'Creates a deal (in the default or specified pipeline) and marks the lead as converted.',
  })
  convert(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertLeadDto,
  ): Promise<{ lead: LeadDto; deal: DealDto }> {
    return this.leads.convert(user.organizationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.LEADS_DELETE)
  @ApiOperation({ summary: 'Delete lead (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.leads.remove(user.organizationId, id);
  }
}
