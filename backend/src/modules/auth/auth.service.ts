import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  OrganizationMemberStatus,
  type AuthResult,
  type AuthTokens,
  type JwtPayload,
  type SessionInfo,
  type UserDto,
} from '@crm/shared';
import { UserEntity } from '../users/entities/user.entity.js';
import { OrganizationEntity } from '../organizations/entities/organization.entity.js';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity.js';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { UsersService } from '../users/users.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { parseDurationToMs } from './auth.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,
  ) {}

  /** Регистрация: создаёт пользователя + организацию + членство (владелец) атомарно. */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordHash = await argonHash(dto.password);

    const { user, organizationId } = await this.dataSource.transaction(
      async (manager) => {
        const userRepo = manager.getRepository(UserEntity);
        const orgRepo = manager.getRepository(OrganizationEntity);
        const memberRepo = manager.getRepository(OrganizationMemberEntity);

        const createdUser = await userRepo.save(
          userRepo.create({
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
          }),
        );

        const slug = await this.uniqueSlug(
          orgRepo,
          OrganizationsService.slugify(dto.organizationName),
        );
        const org = await orgRepo.save(
          orgRepo.create({ name: dto.organizationName.trim(), slug }),
        );

        await memberRepo.save(
          memberRepo.create({
            organizationId: org.id,
            userId: createdUser.id,
            status: OrganizationMemberStatus.Active,
            joinedAt: new Date(),
          }),
        );

        return { user: createdUser, organizationId: org.id };
      },
    );

    const tokens = await this.issueTokens(user, organizationId, randomUUID(), meta);
    return { user: this.toUserDto(user), tokens };
  }

  /** Логин по email + паролю. Активная организация — первое активное членство. */
  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const passwordOk = await argonVerify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const organizationId = await this.primaryOrganizationId(user.id);
    if (!organizationId) {
      throw new UnauthorizedException('У пользователя нет активной организации');
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, organizationId, randomUUID(), meta);
    return { user: this.toUserDto(user), tokens };
  }

  /** Ротация refresh-токена с детектом повторного использования. */
  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.refreshRepo.findOne({ where: { tokenHash } });
    if (!record) {
      throw new UnauthorizedException('Недействительный refresh-токен');
    }

    // Повторное использование уже отозванного токена → компрометация: гасим всю семью.
    if (record.revokedAt) {
      await this.refreshRepo.update(
        { familyId: record.familyId },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Обнаружено повторное использование токена');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh-токен истёк');
    }

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Пользователь недоступен');
    }

    // Ротация: отзываем текущий и выпускаем новый в той же семье.
    record.revokedAt = new Date();
    await this.refreshRepo.save(record);
    return this.issueTokens(user, record.organizationId, record.familyId, meta);
  }

  /** Выход: отзыв конкретного refresh-токена. */
  async logout(rawToken: string): Promise<void> {
    await this.refreshRepo.update(
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Выход со всех устройств: отзыв всех активных токенов пользователя. */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Текущая сессия. */
  async me(payload: JwtPayload): Promise<SessionInfo> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return { user: this.toUserDto(user), organizationId: payload.organizationId };
  }

  // ---------- helpers ----------

  private async issueTokens(
    user: UserEntity,
    organizationId: string,
    familyId: string,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      organizationId,
      email: user.email,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlMs = parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_TTL', '30d'),
    );
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        organizationId,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + ttlMs),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async primaryOrganizationId(userId: string): Promise<string | null> {
    const member = await this.dataSource
      .getRepository(OrganizationMemberEntity)
      .findOne({
        where: { userId, status: OrganizationMemberStatus.Active },
        order: { createdAt: 'ASC' },
      });
    return member?.organizationId ?? null;
  }

  private async uniqueSlug(
    orgRepo: Repository<OrganizationEntity>,
    base: string,
  ): Promise<string> {
    let slug = base;
    let suffix = 1;
    while (await orgRepo.findOne({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  private toUserDto(u: UserEntity): UserDto {
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
}
