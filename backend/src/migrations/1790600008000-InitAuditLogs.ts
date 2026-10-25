import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit log of key operations (§5.3 / §6.3): sign-in, access control changes, deletions.
 * Append-only: a trigger rejects UPDATE/DELETE/TRUNCATE. No FKs, so entries outlive
 * the users and records they mention.
 */
export class InitAuditLogs1790600008000 implements MigrationInterface {
  name = 'InitAuditLogs1790600008000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "actor_id" uuid,
        "action" varchar(64) NOT NULL,
        "entity_type" varchar(40),
        "entity_id" uuid,
        "ip" varchar(64),
        "user_agent" varchar(256),
        "before" jsonb,
        "after" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs" ("organization_id", "created_at" DESC)`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_logs_org_action" ON "audit_logs" ("organization_id", "action", "created_at" DESC)`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_logs_org_actor" ON "audit_logs" ("organization_id", "actor_id", "created_at" DESC)`,
    );
    await q.query(
      `CREATE INDEX "idx_audit_logs_org_entity" ON "audit_logs" ("organization_id", "entity_type", "entity_id")`,
    );
    await q.query(`
      CREATE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END
      $$ LANGUAGE plpgsql
    `);
    await q.query(`
      CREATE TRIGGER "trg_audit_logs_append_only"
        BEFORE UPDATE OR DELETE ON "audit_logs"
        FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()
    `);
    await q.query(`
      CREATE TRIGGER "trg_audit_logs_no_truncate"
        BEFORE TRUNCATE ON "audit_logs"
        FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()
    `);
  }

  /** Reverting would silently destroy the audit history, so it is refused; remove it by hand if really intended. */
  public async down(_q: QueryRunner): Promise<void> {
    throw new Error(
      'InitAuditLogs cannot be reverted: it would delete the append-only audit log. Remove it manually if intended.',
    );
  }
}
