export type Ok<T> = { ok: true; value: T };
export type Err<E extends string> = { ok: false; error: E; retryAfterSec?: number };
export type Result<T, E extends string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E extends string>(error: E, extra?: { retryAfterSec?: number }): Err<E> => ({
  ok: false,
  error,
  ...extra,
});
