import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { addBuyer, dairyOverview, listBuyers, milkBalance, milkSheet, recordPayment, recordSale, saveMilk } from "@/server/dairy";

const DAY = "2026-10-13"; // the demo farm's last recorded day

describe("dairy on the demo farm", () => {
  let db: DB;
  let owner: Actor;
  let vet: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const o = rows.find((r) => r.role === "owner")!;
    const v = rows.find((r) => r.role === "vet")!;
    owner = { farmId: o.farm_id, userId: o.user_id, role: "owner" };
    vet = { farmId: v.farm_id, userId: v.user_id, role: "vet" };
  }, 120_000);

  it("lists milking and dry cows with what's recorded", async () => {
    const sheet = await milkSheet(db, owner.farmId, DAY, "am");
    expect(sheet).toHaveLength(100);
    expect(sheet.filter((r) => r.milking)).toHaveLength(86);
    const recorded = sheet.filter((r) => r.litres !== null);
    expect(recorded.length).toBe(86);
    expect(sheet.filter((r) => r.withdrawalUntil)).toHaveLength(1);
    expect(recorded.every((r) => r.usual !== null)).toBe(true);
  });

  it("saves, replays and clears a milking", async () => {
    const date = "2026-10-14";
    const sheet = await milkSheet(db, owner.farmId, date, "am");
    const [a, b] = sheet.filter((r) => r.milking);
    const input = { date, session: "am" as const, entries: [{ animalId: a!.id, litres: 6.5 }, { animalId: b!.id, litres: 4 }] };
    const first = await saveMilk(db, owner, input, date);
    expect(first.ok && first.value.saved).toBe(2);
    // The offline queue may send the same milking twice: still one row per cow.
    await saveMilk(db, owner, input, date);
    const again = await milkSheet(db, owner.farmId, date, "am");
    expect(again.find((r) => r.id === a!.id)?.litres).toBe(6.5);
    expect(again.filter((r) => r.litres !== null)).toHaveLength(2);

    const cleared = await saveMilk(db, owner, { date, session: "am", entries: [{ animalId: b!.id, litres: null }] }, date);
    expect(cleared.ok && cleared.value.cleared).toBe(1);
    expect((await milkSheet(db, owner.farmId, date, "am")).filter((r) => r.litres !== null)).toHaveLength(1);
  });

  it("flags milk from a cow under withdrawal, whatever the client says", async () => {
    const date = "2026-10-14";
    const cow = (await milkSheet(db, owner.farmId, date, "pm")).find((r) => r.withdrawalUntil)!;
    const res = await saveMilk(db, owner, { date, session: "pm", entries: [{ animalId: cow.id, litres: 5 }] }, date);
    expect(res.ok && res.value.withheld).toBe(1);
    const row = rowsOf<{ w: boolean }>(
      await db.execute(sql`select under_withdrawal as w from milk_records where animal_id = ${cow.id} and date = ${date} and session = 'pm'`),
    )[0];
    expect(row?.w).toBe(true);
  });

  it("refuses future dates, other farms' animals and roles without permission", async () => {
    const sheet = await milkSheet(db, owner.farmId, DAY, "am");
    expect((await saveMilk(db, owner, { date: "2026-10-20", session: "am", entries: [] }, DAY)).ok).toBe(false);
    expect((await saveMilk(db, vet, { date: DAY, session: "am", entries: [{ animalId: sheet[0]!.id, litres: 3 }] }, DAY)).ok).toBe(false);
    const stranger = await saveMilk(db, owner, { date: DAY, session: "am", entries: [{ animalId: crypto.randomUUID(), litres: 3 }] }, DAY);
    expect(stranger.ok && stranger.value.saved).toBe(0);
    expect((await saveMilk(db, owner, { date: DAY, session: "am", entries: [{ animalId: sheet[0]!.id, litres: 99 }] }, DAY)).ok).toBe(false);
  });

  it("summarises 30 days and spots the best cows", async () => {
    const ov = await dairyOverview(db, owner.farmId, 30);
    expect(ov.daily).toHaveLength(30);
    expect(ov.weekAvg).toBeGreaterThan(400);
    const bal = await milkBalance(db, owner.farmId, 7);
    expect(bal.sold).toBeGreaterThan(bal.sellable * 0.9);
    expect(ov.top[0]!.thisWeek).toBeGreaterThan(ov.top.at(-1)!.thisWeek - 0.001);
  });

  it("tracks dues and settles the oldest sales first", async () => {
    const buyers = await listBuyers(db, owner.farmId);
    const collector = buyers.find((b) => b.kind === "collector")!;
    expect(collector.dueTk).toBeGreaterThan(0);
    expect(buyers.find((b) => b.kind === "direct")!.dueTk).toBe(0);

    const over = await recordPayment(db, owner, { buyerId: collector.id, amountTk: collector.dueTk + 1 });
    expect(over.ok).toBe(false);
    const part = await recordPayment(db, owner, { buyerId: collector.id, amountTk: 10000 });
    expect(part.ok && part.value.remaining).toBe(collector.dueTk - 10000);
    const oldestOpen = rowsOf<{ date: string; paid: number; amount: number }>(
      await db.execute(sql`select date::text, paid_tk as paid, amount_tk as amount from milk_sales where buyer_id = ${collector.id} and paid_tk < amount_tk order by date limit 1`),
    )[0]!;
    // Everything before the partly paid sale is fully paid.
    const olderUnpaid = rowsOf<{ n: number }>(
      await db.execute(sql`select count(*)::int as n from milk_sales where buyer_id = ${collector.id} and paid_tk < amount_tk and date < ${oldestOpen.date}`),
    )[0]!;
    expect(olderUnpaid.n).toBe(0);
  });

  it("records a sale for a new buyer", async () => {
    const b = await addBuyer(db, owner, { name: "Rahman Sweets", kind: "sweet_shop" });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const sale = await recordSale(db, owner, { buyerId: b.value.id, date: DAY, litres: "20", pricePerLitreTk: "62", paidTk: "500" }, DAY);
    expect(sale.ok && sale.value.amount).toBe(1240);
    const row = (await listBuyers(db, owner.farmId)).find((x) => x.id === b.value.id)!;
    expect(row.dueTk).toBe(740);
    expect((await recordSale(db, owner, { buyerId: b.value.id, date: DAY, litres: "1", pricePerLitreTk: "60", paidTk: "100" }, DAY)).ok).toBe(false);
  });
});
