import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { FarmSettings, Role } from "@/db/schema";
import { can } from "@/lib/rbac";
import { herdBreeding } from "./breeding";
import { addDays, bdToday } from "./common";
import { dairyOverview, listBuyers, sessionsRecorded } from "./dairy";
import { financeSummary } from "./finance";
import { activeWithdrawals, dueList } from "./health";
import { farmInquiries } from "./market";
import { fatteningBoard } from "./qurbani";

export type AttentionKind =
  | "milk_missing"
  | "vaccines_overdue"
  | "withdrawal"
  | "breeding_overdue"
  | "milk_drops"
  | "bulls_behind"
  | "buyer_dues"
  | "inquiries";

export type AttentionItem = { kind: AttentionKind; count: number; href: string; extra?: string };

/**
 * The overview: what needs doing, worked out from each section's records. Only sections the
 * person's role can open contribute, so a worker isn't shown buyer dues they can't act on.
 */
export async function overview(db: DB, farmId: string, role: Role, settings: FarmSettings) {
  const today = bdToday();
  const sees = {
    milk: can(role, "milk.record") || can(role, "milk.sales"),
    sales: can(role, "milk.sales"),
    breeding: can(role, "breeding.observe") || can(role, "breeding.record"),
    qurbani: can(role, "weight.record") || can(role, "finance.view"),
    market: can(role, "listing.manage"),
    money: can(role, "finance.view"),
  };
  const [dairy, recorded, due, wds, breeding, board, buyers, inquiries, money] = await Promise.all([
    sees.milk ? dairyOverview(db, farmId, 14) : null,
    can(role, "milk.record") ? sessionsRecorded(db, farmId, today) : null,
    dueList(db, farmId),
    activeWithdrawals(db, farmId),
    sees.breeding ? herdBreeding(db, farmId, settings) : null,
    sees.qurbani ? fatteningBoard(db, farmId) : null,
    sees.sales ? listBuyers(db, farmId) : null,
    sees.market ? farmInquiries(db, farmId) : null,
    sees.money ? financeSummary(db, farmId, addDays(today, -29), today) : null,
  ]);

  const items: AttentionItem[] = [];
  const hour = new Date(Date.now() + 6 * 3_600_000).getUTCHours();
  if (recorded && dairy && dairy.daily.some((d) => d.cows > 0)) {
    const missing = hour >= 17 && !recorded.pm ? "pm" : hour >= 6 && !recorded.am ? "am" : null;
    if (missing) items.push({ kind: "milk_missing", count: 1, href: `/app/dairy/record?date=${today}&session=${missing}`, extra: missing });
  }
  const overdue = due.items.filter((i) => i.overdueDays > 0);
  if (overdue.length) items.push({ kind: "vaccines_overdue", count: new Set(overdue.map((i) => i.animalId)).size, href: "/app/health" });
  if (wds.length) items.push({ kind: "withdrawal", count: wds.length, href: "/app/health" });
  if (breeding) {
    const late = breeding.cows.filter((c) => c.next && c.next.date < breeding.today && c.next.type !== "heat_watch");
    if (late.length) items.push({ kind: "breeding_overdue", count: late.length, href: "/app/breeding" });
  }
  if (dairy?.drops.length) items.push({ kind: "milk_drops", count: dairy.drops.length, href: "/app/dairy" });
  if (board) {
    const behind = board.bulls.filter((b) => b.status === "behind").length;
    if (behind) items.push({ kind: "bulls_behind", count: behind, href: "/app/qurbani?f=behind" });
  }
  if (buyers) {
    const due = buyers.reduce((s, b) => s + b.dueTk, 0);
    if (due > 0) items.push({ kind: "buyer_dues", count: due, href: "/app/dairy/sales" });
  }
  if (inquiries) {
    const fresh = inquiries.filter((i) => i.status === "new").length;
    if (fresh) items.push({ kind: "inquiries", count: fresh, href: "/app/market?tab=inbox" });
  }

  const upcoming = breeding
    ? breeding.cows
        .filter((c) => c.next && c.next.date >= today && c.next.date <= addDays(today, 7) && c.next.type !== "open_long")
        .sort((a, b) => a.next!.date.localeCompare(b.next!.date))
        .slice(0, 6)
    : [];

  return { today, dairy, money, upcoming, items, refDay: breeding?.today ?? dairy?.end ?? today };
}

export type ActivityRow = { id: string; who: string; action: string; data: Record<string, unknown> | null; at: string };

/** Who recorded what, most recent first. */
export async function recentActivity(db: DB, farmId: string, limit = 8): Promise<ActivityRow[]> {
  const res = await db.execute(sql`
    select l.id, l.action, l.data, l.created_at, coalesce(u.name, u.phone, '—') as who
    from audit_logs l left join users u on u.id = l.actor_id
    where l.farm_id = ${farmId}
    order by l.created_at desc limit ${limit}
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    who: String(r.who),
    action: String(r.action),
    data: (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as Record<string, unknown> | null,
    at: new Date(String(r.created_at)).toISOString(),
  }));
}
