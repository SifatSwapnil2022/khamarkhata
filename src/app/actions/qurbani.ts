"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { saveWeighIns, type WeighInput } from "@/server/qurbani";

export async function saveWeighInsAction(input: WeighInput) {
  const { actor } = await requirePermission("weight.record");
  const res = await saveWeighIns(await getDb(), actor, input, bdToday());
  if (res.ok) revalidatePath("/app", "layout");
  return res.ok ? { ok: true as const, count: res.value.count } : { ok: false as const, error: res.error, bad: "bad" in res ? (res.bad as string[]) : [] };
}
