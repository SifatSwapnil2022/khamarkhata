"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { recordBreedingEvent } from "@/server/breeding";
import { bdToday } from "@/server/common";

export type BreedingState = { ok?: { tag: string; calfTag: string | null }; error?: string; fields?: Record<string, string>; relations?: string[]; values?: Record<string, string> };

const KEYS = ["tag", "type", "date", "method", "sire", "technician", "pdResult", "calvingEase", "calfTag", "calfSex", "calfName", "notes", "acceptRelation"];

export async function breedingEventAction(_prev: BreedingState, form: FormData): Promise<BreedingState> {
  const ctx = await requireFarm();
  if (!can(ctx.role, "breeding.observe") && !can(ctx.role, "breeding.record")) return { error: "forbidden" };
  const values = Object.fromEntries(KEYS.map((k) => [k, String(form.get(k) ?? "")]));
  // Empty selects mean "not given", so zod sees undefined rather than "".
  const input = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
  const actor = { userId: ctx.user.id, farmId: ctx.farm.id, role: ctx.role };
  const res = await recordBreedingEvent(await getDb(), actor, input as never, bdToday());
  if (!res.ok) {
    return {
      error: res.error,
      fields: "fields" in res ? res.fields : undefined,
      relations: "relations" in res ? (res.relations as string[]) : undefined,
      values,
    };
  }
  revalidatePath("/app", "layout");
  return { ok: res.value };
}
