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
import { PERMISSIONS, type CompanyDto, type JwtPayload, type Paginated } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  @ApiOperation({ summary: 'List of companies', description: 'Pagination, search, sorting. Own organization only.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: ListQueryDto): Promise<Paginated<CompanyDto>> {
    return this.companies.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_READ)
  @ApiOperation({ summary: 'Company by id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<CompanyDto> {
    return this.companies.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.COMPANIES_CREATE)
  @ApiOperation({ summary: 'Create company' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCompanyDto): Promise<CompanyDto> {
    return this.companies.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_UPDATE)
  @ApiOperation({ summary: 'Update company' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyDto> {
    return this.companies.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.COMPANIES_DELETE)
  @ApiOperation({ summary: 'Delete company (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.companies.remove(user.organizationId, id);
  }
}
