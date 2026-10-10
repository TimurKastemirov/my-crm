/**
 * Pure helpers for reading list-page filter/pagination state out of URL query
 * params. Framework-free, mirroring the `core/http-error.ts` helper convention.
 */

/** Parses the `page` query param: a positive integer, defaulting to 1. */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Normalizes a free-text search query param. */
export function parseSearch(raw: string | null): string {
  return (raw ?? '').trim();
}

/** Returns the param only if it is one of the allowed enum values, otherwise '' (= no filter). */
export function parseEnumParam<T extends string>(raw: string | null, allowed: readonly T[]): T | '' {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : '';
}

/** Allowed sort directions, shared by the list pages. */
export const SORT_ORDERS = ['asc', 'desc'] as const;
