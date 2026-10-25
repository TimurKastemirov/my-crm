import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full-text search (§6.3 Search): each searchable table gets a generated `search_vector`
 * (`simple` configuration: same for ru/uk/en, no stemming) with a GIN index. Queries match
 * word prefixes (`term:*`), see common/search.ts. The column is maintained by PostgreSQL and
 * is not mapped in the entities (only its index is declared there, unmanaged).
 */

/**
 * Punctuation becomes a space before parsing, exactly as the query side splits words: otherwise
 * the parser keeps "booking.com", "jean-paul", "2.5" or dates as single tokens that no typed
 * word can prefix. [[:punct:]] only touches punctuation, never letters (Cyrillic included).
 */
const words = (column: string) =>
  `regexp_replace(coalesce(${column}, ''), '[[:punct:]]', ' ', 'g')`;

const SEARCH_VECTOR: Record<string, string> = {
  // The phone is indexed as digits only, so "+380 (50) 123" and "38050123" both find it.
  contacts: `to_tsvector('simple',
      ${words('first_name')} || ' ' || ${words('last_name')} || ' ' || ${words('email')} || ' ' ||
      regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'))`,
  companies: `to_tsvector('simple',
      ${words('name')} || ' ' || ${words('website')} || ' ' || ${words('industry')})`,
  leads: `to_tsvector('simple', ${words('source')})`,
  deals: `to_tsvector('simple', ${words('title')})`,
};

export class AddSearchVector1790600009000 implements MigrationInterface {
  name = 'AddSearchVector1790600009000';

  public async up(q: QueryRunner): Promise<void> {
    for (const [table, expression] of Object.entries(SEARCH_VECTOR)) {
      await q.query(
        `ALTER TABLE "${table}" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (${expression}) STORED`,
      );
      await q.query(
        `CREATE INDEX "idx_${table}_search" ON "${table}" USING gin ("search_vector")`,
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of Object.keys(SEARCH_VECTOR)) {
      await q.query(`DROP INDEX IF EXISTS "idx_${table}_search"`);
      await q.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "search_vector"`,
      );
    }
  }
}
