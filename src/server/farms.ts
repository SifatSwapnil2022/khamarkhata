import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { auditLogs, DEFAULT_FARM_SETTINGS, farms, memberships, segmentEnum, users, type Role } from "@/db/schema";
import { DISTRICT_NAMES } from "@/lib/bd";
import { err, ok, type Result } from "@/lib/result";

export const farmInput = z.object({
  ownerName: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(80),
  district: z.string().refine((d) => DISTRICT_NAMES.has(d), "Choose a district"),
  upazila: z.string().trim().max(80).optional().transform((v) => v || null),
  segments: z.array(z.enum(segmentEnum.enumValues)).min(1, "Pick at least one"),
});
export type FarmInput = z.input<typeof farmInput>;

export async function createFarm(db: DB, userId: string, input: FarmInput) {
  const data = farmInput.parse(input);
  return db.transaction(async (tx) => {
    await tx.update(users).set({ name: data.ownerName }).where(eq(users.id, userId));
    const [farm] = await tx
      .insert(farms)
      .values({
        name: data.name,
        district: data.district,
        upazila: data.upazila,
        segments: data.segments,
        settings: DEFAULT_FARM_SETTINGS,
        createdById: userId,
      })
      .returning();
    await tx.insert(memberships).values({ farmId: farm!.id, userId, role: "owner" });
    await tx.insert(auditLogs).values({
      farmId: farm!.id,
      actorId: userId,
      action: "farm.create",
      entityType: "farm",
      entityId: farm!.id,
    });
    return farm!;
  });
}

export async function listUserFarms(db: DB, userId: string) {
  return db
    .select({ farm: farms, role: memberships.role })
    .from(memberships)
    .innerJoin(farms, eq(farms.id, memberships.farmId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(farms.createdAt));
}

export async function getMembership(db: DB, userId: string, farmId: string): Promise<{ farm: typeof farms.$inferSelect; role: Role } | null> {
  const [row] = await db
    .select({ farm: farms, role: memberships.role })
    .from(memberships)
    .innerJoin(farms, eq(farms.id, memberships.farmId))
    .where(and(eq(memberships.userId, userId), eq(memberships.farmId, farmId)))
    .limit(1);
  return row ?? null;
}

export const farmUpdateInput = farmInput.omit({ ownerName: true }).extend({
  heatCycleDays: z.coerce.number().int().min(17).max(25),
  pregnancyCheckDays: z.coerce.number().int().min(30).max(120),
  gestationDays: z.coerce.number().int().min(270).max(295),
  dryOffDaysBeforeCalving: z.coerce.number().int().min(30).max(90),
});

export async function updateFarm(
  db: DB,
  actor: { userId: string; farmId: string },
  input: z.input<typeof farmUpdateInput>,
): Promise<Result<true, "invalid">> {
  const parsed = farmUpdateInput.safeParse(input);
  if (!parsed.success) return err("invalid");
  const d = parsed.data;
  const [current] = await db.select({ settings: farms.settings }).from(farms).where(eq(farms.id, actor.farmId));
  await db.transaction(async (tx) => {
    await tx
      .update(farms)
      .set({
        name: d.name,
        district: d.district,
        upazila: d.upazila,
        segments: d.segments,
        settings: {
          ...DEFAULT_FARM_SETTINGS,
          ...current?.settings,
          heatCycleDays: d.heatCycleDays,
          pregnancyCheckDays: d.pregnancyCheckDays,
          gestationDays: d.gestationDays,
          dryOffDaysBeforeCalving: d.dryOffDaysBeforeCalving,
        },
        updatedAt: new Date(),
      })
      .where(eq(farms.id, actor.farmId));
    await tx.insert(auditLogs).values({
      farmId: actor.farmId,
      actorId: actor.userId,
      action: "farm.update",
      entityType: "farm",
      entityId: actor.farmId,
      data: d,
    });
  });
  return ok(true);
}
