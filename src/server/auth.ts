import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import type { Role } from "@/db/schema";
import { can, type Permission } from "@/lib/rbac";
import { listUserFarms } from "./farms";
import { findSession, SESSION_COOKIE } from "./sessions";
import { pendingInvitesFor } from "./team";

export const getSessionToken = async () => (await cookies()).get(SESSION_COOKIE)?.value ?? null;

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = await getSessionToken();
  if (!token) return null;
  const db = await getDb();
  const row = await findSession(db, token);
  return row ? { ...row, token } : null;
});

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

/**
 * The farm this request acts on. Falls back to the user's first farm when the session has none.
 * Sends users without a farm to their invites or to onboarding.
 */
export const requireFarm = cache(async () => {
  const current = await requireUser();
  const db = await getDb();
  const farms = await listUserFarms(db, current.user.id);

  if (farms.length === 0) {
    const pending = await pendingInvitesFor(db, current.user.phone);
    redirect(pending.length > 0 ? "/invites" : "/onboarding");
  }

  const active = farms.find((f) => f.farm.id === current.session.activeFarmId) ?? farms[0]!;
  return {
    user: current.user,
    token: current.token,
    farm: active.farm,
    role: active.role as Role,
    farms,
  };
});

export type FarmContext = Awaited<ReturnType<typeof requireFarm>>;

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

/** For server actions: resolves the farm and throws unless the role has the permission. */
export async function requirePermission(permission: Permission) {
  const ctx = await requireFarm();
  if (!can(ctx.role, permission)) throw new ForbiddenError();
  return { ...ctx, actor: { userId: ctx.user.id, farmId: ctx.farm.id, role: ctx.role } };
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Accepts only same-site relative paths, so ?next= can't redirect off-site. */
export function safeNext(next: unknown, fallback = "/app") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
