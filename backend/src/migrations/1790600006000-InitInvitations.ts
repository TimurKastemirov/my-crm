import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organization invitations (§6.3 Organizations & members): a one-time link the inviter
 * shares manually (email delivery is out of scope for v1). Only the token hash is stored.
 */
export class InitInvitations1790600006000 implements MigrationInterface {
  name = 'InitInvitations1790600006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "organization_invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "role_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "invited_by_id" uuid,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_org_invitations_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_org_invitations_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_org_invitations_inviter" FOREIGN KEY ("invited_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_org_invitations_token" ON "organization_invitations" ("token_hash")`,
    );
    // At most one pending invitation per email within an organization.
    await q.query(
      `CREATE UNIQUE INDEX "uq_org_invitations_pending" ON "organization_invitations" ("organization_id", "email")
        WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "organization_invitations"`);
  }
}
