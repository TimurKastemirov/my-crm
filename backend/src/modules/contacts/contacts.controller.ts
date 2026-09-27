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
import { PERMISSIONS, type ContactDto, type JwtPayload, type Paginated } from '@crm/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { ContactsService } from './contacts.service.js';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto.js';
import { ListQueryDto } from '../../common/dto/list-query.dto.js';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CONTACTS_READ)
  @ApiOperation({ summary: 'Список контактов', description: 'Пагинация, поиск, сортировка. Только своя организация.' })
  list(@CurrentUser() user: JwtPayload, @Query() query: ListQueryDto): Promise<Paginated<ContactDto>> {
    return this.contacts.list(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CONTACTS_READ)
  @ApiOperation({ summary: 'Контакт по id' })
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<ContactDto> {
    return this.contacts.getById(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CONTACTS_CREATE)
  @ApiOperation({ summary: 'Создать контакт' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateContactDto): Promise<ContactDto> {
    return this.contacts.create(user.organizationId, user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CONTACTS_UPDATE)
  @ApiOperation({ summary: 'Обновить контакт' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactDto> {
    return this.contacts.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CONTACTS_DELETE)
  @ApiOperation({ summary: 'Удалить контакт (soft-delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.contacts.remove(user.organizationId, id);
  }
}
