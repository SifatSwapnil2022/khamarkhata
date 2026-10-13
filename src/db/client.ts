import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * DATABASE_URL:
 * - unset or "pglite": embedded Postgres stored in ./.data/pglite (local dev)
 * - "memory": throwaway in-memory Postgres (tests)
 * - postgres://…: a real server
 */
export async function createDb(url: string | undefined, opts: { migrate?: boolean } = {}): Promise<DB> {
  if (!url || url === "pglite" || url === "memory") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    let client: InstanceType<typeof PGlite>;
    if (url === "memory") {
      client = new PGlite();
    } else {
      const dir = path.join(process.cwd(), ".data", "pglite");
      await mkdir(path.dirname(dir), { recursive: true });
      client = new PGlite(dir);
    }
    const db = drizzle({ client, schema, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    // Both drivers share the pg-core query builder; only the result type differs.
    return db as unknown as DB;
  }

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = postgres(url, { max: 10 });
  const db = drizzle({ client, schema, casing: "snake_case" });
  if (opts.migrate) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS });
  }
  return db as unknown as DB;
}
