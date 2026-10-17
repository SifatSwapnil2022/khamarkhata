import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { addExpense, exportRows, financeSummary, resolvePeriod, toCsv } from "@/server/finance";
import { recordTreatment } from "@/server/health";

const DAY = "2026-10-13";

describe("finance on the demo farm", () => {
  let db: DB;
  let owner: Actor;
  let worker: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const o = rows.find((r) => r.role === "owner")!;
    const w = rows.find((r) => r.role === "worker")!;
    owner = { farmId: o.farm_id, userId: o.user_id, role: "owner" };
    worker = { farmId: w.farm_id, userId: w.user_id, role: "worker" };
  }, 120_000);

  it("resolves periods ending today", () => {
    expect(resolvePeriod({}, DAY)).toEqual({ period: "90d", from: "2026-07-16", to: DAY });
    expect(resolvePeriod({ period: "month" }, DAY)).toEqual({ period: "month", from: "2026-10-01", to: DAY });
    expect(resolvePeriod({ period: "custom", from: "2026-09-01", to: "2026-12-01" }, DAY).to).toBe(DAY);
    expect(resolvePeriod({ period: "custom", from: "2026-10-05", to: "2026-10-01" }, DAY).period).toBe("90d");
  });

  it("adds up revenue and expenses from the records, nothing hardcoded", async () => {
    const from = "2026-06-01";
    const s = await financeSummary(db, owner.farmId, from, DAY);
    const raw = rowsOf<{ milk: number; spent: number }>(
      await db.execute(sql`select
        (select sum(amount_tk) from milk_sales where farm_id = ${owner.farmId} and date between ${from}::date and ${DAY}::date)::int as milk,
        (select sum(amount_tk) from expenses where farm_id = ${owner.farmId} and date between ${from}::date and ${DAY}::date)::int as spent`),
    )[0]!;
    expect(s.milk).toBe(raw.milk);
    expect(s.expenses).toBe(raw.spent);
    expect(s.net).toBe(s.revenue - s.expenses);
    expect(s.monthly.reduce((a, m) => a + m.expenses, 0)).toBe(s.expenses);
    expect(s.monthly.reduce((a, m) => a + m.revenue, 0)).toBe(s.revenue);
    expect(s.byCategory.find((c) => c.category === "medicine")?.total).toBeGreaterThan(0); // backfilled from health records
  });

  it("copies a treatment cost into the ledger once", async () => {
    const before = (await financeSummary(db, owner.farmId, DAY, DAY)).expenses;
    const res = await recordTreatment(db, owner, { tag: "D-011", type: "treatment", date: DAY, diagnosis: "Hoof trim", costTk: "450" }, DAY);
    expect(res.ok).toBe(true);
    expect((await financeSummary(db, owner.farmId, DAY, DAY)).expenses).toBe(before + 450);
  });

  it("records an expense and refuses workers and unknown tags", async () => {
    expect((await addExpense(db, owner, { date: DAY, category: "equipment", amountTk: "12000", note: "Milk cans" }, DAY)).ok).toBe(true);
    expect((await addExpense(db, worker, { date: DAY, category: "feed", amountTk: "100" }, DAY)).ok).toBe(false);
    const ghost = await addExpense(db, owner, { date: DAY, category: "vet", amountTk: "500", tag: "ZZ-1" }, DAY);
    expect(!ghost.ok && "fields" in ghost && ghost.fields?.tag).toBe("not_found");
  });

  it("exports CSV that Excel reads, with commas and quotes escaped", async () => {
    const rows = await exportRows(db, owner.farmId, "animals", "2000-01-01", DAY);
    expect(rows.length).toBe(260);
    const csv = toCsv([{ a: 'He said "hi", ok', b: 2 }]);
    expect(csv).toBe('﻿a,b\r\n"He said ""hi"", ok",2');
    expect(toCsv(rows).split("\r\n")[0]).toContain("tag");
  });
});
