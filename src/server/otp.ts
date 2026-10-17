import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { otpCodes, users } from "@/db/schema";
import { normalizeBdPhone } from "@/lib/phone";
import { err, ok, type Result } from "@/lib/result";
import type { SmsProvider } from "./sms";

export const OTP_TTL_SEC = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SEC = 60;
export const OTP_MAX_PER_PHONE = 3; // per window
export const OTP_PHONE_WINDOW_SEC = 10 * 60;
export const OTP_MAX_PER_IP = 10; // per window
export const OTP_IP_WINDOW_SEC = 60 * 60;

function secret(): string {
  const netlifyEnv = (globalThis as { Netlify?: { env?: { get(key: string): string | undefined } } }).Netlify?.env;
  const s = netlifyEnv?.get("OTP_SECRET") ?? process.env.OTP_SECRET;
  if (!s || s.length < 32) throw new Error("OTP_SECRET must be set to at least 32 characters.");
  return s;
}

export function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");
}

function hashesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

type RequestError = "invalid_phone" | "rate_limited";

export async function requestOtp(
  db: DB,
  input: {
    phone: string;
    ip?: string | null;
    /**
     * A login many people share at once (the public demo farm). The per-phone limits and
     * "newest code only" rule would let visitors lock each other out, so they're skipped;
     * the per-IP limit still applies.
     */
    shared?: boolean;
  },
  deps: { sms: SmsProvider; now?: Date },
): Promise<Result<{ phone: string; code: string; expiresAt: Date }, RequestError>> {
  const phone = normalizeBdPhone(input.phone);
  if (!phone) return err("invalid_phone");

  const now = deps.now ?? new Date();
  const since = (sec: number) => new Date(now.getTime() - sec * 1000);

  const recent = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, since(OTP_PHONE_WINDOW_SEC))))
    .orderBy(desc(otpCodes.createdAt));

  const last = input.shared ? undefined : recent[0];
  if (last) {
    const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SEC) {
      return err("rate_limited", { retryAfterSec: Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsed) });
    }
  }
  if (!input.shared && recent.length >= OTP_MAX_PER_PHONE) {
    const oldest = recent[recent.length - 1]!.createdAt.getTime();
    const retry = Math.ceil((oldest + OTP_PHONE_WINDOW_SEC * 1000 - now.getTime()) / 1000);
    return err("rate_limited", { retryAfterSec: Math.max(retry, 1) });
  }

  if (input.ip) {
    const [ipCount] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(otpCodes)
      .where(and(eq(otpCodes.ip, input.ip), gte(otpCodes.createdAt, since(OTP_IP_WINDOW_SEC))));
    if ((ipCount?.n ?? 0) >= OTP_MAX_PER_IP) return err("rate_limited", { retryAfterSec: OTP_IP_WINDOW_SEC });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now.getTime() + OTP_TTL_SEC * 1000);

  await db.transaction(async (tx) => {
    // Only the newest code for a phone is valid (except on a shared demo login).
    if (!input.shared) {
      await tx
        .update(otpCodes)
        .set({ consumedAt: now })
        .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)));
    }
    await tx.insert(otpCodes).values({
      phone,
      codeHash: hashOtp(phone, code),
      ip: input.ip ?? null,
      expiresAt,
      createdAt: now,
    });
  });

  await deps.sms.send(phone, `Khamar Khata code: ${code}. Valid for 5 minutes. Do not share it.`);
  return ok({ phone, code, expiresAt });
}

type VerifyError = "invalid_phone" | "invalid_code" | "expired" | "too_many_attempts";

export async function verifyOtp(
  db: DB,
  input: { phone: string; code: string },
  deps: { now?: Date } = {},
): Promise<Result<{ userId: string; isNewUser: boolean }, VerifyError>> {
  const phone = normalizeBdPhone(input.phone);
  if (!phone) return err("invalid_phone");
  const code = input.code.replace(/\D/g, "");
  if (code.length !== 6) return err("invalid_code");
  const now = deps.now ?? new Date();

  // A live code with this exact hash wins; otherwise wrong attempts count against the newest code.
  // Outside the shared demo login there is only ever one live code per phone, so this is the same row.
  const [exact] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.codeHash, hashOtp(phone, code)), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, now)))
    .limit(1);
  const [row] = exact
    ? [exact]
    : await db
        .select()
        .from(otpCodes)
        .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
        .orderBy(desc(otpCodes.createdAt))
        .limit(1);

  if (!row) return err("expired");
  if (row.expiresAt <= now) return err("expired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) return err("too_many_attempts");

  if (!hashesMatch(row.codeHash, hashOtp(phone, code))) {
    const attempts = row.attempts + 1;
    await db
      .update(otpCodes)
      .set({ attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: now } : {}) })
      .where(eq(otpCodes.id, row.id));
    return err(attempts >= OTP_MAX_ATTEMPTS ? "too_many_attempts" : "invalid_code");
  }

  return db.transaction(async (tx) => {
    // Consume atomically so two parallel requests can't both succeed.
    const consumed = await tx
      .update(otpCodes)
      .set({ consumedAt: now })
      .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });
    if (consumed.length === 0) return err("expired");

    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, phone));
    if (existing) {
      await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, existing.id));
      return ok({ userId: existing.id, isNewUser: false });
    }
    const [created] = await tx.insert(users).values({ phone, lastLoginAt: now }).returning({ id: users.id });
    return ok({ userId: created!.id, isNewUser: true });
  });
}
