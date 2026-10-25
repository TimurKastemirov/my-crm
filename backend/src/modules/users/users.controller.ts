import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload, UserDto } from '@crm/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ description: 'Profile of the signed-in user' })
  getMe(@CurrentUser() user: JwtPayload): Promise<UserDto> {
    return this.users.getMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update profile',
    description:
      "Updates the current user's first and last name. The email cannot be changed.",
  })
  @ApiOkResponse({ description: 'Updated user profile' })
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch('me/settings')
  @ApiOperation({
    summary: 'Update settings',
    description: "Updates the current user's UI language and time zone (IANA).",
  })
  @ApiOkResponse({ description: 'Updated user profile' })
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSettingsDto,
  ): Promise<UserDto> {
    return this.users.updateSettings(user.sub, dto);
  }
}
