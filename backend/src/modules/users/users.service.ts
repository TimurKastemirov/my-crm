import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpdateProfileRequest, UserDto } from '@crm/shared';
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

  /** Updates the current user's editable settings (currently just the UI locale). */
  async updateProfile(id: string, changes: UpdateProfileRequest): Promise<UserDto> {
    const patch: Partial<UserEntity> = {};
    if (changes.locale !== undefined) patch.locale = changes.locale;
    if (Object.keys(patch).length > 0) {
      await this.repo.update({ id }, patch);
    }
    const user = await this.repo.findOneOrFail({ where: { id } });
    return toUserDto(user);
  }
}

function toUserDto(u: UserEntity): UserDto {
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
