import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, rowsOf } from "@/db/rows";
import { auditLogs, type Role } from "@/db/schema";

export type Actor = { userId: string; farmId: string; role: Role };
export type FieldErrors = Record<string, string>;

export async function audit(db: DB, actor: Actor, action: string, entityType: string, entityId: string, data?: unknown) {
  await db.insert(auditLogs).values({ farmId: actor.farmId, actorId: actor.userId, action, entityType, entityId, data: data ?? null });
}

export function zodFields(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message;
  return fields;
}

/**
 * The reference "today" for a farm: its latest milk record, or the calendar date when there is none.
 * Keeps the demo farm (frozen on 13 Oct 2026) and live farms consistent.
 */
export const refDateSql = (farmId: string) =>
  sql`(select coalesce((select max(date) from milk_records where farm_id = ${farmId}), current_date))`;

export async function refDay(db: DB, farmId: string): Promise<string> {
  const r = rowsOf<{ d: unknown }>(await db.execute(sql`select ${refDateSql(farmId)} as d`))[0];
  return isoDate(r?.d) ?? new Date().toISOString().slice(0, 10);
}

/** Today in Bangladesh (UTC+6) as YYYY-MM-DD. */
export function bdToday() {
  return new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(isoDay: string, days: number) {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

export const isoDay = /^\d{4}-\d{2}-\d{2}$/;
