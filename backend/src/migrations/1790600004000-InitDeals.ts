import { MigrationInterface, QueryRunner } from 'typeorm';

/** Deals and pipelines (§6 of the spec): pipelines, pipeline_stages, deals. Plus FK leads.converted_deal_id → deals. */
export class InitDeals1790600004000 implements MigrationInterface {
  name = 'InitDeals1790600004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "pipelines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "position" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pipelines_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`CREATE INDEX "idx_pipelines_org" ON "pipelines" ("organization_id")`);

    await q.query(`
      CREATE TABLE "pipeline_stages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "pipeline_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "position" int NOT NULL DEFAULT 0,
        "probability" int NOT NULL DEFAULT 0,
        "is_won" boolean NOT NULL DEFAULT false,
        "is_lost" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pipeline_stages_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pipeline_stages_pipeline" FOREIGN KEY ("pipeline_id")
          REFERENCES "pipelines"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "idx_pipeline_stages_org_pipeline" ON "pipeline_stages" ("organization_id", "pipeline_id")`,
    );

    await q.query(`
      CREATE TABLE "deals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "pipeline_id" uuid NOT NULL,
        "stage_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "amount" numeric(18,2) NOT NULL DEFAULT 0,
        "currency" char(3),
        "contact_id" uuid,
        "company_id" uuid,
        "status" varchar(8) NOT NULL DEFAULT 'open',
        "expected_close_date" date,
        "closed_at" timestamptz,
        "lost_reason" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_deals_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_deals_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_deals_pipeline" FOREIGN KEY ("pipeline_id")
          REFERENCES "pipelines"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_deals_stage" FOREIGN KEY ("stage_id")
          REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_deals_contact" FOREIGN KEY ("contact_id")
          REFERENCES "contacts"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_deals_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_deals_org_pipeline_stage" ON "deals" ("organization_id", "pipeline_id", "stage_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_deals_org_owner_status" ON "deals" ("organization_id", "owner_id", "status")`,
    );

    // Deferred FK from the Leads module: converted_deal_id → deals.
    await q.query(`
      ALTER TABLE "leads" ADD CONSTRAINT "fk_leads_converted_deal"
        FOREIGN KEY ("converted_deal_id") REFERENCES "deals"("id") ON DELETE SET NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "fk_leads_converted_deal"`);
    await q.query(`DROP TABLE IF EXISTS "deals"`);
    await q.query(`DROP TABLE IF EXISTS "pipeline_stages"`);
    await q.query(`DROP TABLE IF EXISTS "pipelines"`);
  }
}
