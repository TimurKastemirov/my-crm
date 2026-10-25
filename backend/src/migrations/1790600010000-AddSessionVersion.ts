import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Immediate access-token revocation: access tokens carry the user's session version (`sv`);
 * changing the password or signing out everywhere bumps it, and the auth guard rejects tokens
 * issued with an older version. Existing tokens (no `sv`) count as version 0.
 */
export class AddSessionVersion1790600010000 implements MigrationInterface {
  name = 'AddSessionVersion1790600010000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN "session_version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "session_version"`,
    );
  }
}
