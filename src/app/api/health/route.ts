import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

type NetlifyGlobal = { Netlify?: { env?: { get(key: string): string | undefined } } };

/** Strips connection strings and hostnames so the error is safe to show publicly. */
function sanitize(message: string) {
  return message
    .replace(/postgres(ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/[a-z0-9-]+(\.[a-z0-9-]+)*\.(neon\.tech|netlify\.app|netlify\.com|aws\.neon\.build)/gi, "[host]")
    .slice(0, 500);
}

/**
 * Deployment check: which settings the server can see (true/false only, never values)
 * and whether a trivial database query works.
 */
export async function GET() {
  const g = globalThis as NetlifyGlobal;
  const env = {
    netlifyGlobal: Boolean(g.Netlify),
    dbUrlViaNetlifyEnv: Boolean(g.Netlify?.env?.get("NETLIFY_DB_URL")),
    dbUrlViaProcessEnv: Boolean(process.env.NETLIFY_DB_URL),
    dbDriver: g.Netlify?.env?.get("NETLIFY_DB_DRIVER") ?? process.env.NETLIFY_DB_DRIVER ?? null,
    otpSecretSet: (process.env.OTP_SECRET?.length ?? 0) >= 32,
    demoMode: process.env.DEMO_MODE === "true",
    node: process.version,
  };

  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const res = (await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
    )) as unknown as { rows?: { n: number }[] } | { n: number }[];
    const rows = Array.isArray(res) ? res : (res.rows ?? []);
    return Response.json({ ok: true, env, db: { ok: true, tables: rows[0]?.n ?? null } });
  } catch (error) {
    const e = error as Error & { code?: string; cause?: { message?: string } };
    return Response.json(
      {
        ok: false,
        env,
        db: {
          ok: false,
          name: e.name,
          code: e.code ?? null,
          message: sanitize(String(e.message)),
          cause: e.cause?.message ? sanitize(String(e.cause.message)) : null,
        },
      },
      { status: 500 },
    );
  }
}
