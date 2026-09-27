import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Paginated,
  type PaginationQuery,
} from '@crm/shared';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

/** Нормализует page/limit из query (клипует лимит до MAX_PAGE_SIZE). */
export function normalizePagination(query: PaginationQuery): NormalizedPagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.limit) || DEFAULT_PAGE_SIZE),
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function toPaginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return { data, meta: { page, limit, total, hasNext: page * limit < total } };
}

/**
 * Возвращает безопасное поле сортировки из белого списка (защита от SQL-инъекций через sortBy).
 */
export function resolveSort(
  sortBy: string | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  return sortBy && allowed.includes(sortBy) ? sortBy : fallback;
}
