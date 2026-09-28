import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial authentication/multi-tenancy schema (§5 of the spec):
 * organizations, users, organization_members, refresh_tokens.
 */
export class InitAuth1790600000000 implements MigrationInterface {
  name = 'InitAuth1790600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await q.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_organizations_slug" ON "organizations" ("slug")`,
    );

    await q.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "first_name" varchar(100) NOT NULL,
        "last_name" varchar(100) NOT NULL,
        "avatar_url" varchar(512),
        "timezone" varchar(64) NOT NULL DEFAULT 'UTC',
        "locale" varchar(10) NOT NULL DEFAULT 'ru',
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await q.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);

    await q.query(`
      CREATE TABLE "organization_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "invited_by_id" uuid,
        "joined_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_org_members_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_org_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_org_members_inviter" FOREIGN KEY ("invited_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_org_members_org_user" ON "organization_members" ("organization_id", "user_id")`,
    );

    await q.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "token_hash" varchar(64) NOT NULL,
        "family_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "user_agent" varchar(256),
        "ip" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`,
    );
    await q.query(
      `CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await q.query(`DROP TABLE IF EXISTS "organization_members"`);
    await q.query(`DROP TABLE IF EXISTS "users"`);
    await q.query(`DROP TABLE IF EXISTS "organizations"`);
  }
}
