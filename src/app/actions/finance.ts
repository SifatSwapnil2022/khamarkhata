"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { addExpense } from "@/server/finance";
import type { ActionState } from "./dairy";

export async function addExpenseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("finance.record");
  const values = Object.fromEntries(["date", "category", "amountTk", "tag", "note"].map((k) => [k, String(form.get(k) ?? "")]));
  const res = await addExpense(await getDb(), actor, values as never, bdToday());
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app", "layout");
  return { ok: "saved" };
}
