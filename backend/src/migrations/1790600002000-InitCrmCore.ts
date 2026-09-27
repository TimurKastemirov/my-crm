import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ядро CRM (§6 ТЗ): companies, contacts. */
export class InitCrmCore1790600002000 implements MigrationInterface {
  name = 'InitCrmCore1790600002000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "name" varchar(160) NOT NULL,
        "website" varchar(255),
        "industry" varchar(120),
        "size" varchar(60),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_companies_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_companies_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await q.query(
      `CREATE INDEX "idx_companies_org_owner" ON "companies" ("organization_id", "owner_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_companies_org_name" ON "companies" ("organization_id", "name")`,
    );

    await q.query(`
      CREATE TABLE "contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "company_id" uuid,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "email" varchar(255),
        "phone" varchar(40),
        "position" varchar(120),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_contacts_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_contacts_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_contacts_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_contacts_org_owner" ON "contacts" ("organization_id", "owner_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_contacts_org_company" ON "contacts" ("organization_id", "company_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "contacts"`);
    await q.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
