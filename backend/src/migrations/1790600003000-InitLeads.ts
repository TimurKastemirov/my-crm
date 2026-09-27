import { MigrationInterface, QueryRunner } from 'typeorm';

/** Лиды (§6 ТЗ). FK на deals добавится вместе с модулем Deals. */
export class InitLeads1790600003000 implements MigrationInterface {
  name = 'InitLeads1790600003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "source" varchar(80),
        "status" varchar(16) NOT NULL DEFAULT 'new',
        "contact_id" uuid,
        "company_id" uuid,
        "estimated_value" numeric(18,2),
        "currency" char(3),
        "converted_deal_id" uuid,
        "lost_reason" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_leads_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_leads_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_leads_contact" FOREIGN KEY ("contact_id")
          REFERENCES "contacts"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_leads_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_leads_org_owner" ON "leads" ("organization_id", "owner_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_leads_org_status" ON "leads" ("organization_id", "status")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "leads"`);
  }
}
