"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { addBuyer, recordPayment, recordSale, saveMilk, type MilkInput } from "@/server/dairy";

export type ActionState = { ok?: string; error?: string; fields?: Record<string, string>; values?: Record<string, string>; data?: Record<string, number> };

/** Called straight from the entry sheet (and replayed by its offline queue), not through a form post. */
export async function saveMilkAction(input: MilkInput) {
  const { actor } = await requirePermission("milk.record");
  const res = await saveMilk(await getDb(), actor, input, bdToday());
  if (res.ok) revalidatePath("/app", "layout");
  return res.ok ? { ok: true as const, ...res.value } : { ok: false as const, error: res.error };
}

const read = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));

export async function addBuyerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("milk.sales");
  const values = read(form, ["name", "phone", "kind"]);
  const res = await addBuyer(await getDb(), actor, values as never);
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app/dairy", "layout");
  return { ok: "buyer" };
}

export async function recordSaleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("milk.sales");
  const values = read(form, ["buyerId", "date", "litres", "pricePerLitreTk", "paidTk"]);
  const res = await recordSale(await getDb(), actor, { ...values, paidTk: values.paidTk || "0" } as never, bdToday());
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app", "layout");
  return { ok: "sale", data: { amount: res.value.amount } };
}

export async function recordPaymentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("milk.sales");
  const values = read(form, ["buyerId", "amountTk"]);
  const res = await recordPayment(await getDb(), actor, values as never);
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app", "layout");
  return { ok: "payment", data: { remaining: res.value.remaining } };
}
