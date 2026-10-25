import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  UpdateProfileRequest,
  UpdateSettingsRequest,
  UserDto,
} from '@crm/shared';
import { UserEntity } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repo.update({ id }, { lastLoginAt: new Date() });
  }

  async getMe(id: string): Promise<UserDto> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserDto(user);
  }

  /** Updates the current user's name (email is read-only). */
  async updateProfile(
    id: string,
    changes: UpdateProfileRequest,
  ): Promise<UserDto> {
    const patch: Partial<UserEntity> = {};
    if (changes.firstName !== undefined)
      patch.firstName = changes.firstName.trim();
    if (changes.lastName !== undefined)
      patch.lastName = changes.lastName.trim();
    if (patch.firstName === '' || patch.lastName === '') {
      throw new BadRequestException('First and last name cannot be blank');
    }
    return this.apply(id, patch);
  }

  /** Updates the current user's preferences: UI language and time zone. */
  async updateSettings(
    id: string,
    changes: UpdateSettingsRequest,
  ): Promise<UserDto> {
    const patch: Partial<UserEntity> = {};
    if (changes.locale !== undefined) patch.locale = changes.locale;
    if (changes.timezone !== undefined) patch.timezone = changes.timezone;
    return this.apply(id, patch);
  }

  private async apply(
    id: string,
    patch: Partial<UserEntity>,
  ): Promise<UserDto> {
    if (Object.keys(patch).length > 0) {
      await this.repo.update({ id }, patch);
    }
    return this.getMe(id);
  }
}

export function toUserDto(u: UserEntity): UserDto {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl,
    timezone: u.timezone,
    locale: u.locale,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
