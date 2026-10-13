"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { recordTreatment, recordVaccination } from "@/server/health";
import type { ActionState } from "./dairy";

export async function vaccinateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("health.record");
  const values = Object.fromEntries(["vaccineId", "date", "nextDueDate", "batchNo", "vetName", "costPerHeadTk"].map((k) => [k, String(form.get(k) ?? "")]));
  const animalIds = form.getAll("animalId").map(String);
  const res = await recordVaccination(await getDb(), actor, { ...values, animalIds } as never, bdToday());
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app", "layout");
  return { ok: `${res.value.vaccine}|${res.value.next}`, data: { count: res.value.count } };
}

export async function treatAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("health.record");
  const values = Object.fromEntries(
    ["tag", "type", "date", "diagnosis", "drug", "dose", "vetName", "milkWithdrawalDays", "meatWithdrawalDays", "costTk", "notes"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const res = await recordTreatment(await getDb(), actor, values as never, bdToday());
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app", "layout");
  return { ok: res.value.tag };
}
