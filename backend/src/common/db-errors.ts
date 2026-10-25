import { QueryFailedError } from 'typeorm';

const pgCode = (error: unknown) =>
  error instanceof QueryFailedError
    ? (error.driverError as { code?: string } | undefined)?.code
    : undefined;

/** PostgreSQL unique_violation (23505): a concurrent request inserted the same unique key first. */
export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === '23505';
}

/** PostgreSQL foreign_key_violation (23503): e.g. the referenced role was deleted concurrently. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgCode(error) === '23503';
}
