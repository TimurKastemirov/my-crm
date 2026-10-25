import { QueryFailedError } from 'typeorm';

/** PostgreSQL unique_violation (23505): a concurrent request inserted the same unique key first. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === '23505'
  );
}
