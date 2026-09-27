import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Справочник прав (dot-notation: contacts.read, deals.create, ...). Глобальный, не per-org. */
@Entity('permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_permissions_code', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;
}
