import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { CompanyEntity } from './entities/company.entity.js';
import { CompaniesService } from './companies.service.js';
import { CompaniesController } from './companies.controller.js';

@Module({
  imports: [SecurityModule, RbacModule, TypeOrmModule.forFeature([CompanyEntity])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
