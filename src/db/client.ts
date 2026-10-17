import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgAsyncDatabase<PgQueryResultHKT>;

/** Same folder Netlify applies on deploy, so local, test and production share one migration history. */
export const MIGRATIONS_DIR = path.join(process.cwd(), "netlify", "database", "migrations");

type NetlifyGlobal = { Netlify?: { env?: { get(key: string): string | undefined } } };

/**
 * Netlify exposes runtime variables through `Netlify.env`, which is not always mirrored into
 * `process.env` inside the Next.js server handler, so check both.
 */
function netlifyEnv(key: string): string | undefined {
  return (globalThis as NetlifyGlobal).Netlify?.env?.get(key) ?? process.env[key];
}

function runningOnNetlify() {
  return Boolean((globalThis as NetlifyGlobal).Netlify) || process.env.NETLIFY === "true" || Boolean(process.env.SITE_ID);
}

/** Serverless hosts (Netlify, Vercel) have a read-only filesystem and many short-lived instances. */
function runningServerless() {
  return runningOnNetlify() || Boolean(process.env.VERCEL);
}

/**
 * Which database to use:
 * - "memory": throwaway in-memory Postgres (tests)
 * - Netlify Database when NETLIFY_DB_URL is available; migrations are applied by the deploy
 * - postgres://…: any other Postgres server, e.g. Neon on Vercel
 * - unset or "pglite": embedded Postgres in ./.data/pglite (local dev only — never on Netlify,
 *   where the filesystem is read-only and every function instance would get its own database)
 */
export async function createDb(
  url: string | undefined,
  opts: { migrate?: boolean; migrationsFolder?: string } = {},
): Promise<DB> {
  const MIGRATIONS = opts.migrationsFolder ?? MIGRATIONS_DIR;
  if (url !== "memory" && netlifyEnv("NETLIFY_DB_URL")) {
    const { getDatabase } = await import("@netlify/database");
    const { drizzle } = await import("drizzle-orm/netlify-db");
    // getDatabase picks the right driver (serverless or server) and database branch for this deploy.
    return drizzle({ client: getDatabase(), casing: "snake_case" }) as unknown as DB;
  }

  if (url && url.startsWith("postgres")) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // On serverless each instance keeps one connection; through a pooler (Neon's "-pooler" host,
    // PgBouncer in transaction mode) prepared statements must be off.
    const serverless = runningServerless();
    const client = postgres(url, {
      max: serverless ? 1 : 10,
      prepare: !url.includes("-pooler"),
      idle_timeout: serverless ? 20 : undefined,
      connect_timeout: 15,
      onnotice: () => {},
    });
    const db = drizzle({ client, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    return db as unknown as DB;
  }

  if (url !== "memory" && runningServerless()) {
    throw new Error(
      runningOnNetlify()
        ? "No database configured: NETLIFY_DB_URL is not available. Check that Netlify Database is enabled for this project."
        : "No database configured: set DATABASE_URL to a postgres:// connection string (for example from Neon).",
    );
  }

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
    // Embedded Postgres has no autovacuum, so collect planner statistics after loading data.
    await client.exec("analyze");
  }
  // Every driver shares the pg-core query builder; only the result type differs.
  return db as unknown as DB;
}
