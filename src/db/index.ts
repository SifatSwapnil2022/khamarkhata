import "server-only";
import { createDb, type DB } from "./client";

/**
 * App-wide database handle.
 *
 * Local dev with PGlite migrates itself on first use so `npm run dev` works with no setup.
 * A real Postgres server is migrated explicitly with `npm run db:migrate`.
 */
const globalForDb = globalThis as unknown as { __khamarDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  globalForDb.__khamarDb ??= createDb(process.env.DATABASE_URL, {
    migrate: isEmbedded(process.env.DATABASE_URL),
  }).catch((error: unknown) => {
    // Don't cache a failed connection; the next request tries again.
    globalForDb.__khamarDb = undefined;
    throw error;
  });
  return globalForDb.__khamarDb;
}

function isEmbedded(url: string | undefined) {
  return !url || url === "pglite" || url === "memory";
}

export type { DB };
