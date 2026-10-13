import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { buyers, milkRecords, milkSales } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok, type Result } from "@/lib/result";
import { addDays, audit, isoDay, refDay, zodFields, type Actor, type FieldErrors } from "./common";

const n0 = (v: unknown) => num(v) ?? 0;

/* ───────────────────────── Daily milk entry ───────────────────────── */

export type MilkSession = "am" | "pm";

export type MilkSheetRow = {
  id: string;
  tag: string;
  name: string | null;
  nameBn: string | null;
  shed: string | null;
  /** In milk: calved since its last dry-off. Dry cows are listed separately but can still be recorded. */
  milking: boolean;
  /** Litres already recorded for this date and session. */
  litres: number | null;
  /** Average for the same session over the 7 days before, as a guide while typing. */
  usual: number | null;
  /** Milk withdrawal (after antibiotics) runs through this date: record it, but it can't be sold. */
  withdrawalUntil: string | null;
};

/** Every active milk cow with what's recorded for one milking, plus the context needed to enter it. */
export async function milkSheet(db: DB, farmId: string, date: string, session: MilkSession): Promise<MilkSheetRow[]> {
  const res = await db.execute(sql`
    with cows as (
      select a.id, a.tag, a.name, a.name_bn, s.name as shed
      from animals a left join sheds s on s.id = a.shed_id
      where a.farm_id = ${farmId} and a.lifecycle = 'active' and a.purpose = 'dairy' and a.sex = 'female'
    ),
    cycle as (
      select b.animal_id,
        max(b.date) filter (where b.type = 'calving') as calved,
        -- dried off today still counts as milking today
        max(b.date) filter (where b.type = 'dry_off' and b.date < ${date}::date) as dried
      from breeding_events b
      where b.farm_id = ${farmId} and b.date <= ${date}::date
      group by b.animal_id
    ),
    usual as (
      select animal_id, avg(litres)::float as avg
      from milk_records
      where farm_id = ${farmId} and session = ${session}::milk_session
        and date between ${date}::date - 7 and ${date}::date - 1
      group by animal_id
    ),
    wd as (
      select animal_id, max(milk_withdrawal_until) as until
      from health_events
      where farm_id = ${farmId} and milk_withdrawal_until >= ${date}::date and date <= ${date}::date
      group by animal_id
    )
    select c.*, m.litres::float as litres, u.avg as usual, wd.until::text as withdrawal_until,
      case
        when cy.calved is null and cy.dried is null then true
        when cy.dried is null then true
        when cy.calved is null then false
        else cy.calved > cy.dried
      end as milking
    from cows c
    left join cycle cy on cy.animal_id = c.id
    left join usual u on u.animal_id = c.id
    left join wd on wd.animal_id = c.id
    left join milk_records m on m.animal_id = c.id and m.date = ${date}::date and m.session = ${session}::milk_session
    order by c.shed nulls last, c.tag
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    nameBn: (r.name_bn as string | null) ?? null,
    shed: (r.shed as string | null) ?? null,
    milking: Boolean(r.milking),
    litres: r.litres === null || r.litres === undefined ? null : Number(r.litres),
    usual: r.usual === null || r.usual === undefined ? null : Math.round(Number(r.usual) * 10) / 10,
    withdrawalUntil: isoDate(r.withdrawal_until),
  }));
}

const milkInput = z.object({
  date: z.string().regex(isoDay, "date"),
  session: z.enum(["am", "pm"]),
  entries: z
    .array(
      z.object({
        animalId: z.string().uuid(),
        /** null clears a reading entered by mistake */
        litres: z.number().min(0, "range").max(60, "range").nullable(),
      }),
    )
    .max(2000),
});
export type MilkInput = z.input<typeof milkInput>;

/**
 * Saves a milking. Idempotent: the same submission can be replayed from the offline queue and
 * gives the same result. Withdrawal is decided here from health records, never by the client.
 */
export async function saveMilk(
  db: DB,
  actor: Actor,
  input: MilkInput,
  today: string,
): Promise<Result<{ saved: number; cleared: number; withheld: number }, "forbidden" | "invalid" | "future"> & { fields?: FieldErrors }> {
  if (!can(actor.role, "milk.record")) return err("forbidden");
  const parsed = milkInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid"), fields: zodFields(parsed.error) };
  const { date, session, entries } = parsed.data;
  if (date > today) return err("future");
  if (entries.length === 0) return ok({ saved: 0, cleared: 0, withheld: 0 });

  // Only this farm's active milk cows may be written to.
  const sheet = await milkSheet(db, actor.farmId, date, session);
  const cows = new Map(sheet.map((c) => [c.id, c]));
  const valid = entries.filter((e) => cows.has(e.animalId));
  const toSave = valid.filter((e) => e.litres !== null && e.litres > 0);
  const toClear = valid.filter((e) => e.litres === null || e.litres === 0);

  if (toSave.length) {
    await db
      .insert(milkRecords)
      .values(
        toSave.map((e) => ({
          farmId: actor.farmId,
          animalId: e.animalId,
          date,
          session,
          litres: e.litres!.toFixed(2),
          underWithdrawal: Boolean(cows.get(e.animalId)!.withdrawalUntil),
          recordedById: actor.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [milkRecords.animalId, milkRecords.date, milkRecords.session],
        set: {
          litres: sql`excluded.litres`,
          underWithdrawal: sql`excluded.under_withdrawal`,
          recordedById: sql`excluded.recorded_by_id`,
        },
      });
  }
  for (const e of toClear) {
    await db
      .delete(milkRecords)
      .where(
        and(
          eq(milkRecords.farmId, actor.farmId),
          eq(milkRecords.animalId, e.animalId),
          eq(milkRecords.date, date),
          eq(milkRecords.session, session),
        ),
      );
  }
  const withheld = toSave.filter((e) => cows.get(e.animalId)!.withdrawalUntil).length;
  await audit(db, actor, "milk.record", "milk_day", `${date}:${session}`, { saved: toSave.length, cleared: toClear.length });
  return ok({ saved: toSave.length, cleared: toClear.length, withheld });
}

/* ───────────────────────── Dashboard ───────────────────────── */

export type DairyDay = { date: string; am: number; pm: number; withheld: number; cows: number };

export async function dairyOverview(db: DB, farmId: string, days = 30) {
  const end = await refDay(db, farmId);
  const start = addDays(end, -(days - 1));
  const dailyRes = await db.execute(sql`
    select d::date::text as date,
      coalesce(sum(m.litres) filter (where m.session = 'am'), 0)::float as am,
      coalesce(sum(m.litres) filter (where m.session = 'pm'), 0)::float as pm,
      coalesce(sum(m.litres) filter (where m.under_withdrawal), 0)::float as withheld,
      count(distinct m.animal_id)::int as cows
    from generate_series(${start}::date, ${end}::date, interval '1 day') d
    left join milk_records m on m.farm_id = ${farmId} and m.date = d::date
    group by d order by d
  `);
  const daily: DairyDay[] = rowsOf<Record<string, unknown>>(dailyRes).map((r) => ({
    date: String(r.date),
    am: n0(r.am),
    pm: n0(r.pm),
    withheld: n0(r.withheld),
    cows: n0(r.cows),
  }));

  // Per-cow: this week vs the week before, to spot drops early (mastitis, heat, feed).
  const cowRes = await db.execute(sql`
    select a.tag, a.name, a.name_bn,
      (sum(m.litres) filter (where m.date > ${end}::date - 7) / 7)::float as this_week,
      (sum(m.litres) filter (where m.date <= ${end}::date - 7 and m.date > ${end}::date - 14) / 7)::float as last_week
    from milk_records m join animals a on a.id = m.animal_id
    where m.farm_id = ${farmId} and m.date > ${end}::date - 14 and a.lifecycle = 'active'
      -- a cow being dried off is meant to drop
      and not exists (select 1 from breeding_events b where b.animal_id = a.id and b.type = 'dry_off' and b.date > ${end}::date - 14)
    group by a.id
  `);
  const cows = rowsOf<Record<string, unknown>>(cowRes).map((r) => ({
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    nameBn: (r.name_bn as string | null) ?? null,
    thisWeek: Math.round(n0(r.this_week) * 10) / 10,
    lastWeek: Math.round(n0(r.last_week) * 10) / 10,
  }));
  const top = [...cows].sort((a, b) => b.thisWeek - a.thisWeek).slice(0, 6);
  const drops = cows
    .filter((c) => c.lastWeek >= 3 && c.thisWeek > 0 && c.thisWeek < c.lastWeek * 0.8)
    .map((c) => ({ ...c, change: Math.round(((c.thisWeek - c.lastWeek) / c.lastWeek) * 100) }))
    .sort((a, b) => a.change - b.change)
    .slice(0, 6);

  const last = daily.at(-1);
  const week = daily.slice(-7);
  const prevWeek = daily.slice(-14, -7);
  const sum = (d: DairyDay[]) => d.reduce((s, x) => s + x.am + x.pm, 0);
  return {
    end,
    daily,
    latest: last ?? null,
    weekAvg: week.length ? sum(week) / week.length : 0,
    prevWeekAvg: prevWeek.length ? sum(prevWeek) / prevWeek.length : 0,
    perCow: last && last.cows ? (last.am + last.pm) / last.cows : 0,
    top,
    drops,
  };
}

/** Which sessions have been recorded on a date (drives the "record now" prompt). */
export async function sessionsRecorded(db: DB, farmId: string, date: string) {
  const res = await db.execute(sql`
    select session::text as s, count(*)::int as n from milk_records
    where farm_id = ${farmId} and date = ${date}::date group by session
  `);
  const out = { am: 0, pm: 0 };
  for (const r of rowsOf<{ s: MilkSession; n: number }>(res)) out[r.s] = Number(r.n);
  return out;
}

/* ───────────────────────── Buyers, sales, dues ───────────────────────── */

export const BUYER_KINDS = ["collector", "sweet_shop", "direct", "other"] as const;
export type BuyerKind = (typeof BUYER_KINDS)[number];

export type BuyerRow = {
  id: string;
  name: string;
  phone: string | null;
  kind: BuyerKind;
  dueTk: number;
  lastSale: string | null;
  litres30: number;
  amount30: number;
  avgPrice: number | null;
};

export async function listBuyers(db: DB, farmId: string): Promise<BuyerRow[]> {
  const end = await refDay(db, farmId);
  const res = await db.execute(sql`
    select b.id, b.name, b.phone, b.kind::text as kind,
      coalesce(sum(s.amount_tk - s.paid_tk), 0)::int as due,
      max(s.date)::text as last_sale,
      coalesce(sum(s.litres) filter (where s.date > ${end}::date - 30), 0)::float as litres30,
      coalesce(sum(s.amount_tk) filter (where s.date > ${end}::date - 30), 0)::int as amount30
    from buyers b left join milk_sales s on s.buyer_id = b.id
    where b.farm_id = ${farmId}
    group by b.id order by due desc, b.name
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone: (r.phone as string | null) ?? null,
    kind: r.kind as BuyerKind,
    dueTk: n0(r.due),
    lastSale: isoDate(r.last_sale),
    litres30: n0(r.litres30),
    amount30: n0(r.amount30),
    avgPrice: n0(r.litres30) > 0 ? n0(r.amount30) / n0(r.litres30) : null,
  }));
}

export async function recentSales(db: DB, farmId: string, limit = 30) {
  const res = await db.execute(sql`
    select s.id, s.date::text as date, s.litres::float as litres, s.price_per_litre_tk::float as price,
      s.amount_tk as amount, s.paid_tk as paid, b.name as buyer
    from milk_sales s left join buyers b on b.id = s.buyer_id
    where s.farm_id = ${farmId}
    order by s.date desc, s.created_at desc limit ${limit}
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    date: String(r.date),
    litres: n0(r.litres),
    price: n0(r.price),
    amount: n0(r.amount),
    paid: n0(r.paid),
    buyer: (r.buyer as string | null) ?? null,
  }));
}

/** Sellable milk vs milk sold, for the last N days: shows milk going unaccounted for. */
export async function milkBalance(db: DB, farmId: string, days = 7) {
  const end = await refDay(db, farmId);
  const res = await db.execute(sql`
    select
      coalesce((select sum(litres) from milk_records where farm_id = ${farmId} and not under_withdrawal
        and date > ${end}::date - ${days}::int), 0)::float as sellable,
      coalesce((select sum(litres) from milk_sales where farm_id = ${farmId}
        and date > ${end}::date - ${days}::int), 0)::float as sold
  `);
  const r = rowsOf<Record<string, unknown>>(res)[0] ?? {};
  return { sellable: n0(r.sellable), sold: n0(r.sold) };
}

const buyerInput = z.object({
  name: z.string().trim().min(2, "required").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || null),
  kind: z.enum(BUYER_KINDS),
});

export async function addBuyer(db: DB, actor: Actor, input: z.input<typeof buyerInput>) {
  if (!can(actor.role, "milk.sales")) return err("forbidden" as const);
  const parsed = buyerInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const [row] = await db
    .insert(buyers)
    .values({ farmId: actor.farmId, ...parsed.data })
    .returning({ id: buyers.id });
  await audit(db, actor, "buyer.create", "buyer", row!.id);
  return ok({ id: row!.id });
}

const saleInput = z.object({
  buyerId: z.string().uuid("required"),
  date: z.string().regex(isoDay, "date"),
  litres: z.coerce.number().positive("range").max(20000, "range"),
  pricePerLitreTk: z.coerce.number().positive("range").max(500, "range"),
  paidTk: z.coerce.number().int().min(0, "range").optional().default(0),
});

export async function recordSale(db: DB, actor: Actor, input: z.input<typeof saleInput>, today: string) {
  if (!can(actor.role, "milk.sales")) return err("forbidden" as const);
  const parsed = saleInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  if (v.date > today) return { ...err("invalid" as const), fields: { date: "future" } };
  const owned = (
    await db
      .select({ id: buyers.id })
      .from(buyers)
      .where(and(eq(buyers.id, v.buyerId), eq(buyers.farmId, actor.farmId)))
      .limit(1)
  )[0];
  if (!owned) return { ...err("invalid" as const), fields: { buyerId: "required" } };
  const amount = Math.round(v.litres * v.pricePerLitreTk);
  if (v.paidTk > amount) return { ...err("invalid" as const), fields: { paidTk: "over" } };
  const [row] = await db
    .insert(milkSales)
    .values({
      farmId: actor.farmId,
      buyerId: v.buyerId,
      date: v.date,
      litres: v.litres.toFixed(2),
      pricePerLitreTk: v.pricePerLitreTk.toFixed(2),
      amountTk: amount,
      paidTk: v.paidTk,
    })
    .returning({ id: milkSales.id });
  await audit(db, actor, "milk_sale.create", "milk_sale", row!.id, { amount });
  return ok({ id: row!.id, amount });
}

const paymentInput = z.object({
  buyerId: z.string().uuid("required"),
  amountTk: z.coerce.number().int().positive("range"),
});

/** A payment settles the buyer's oldest unpaid sales first. Over-payment is refused, not stored as credit. */
export async function recordPayment(db: DB, actor: Actor, input: z.input<typeof paymentInput>) {
  if (!can(actor.role, "milk.sales")) return err("forbidden" as const);
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const { buyerId, amountTk } = parsed.data;
  const open = await db
    .select({ id: milkSales.id, amount: milkSales.amountTk, paid: milkSales.paidTk })
    .from(milkSales)
    .where(and(eq(milkSales.farmId, actor.farmId), eq(milkSales.buyerId, buyerId), sql`${milkSales.paidTk} < ${milkSales.amountTk}`))
    .orderBy(milkSales.date, milkSales.createdAt);
  const due = open.reduce((s, r) => s + r.amount - r.paid, 0);
  if (due === 0) return { ...err("invalid" as const), fields: { amountTk: "nothing_due" } };
  if (amountTk > due) return { ...err("invalid" as const), fields: { amountTk: "over" } };
  let left = amountTk;
  for (const r of open) {
    if (left <= 0) break;
    const pay = Math.min(left, r.amount - r.paid);
    await db.update(milkSales).set({ paidTk: r.paid + pay }).where(eq(milkSales.id, r.id));
    left -= pay;
  }
  await audit(db, actor, "milk_payment.record", "buyer", buyerId, { amountTk });
  return ok({ remaining: due - amountTk });
}
