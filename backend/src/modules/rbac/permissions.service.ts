import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ALL_PERMISSIONS } from '@crm/shared';
import { PermissionEntity } from './entities/permission.entity.js';

@Injectable()
export class PermissionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repo: Repository<PermissionEntity>,
  ) {}

  /** Idempotently syncs the permission catalog with the codes from @crm/shared on startup. */
  async onApplicationBootstrap(): Promise<void> {
    const values = ALL_PERMISSIONS.map((code) => ({ code }));
    await this.repo
      .createQueryBuilder()
      .insert()
      .values(values)
      .orIgnore()
      .execute();
    this.logger.log(`Permission catalog synced: ${values.length} codes`);
  }

  list(): Promise<PermissionEntity[]> {
    return this.repo.find({ order: { code: 'ASC' } });
  }
}
