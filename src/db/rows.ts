/** `db.execute()` returns an array of rows on some drivers and `{ rows }` on others. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

/** Dates come back as Date or "YYYY-MM-DD" depending on the driver; normalize to the string. */
export function isoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export const num = (value: unknown): number | null => (value == null ? null : Number(value));
