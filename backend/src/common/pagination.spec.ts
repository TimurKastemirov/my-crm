import { describe, expect, it } from 'vitest';
import { normalizePagination, resolveSort, toPaginated } from './pagination.js';

describe('pagination', () => {
  it('normalizePagination: дефолты и клип лимита', () => {
    expect(normalizePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(normalizePagination({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(normalizePagination({ limit: 999 }).limit).toBe(100); // MAX_PAGE_SIZE
    expect(normalizePagination({ page: 0 }).page).toBe(1);
  });

  it('toPaginated: считает hasNext', () => {
    expect(toPaginated([1, 2], 5, 1, 2).meta).toEqual({ page: 1, limit: 2, total: 5, hasNext: true });
    expect(toPaginated([1], 5, 3, 2).meta.hasNext).toBe(false);
  });

  it('resolveSort: только из белого списка', () => {
    expect(resolveSort('name', ['createdAt', 'name'], 'createdAt')).toBe('name');
    expect(resolveSort('hacky; DROP', ['createdAt', 'name'], 'createdAt')).toBe('createdAt');
    expect(resolveSort(undefined, ['createdAt'], 'createdAt')).toBe('createdAt');
  });
});
