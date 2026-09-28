import { MigrationInterface, QueryRunner } from 'typeorm';

/** RBAC (§6.4 of the spec): permissions, roles, role_permissions, user_roles. */
export class InitRbac1790600001000 implements MigrationInterface {
  name = 'InitRbac1790600001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "description" varchar(255)
      )
    `);
    await q.query(`CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions" ("code")`);

    await q.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" varchar(80) NOT NULL,
        "code" varchar(40) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "description" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_roles_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_roles_org_code" ON "roles" ("organization_id", "code")`,
    );

    await q.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_role_permissions_permission" FOREIGN KEY ("permission_id")
          REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    await q.query(`
      CREATE TABLE "user_roles" (
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id")
          REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_roles_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await q.query(
      `CREATE INDEX "idx_user_roles_org" ON "user_roles" ("organization_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "user_roles"`);
    await q.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await q.query(`DROP TABLE IF EXISTS "roles"`);
    await q.query(`DROP TABLE IF EXISTS "permissions"`);
  }
}
