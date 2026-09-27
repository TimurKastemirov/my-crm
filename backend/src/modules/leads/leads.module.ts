import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { LeadEntity } from './entities/lead.entity.js';
import { ContactEntity } from '../contacts/entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { LeadsService } from './leads.service.js';
import { LeadsController } from './leads.controller.js';

@Module({
  imports: [
    SecurityModule,
    RbacModule,
    // Contact/Company — для проверки принадлежности связей организации.
    TypeOrmModule.forFeature([LeadEntity, ContactEntity, CompanyEntity]),
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
