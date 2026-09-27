import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { PipelineEntity } from './entities/pipeline.entity.js';
import { PipelineStageEntity } from './entities/pipeline-stage.entity.js';
import { DealEntity } from './entities/deal.entity.js';
import { ContactEntity } from '../contacts/entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { PipelinesService } from './pipelines.service.js';
import { DealsService } from './deals.service.js';
import { PipelinesController } from './pipelines.controller.js';
import { DealsController } from './deals.controller.js';

@Module({
  imports: [
    SecurityModule,
    RbacModule,
    TypeOrmModule.forFeature([
      PipelineEntity,
      PipelineStageEntity,
      DealEntity,
      ContactEntity,
      CompanyEntity,
    ]),
  ],
  controllers: [PipelinesController, DealsController],
  providers: [PipelinesService, DealsService],
  exports: [PipelinesService, DealsService],
})
export class DealsModule {}
