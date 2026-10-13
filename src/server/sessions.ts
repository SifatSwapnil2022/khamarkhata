import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { DB } from "@/db/client";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "kk_session";
export const SESSION_TTL_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: DB, userId: string, opts: { userAgent?: string | null; activeFarmId?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    userAgent: opts.userAgent?.slice(0, 300) ?? null,
    activeFarmId: opts.activeFarmId ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function findSession(db: DB, token: string) {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: DB, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function setActiveFarm(db: DB, token: string, farmId: string | null) {
  await db.update(sessions).set({ activeFarmId: farmId }).where(eq(sessions.id, hashToken(token)));
}
