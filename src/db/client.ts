import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgAsyncDatabase<PgQueryResultHKT>;

/** Same folder Netlify applies on deploy, so local, test and production share one migration history. */
const MIGRATIONS = path.join(process.cwd(), "netlify", "database", "migrations");

/**
 * Which database to use:
 * - "memory": throwaway in-memory Postgres (tests)
 * - on Netlify (NETLIFY_DB_URL is set): Netlify Database; migrations are applied by the deploy
 * - unset or "pglite": embedded Postgres in ./.data/pglite (local dev)
 * - postgres://…: any other Postgres server
 */
export async function createDb(url: string | undefined, opts: { migrate?: boolean } = {}): Promise<DB> {
  if (url !== "memory" && process.env.NETLIFY_DB_URL) {
    const { drizzle } = await import("drizzle-orm/netlify-db");
    return drizzle({ casing: "snake_case" }) as unknown as DB;
  }

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
    const db = drizzle({ client, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    // Every driver shares the pg-core query builder; only the result type differs.
    return db as unknown as DB;
  }

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const db = drizzle({ client: postgres(url, { max: 10 }), casing: "snake_case" });
  if (opts.migrate) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS });
  }
  return db as unknown as DB;
}
