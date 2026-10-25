import { Raw } from 'typeorm';

const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 64;
/** A word made only of digits and phone punctuation: "+380", "(50)", "123-45-67". */
const PHONE_PART = /^[+()\d.-]+$/;

/** tsquery texts for the `simple` configuration: every word required, or any word. */
export interface SearchQuery {
  /** "ivan:* & pet:*" — the real condition. */
  all: string;
  /** "ivan:* | pet:*" — index-friendly pre-filter for searches spanning several tables. */
  any: string;
}

/**
 * Search input → prefix tsqueries ("Ivan  pet" → all: "ivan:* & pet:*"). Words are split on
 * anything that is not a letter, mark or digit — the same way the indexed text is split
 * (see the AddSearchVector migration). With `phone`, adjacent phone-like words are joined into
 * one digit string ("+380 (50) 123" → "38050123:*"), because phones are indexed as digits only.
 * Only letters, marks and digits reach the query, so input can't break tsquery syntax.
 * Returns null when nothing searchable is left.
 */
export function toSearchQuery(
  raw: string | undefined,
  options: { phone?: boolean } = {},
): SearchQuery | null {
  const tokens: string[] = [];
  let digits = '';
  const flushDigits = () => {
    if (digits) tokens.push(digits);
    digits = '';
  };
  // NFC: "й" typed as "и" + combining breve must stay one letter.
  for (const word of (raw ?? '').normalize('NFC').trim().split(/\s+/)) {
    if (options.phone && PHONE_PART.test(word) && /\d/.test(word)) {
      digits += word.replace(/\D/g, '');
      continue;
    }
    flushDigits();
    tokens.push(...(word.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []));
  }
  flushDigits();

  const unique = [
    ...new Set(tokens.map((t) => [...t].slice(0, MAX_TOKEN_LENGTH).join(''))),
  ].slice(0, MAX_TOKENS);
  if (!unique.length) return null;
  const prefixes = unique.map((t) => `${t}:*`);
  return { all: prefixes.join(' & '), any: prefixes.join(' | ') };
}

/**
 * `id IN (<subquery>)` filter for FindOptionsWhere. The subquery may use `:searchOrg`,
 * `:searchQuery` (every word) and `:searchAny` (any word).
 */
export function searchIdsIn(
  subquery: string,
  organizationId: string,
  query: SearchQuery,
) {
  return Raw((alias) => `${alias} IN (${subquery})`, {
    searchOrg: organizationId,
    searchQuery: query.all,
    searchAny: query.any,
  });
}

/** Records of `table` whose own words match (GIN index on `search_vector`). */
export function ownMatchSubquery(table: 'contacts' | 'companies'): string {
  return `SELECT id FROM "${table}"
           WHERE organization_id = :searchOrg
             AND search_vector @@ to_tsquery('simple', :searchQuery)`;
}

/**
 * Records of `table` (leads/deals) matching their own words together with those of the linked
 * contact and company — "ivan acme" finds a deal whose contact is Ivan at Acme.
 * Candidates come from three GIN-indexed lookups (own text, contact, company — any word);
 * only those are re-checked for all words on the combined text.
 */
export function linkedMatchSubquery(table: 'leads' | 'deals'): string {
  return `SELECT t.id FROM "${table}" t
            LEFT JOIN contacts c
              ON c.id = t.contact_id AND c.organization_id = t.organization_id AND c.deleted_at IS NULL
            LEFT JOIN companies co
              ON co.id = t.company_id AND co.organization_id = t.organization_id AND co.deleted_at IS NULL
           WHERE t.organization_id = :searchOrg
             AND t.id IN (
               SELECT id FROM "${table}"
                WHERE organization_id = :searchOrg
                  AND search_vector @@ to_tsquery('simple', :searchAny)
               UNION
               SELECT x.id FROM "${table}" x
                 JOIN contacts xc ON xc.id = x.contact_id
                WHERE x.organization_id = :searchOrg AND xc.organization_id = :searchOrg
                  AND xc.deleted_at IS NULL
                  AND xc.search_vector @@ to_tsquery('simple', :searchAny)
               UNION
               SELECT y.id FROM "${table}" y
                 JOIN companies yc ON yc.id = y.company_id
                WHERE y.organization_id = :searchOrg AND yc.organization_id = :searchOrg
                  AND yc.deleted_at IS NULL
                  AND yc.search_vector @@ to_tsquery('simple', :searchAny)
             )
             AND (t.search_vector
                  || coalesce(c.search_vector, ''::tsvector)
                  || coalesce(co.search_vector, ''::tsvector)) @@ to_tsquery('simple', :searchQuery)`;
}

/** Escapes LIKE wildcards so "%" or "_" in user input are matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
