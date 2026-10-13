"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { LOCALE_COOKIE } from "@/i18n";
import { maskPhone, normalizeBdPhone } from "@/lib/phone";
import { clientIp, getSessionToken, safeNext } from "@/server/auth";
import { listUserFarms } from "@/server/farms";
import { requestOtp, verifyOtp } from "@/server/otp";
import { createSession, deleteSession, SESSION_COOKIE } from "@/server/sessions";
import { getSmsProvider } from "@/server/sms";
import { pendingInvitesFor } from "@/server/team";

export type RequestCodeState =
  | { step: "phone"; error?: string; retryAfterSec?: number; phone?: string }
  | { step: "code"; phone: string; masked: string; retryAfterSec: number; debugCode?: string; error?: string };

/** DEMO_MODE=true (public demo deployments) shows the code on screen so visitors can sign in without SMS. */
const showDebugCode = () =>
  process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && process.env.OTP_DEBUG === "true");

export async function requestCodeAction(_prev: RequestCodeState, form: FormData): Promise<RequestCodeState> {
  const phone = String(form.get("phone") ?? "");
  const db = await getDb();
  const res = await requestOtp(db, { phone, ip: await clientIp() }, { sms: getSmsProvider() });
  if (!res.ok) return { step: "phone", error: res.error, retryAfterSec: res.retryAfterSec, phone };
  return {
    step: "code",
    phone: res.value.phone,
    masked: maskPhone(res.value.phone),
    retryAfterSec: 60,
    debugCode: showDebugCode() ? res.value.code : undefined,
  };
}

export type VerifyState = { error?: string };

export async function verifyCodeAction(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const phone = String(form.get("phone") ?? "");
  const code = String(form.get("code") ?? "");
  const db = await getDb();
  const res = await verifyOtp(db, { phone, code });
  if (!res.ok) return { error: res.error };

  const farms = await listUserFarms(db, res.value.userId);
  const { token, expiresAt } = await createSession(db, res.value.userId, {
    userAgent: (await headers()).get("user-agent"),
    activeFarmId: farms[0]?.farm.id ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  const pending = await pendingInvitesFor(db, normalizeBdPhone(phone)!);
  if (pending.length > 0) redirect("/invites");
  if (farms.length === 0) redirect("/onboarding");
  redirect(safeNext(form.get("next")));
}

export async function signOutAction() {
  const token = await getSessionToken();
  if (token) await deleteSession(await getDb(), token);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLocaleAction(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "bn";
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(safeNext(form.get("path"), "/"));
}
