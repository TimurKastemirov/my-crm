import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New accounts default to English (the product's fallback language) instead of Russian.
 * Existing users keep their saved language.
 */
export class DefaultLocaleEn1790600007000 implements MigrationInterface {
  name = 'DefaultLocaleEn1790600007000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'en'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'ru'`);
  }
}
