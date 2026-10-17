import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { animals, expenses } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok } from "@/lib/result";
import { addDays, audit, isoDay, zodFields, type Actor } from "./common";

const n0 = (v: unknown) => num(v) ?? 0;

export const EXPENSE_CATEGORIES = ["feed", "medicine", "vet", "labour", "utilities", "transport", "equipment", "animal_purchase", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PERIODS = ["30d", "90d", "month", "year", "custom"] as const;
export type Period = (typeof PERIODS)[number];

/** Turns ?period=…&from=…&to=… into a date range ending today (Bangladesh time). */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }, today: string) {
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "90d";
  if (period === "custom" && sp.from && sp.to && isoDay.test(sp.from) && isoDay.test(sp.to) && sp.from <= sp.to) {
    return { period, from: sp.from, to: sp.to > today ? today : sp.to };
  }
  if (period === "month") return { period, from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "year") return { period, from: `${today.slice(0, 4)}-01-01`, to: today };
  if (period === "30d") return { period, from: addDays(today, -29), to: today };
  return { period: period === "custom" ? ("90d" as const) : period, from: addDays(today, -89), to: today };
}

/**
 * Money in and out for a period. Definitions (kept simple and shown in the UI):
 * - Revenue: milk sales by sale date (including amounts still owed) plus animal sales.
 * - Expenses: the expense ledger. Animal purchases count when bought; treatment and vaccine
 *   costs are copied into the ledger when recorded; feed logs are usage, not extra spending.
 * - Net = revenue − expenses. Not an accounting or tax statement.
 */
export async function financeSummary(db: DB, farmId: string, from: string, to: string) {
  const res = await db.execute(sql`
    select
      coalesce((select sum(amount_tk) from milk_sales where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::int as milk,
      coalesce((select sum(amount_tk - paid_tk) from milk_sales where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::int as milk_due,
      coalesce((select sum(litres) from milk_sales where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::float as milk_litres,
      coalesce((select sum(price_tk) from animal_sales where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::int as animals,
      coalesce((select count(*) from animal_sales where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::int as animals_n,
      coalesce((select sum(amount_tk) from expenses where farm_id = ${farmId} and date between ${from}::date and ${to}::date), 0)::int as spent
  `);
  const r = rowsOf<Record<string, unknown>>(res)[0] ?? {};
  const byCat = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select category::text as category, sum(amount_tk)::int as total, count(*)::int as n
      from expenses where farm_id = ${farmId} and date between ${from}::date and ${to}::date
      group by category order by total desc
    `),
  ).map((c) => ({ category: c.category as ExpenseCategory, total: n0(c.total), n: n0(c.n) }));
  const monthly = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      with months as (
        select generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), interval '1 month')::date as m
      )
      select to_char(m, 'YYYY-MM') as month,
        coalesce((select sum(amount_tk) from milk_sales s where s.farm_id = ${farmId} and date_trunc('month', s.date) = m
          and s.date between ${from}::date and ${to}::date), 0)::int
        + coalesce((select sum(price_tk) from animal_sales a where a.farm_id = ${farmId} and date_trunc('month', a.date) = m
          and a.date between ${from}::date and ${to}::date), 0)::int as revenue,
        coalesce((select sum(amount_tk) from expenses e where e.farm_id = ${farmId} and date_trunc('month', e.date) = m
          and e.date between ${from}::date and ${to}::date), 0)::int as expenses
      from months order by m
    `),
  ).map((m) => ({ month: String(m.month), revenue: n0(m.revenue), expenses: n0(m.expenses) }));
  const revenue = n0(r.milk) + n0(r.animals);
  const spent = n0(r.spent);
  return {
    revenue,
    milk: n0(r.milk),
    milkDue: n0(r.milk_due),
    milkLitres: n0(r.milk_litres),
    animalSales: n0(r.animals),
    animalsSold: n0(r.animals_n),
    expenses: spent,
    net: revenue - spent,
    byCategory: byCat,
    monthly,
  };
}

/**
 * Expense records for the ledger table. Costs copied from a herd vaccination (one row per animal)
 * are shown as one line per day and vaccine, with the number of animals.
 */
export async function listExpenses(db: DB, farmId: string, from: string, to: string, category?: ExpenseCategory, limit = 60) {
  const cat = category ? sql`and e.category = ${category}::expense_category` : sql``;
  const res = await db.execute(sql`
    select * from (
      select e.id::text as id, e.date, e.category::text as category, e.amount_tk::bigint as amount, e.note, e.source, a.tag,
        1 as n, e.created_at
      from expenses e left join animals a on a.id = e.animal_id
      where e.farm_id = ${farmId} and e.date between ${from}::date and ${to}::date and e.source <> 'health' ${cat}
      union all
      select min(e.id::text), e.date, e.category::text, sum(e.amount_tk)::bigint, e.note, 'health',
        case when count(*) = 1 then min(a.tag) end, count(*)::int, max(e.created_at)
      from expenses e left join animals a on a.id = e.animal_id
      where e.farm_id = ${farmId} and e.date between ${from}::date and ${to}::date and e.source = 'health' ${cat}
      group by e.date, e.category, e.note
    ) x
    order by date desc, created_at desc limit ${limit}
  `);
  return rowsOf<Record<string, unknown>>(res).map((e) => ({
    id: String(e.id),
    date: isoDate(e.date)!,
    category: e.category as ExpenseCategory,
    amount: n0(e.amount),
    note: (e.note as string | null) ?? null,
    source: String(e.source),
    tag: (e.tag as string | null) ?? null,
    animals: n0(e.n),
  }));
}

const expenseInput = z.object({
  date: z.string().regex(isoDay, "date"),
  category: z.enum(EXPENSE_CATEGORIES),
  amountTk: z.coerce.number().int("range").positive("range").max(100_000_000, "range"),
  tag: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || null),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export async function addExpense(db: DB, actor: Actor, input: z.input<typeof expenseInput>, today: string) {
  if (!can(actor.role, "finance.record")) return err("forbidden" as const);
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  if (v.date > today) return { ...err("invalid" as const), fields: { date: "future" } };
  let animalId: string | null = null;
  if (v.tag) {
    const [a] = await db
      .select({ id: animals.id })
      .from(animals)
      .where(and(eq(animals.farmId, actor.farmId), sql`upper(${animals.tag}) = upper(${v.tag})`))
      .limit(1);
    if (!a) return { ...err("invalid" as const), fields: { tag: "not_found" } };
    animalId = a.id;
  }
  const [row] = await db
    .insert(expenses)
    .values({ farmId: actor.farmId, date: v.date, category: v.category, amountTk: v.amountTk, animalId, note: v.note, source: "manual" })
    .returning({ id: expenses.id });
  await audit(db, actor, "expense.create", "expense", row!.id, { amount: v.amountTk, category: v.category });
  return ok({ id: row!.id });
}

/* ───────────────────────── CSV exports ───────────────────────── */

export const EXPORTS = ["animals", "milk", "milk-sales", "expenses", "health", "weights"] as const;
export type ExportKind = (typeof EXPORTS)[number];

/** Rows for a CSV export, farm-scoped. The caller checks permission for the kind. */
export async function exportRows(db: DB, farmId: string, kind: ExportKind, from: string, to: string): Promise<Record<string, unknown>[]> {
  const q =
    kind === "animals"
      ? sql`select a.tag, a.name, a.name_bn, a.sex, a.purpose, a.lifecycle as status, a.breed_label as breed, a.breed_percent,
              a.color, a.birth_date, a.birth_date_estimated, a.origin, a.purchase_date, a.purchase_price_tk,
              d.tag as dam, coalesce(s.code, sa.tag) as sire, sh.name as shed, a.exit_date, a.exit_reason
            from animals a left join animals d on d.id = a.dam_id left join sires s on s.id = a.sire_id
            left join animals sa on sa.id = a.sire_animal_id left join sheds sh on sh.id = a.shed_id
            where a.farm_id = ${farmId} order by a.tag`
      : kind === "milk"
        ? sql`select m.date, a.tag, m.session, m.litres, m.under_withdrawal from milk_records m join animals a on a.id = m.animal_id
              where m.farm_id = ${farmId} and m.date between ${from}::date and ${to}::date order by m.date, a.tag, m.session`
        : kind === "milk-sales"
          ? sql`select s.date, b.name as buyer, s.litres, s.price_per_litre_tk, s.amount_tk, s.paid_tk, s.amount_tk - s.paid_tk as due_tk
                from milk_sales s left join buyers b on b.id = s.buyer_id
                where s.farm_id = ${farmId} and s.date between ${from}::date and ${to}::date order by s.date`
          : kind === "expenses"
            ? sql`select e.date, e.category, e.amount_tk, a.tag as animal, e.note, e.source from expenses e left join animals a on a.id = e.animal_id
                  where e.farm_id = ${farmId} and e.date between ${from}::date and ${to}::date order by e.date`
            : kind === "health"
              ? sql`select h.date, a.tag, h.type, v.name as vaccine, h.diagnosis, h.drug, h.dose, h.vet_name, h.next_due_date,
                      h.milk_withdrawal_until, h.meat_withdrawal_until, h.cost_tk
                    from health_events h join animals a on a.id = h.animal_id left join vaccines v on v.id = h.vaccine_id
                    where h.farm_id = ${farmId} and h.date between ${from}::date and ${to}::date order by h.date, a.tag`
              : sql`select w.date, a.tag, w.weight_kg, w.method, w.heart_girth_cm, w.body_length_cm from weigh_ins w join animals a on a.id = w.animal_id
                    where w.farm_id = ${farmId} and w.date between ${from}::date and ${to}::date order by w.date, a.tag`;
  return rowsOf<Record<string, unknown>>(await db.execute(q));
}

/** RFC 4180 CSV with a BOM so Excel opens Bangla text correctly. */
export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "﻿";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
