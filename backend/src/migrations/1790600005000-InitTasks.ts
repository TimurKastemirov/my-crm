import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tasks (§6 of the spec): tasks. */
export class InitTasks1790600005000 implements MigrationInterface {
  name = 'InitTasks1790600005000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "owner_id" uuid NOT NULL,
        "assignee_id" uuid,
        "title" varchar(200) NOT NULL,
        "description" text,
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "priority" varchar(8) NOT NULL DEFAULT 'normal',
        "due_at" timestamptz,
        "completed_at" timestamptz,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "fk_tasks_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_tasks_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_tasks_assignee" FOREIGN KEY ("assignee_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_tasks_org_assignee_status" ON "tasks" ("organization_id", "assignee_id", "status")`,
    );
    await q.query(
      `CREATE INDEX "idx_tasks_org_due" ON "tasks" ("organization_id", "due_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "tasks"`);
  }
}
