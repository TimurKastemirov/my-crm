import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../security/security.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { ContactEntity } from './entities/contact.entity.js';
import { CompanyEntity } from '../companies/entities/company.entity.js';
import { ContactsService } from './contacts.service.js';
import { ContactsController } from './contacts.controller.js';

@Module({
  imports: [
    SecurityModule,
    RbacModule,
    // CompanyEntity — для проверки принадлежности companyId организации.
    TypeOrmModule.forFeature([ContactEntity, CompanyEntity]),
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
