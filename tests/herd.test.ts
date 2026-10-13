import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { getHerdSummary, herdIsEmpty } from "@/server/herd";
import { testDb } from "./helpers";

describe("herd summary", () => {
  it("is empty for a new farm", async () => {
    const db = await testDb();
    const h = await getHerdSummary(db, "00000000-0000-4000-8000-000000000000");
    expect(herdIsEmpty(h)).toBe(true);
    expect(h.latestMilkDate).toBeNull();
  });

  it("matches the demo farm", async () => {
    // Full migration history, including the demo farm.
    const db = await createDb("memory", { migrate: true });
    const r = (await db.execute(sql`select id from farms where name like '%(demo)'`)) as unknown as {
      rows: { id: string }[];
    };
    const h = await getHerdSummary(db, r.rows[0]!.id);
    expect(h.milkCows).toBe(100);
    expect(h.heiferCalves + h.bullCalves).toBe(50);
    expect(h.qurbaniBulls).toBe(100);
    expect(h.breedingBulls).toBe(10);
    expect(h.milkingCows + h.dryCows).toBe(100);
    expect(h.latestMilkDate).toBe("2026-10-13");
    expect(h.latestMilkLitres).toBeGreaterThan(400);
    expect(h.pregnant).toBeGreaterThan(30);
    expect(h.underMilkWithdrawal).toBe(1);
    // 20 adults missed the October round; some older calves are also due their booster.
    expect(h.fmdOverdue).toBeGreaterThanOrEqual(20);
  }, 120_000);
});
