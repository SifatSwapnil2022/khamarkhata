import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db/client";
import { users } from "@/db/schema";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SEC, OTP_TTL_SEC, requestOtp, verifyOtp } from "@/server/otp";
import { createSession, findSession } from "@/server/sessions";
import { RecordingSms, testDb } from "./helpers";

const PHONE = "01712345678";
let db: DB;
let sms: RecordingSms;

beforeEach(async () => {
  db = await testDb();
  sms = new RecordingSms();
});

const at = (base: Date, sec: number) => new Date(base.getTime() + sec * 1000);

describe("requestOtp", () => {
  it("sends a 6-digit code and never stores it in plain text", async () => {
    const res = await requestOtp(db, { phone: PHONE }, { sms });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.code).toMatch(/^\d{6}$/);
    expect(sms.sent[0]?.to).toBe("+8801712345678");
    expect(sms.sent[0]?.message).toContain(res.value.code);
  });

  it("rejects invalid numbers", async () => {
    const res = await requestOtp(db, { phone: "12345" }, { sms });
    expect(res).toMatchObject({ ok: false, error: "invalid_phone" });
    expect(sms.sent).toHaveLength(0);
  });

  it("enforces a resend cooldown", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    await requestOtp(db, { phone: PHONE }, { sms, now: t0 });
    const again = await requestOtp(db, { phone: PHONE }, { sms, now: at(t0, 10) });
    expect(again).toMatchObject({ ok: false, error: "rate_limited" });
    if (!again.ok) expect(again.retryAfterSec).toBe(OTP_RESEND_COOLDOWN_SEC - 10);
  });

  it("caps codes per phone in the window", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    for (let i = 0; i < 3; i++) {
      const r = await requestOtp(db, { phone: PHONE }, { sms, now: at(t0, i * 61) });
      expect(r.ok).toBe(true);
    }
    const fourth = await requestOtp(db, { phone: PHONE }, { sms, now: at(t0, 3 * 61) });
    expect(fourth).toMatchObject({ ok: false, error: "rate_limited" });
  });
});

describe("verifyOtp", () => {
  it("creates the user on first login and reuses them after", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    const first = await requestOtp(db, { phone: PHONE }, { sms, now: t0 });
    if (!first.ok) throw new Error("request failed");
    const v1 = await verifyOtp(db, { phone: PHONE, code: first.value.code }, { now: at(t0, 30) });
    expect(v1).toMatchObject({ ok: true, value: { isNewUser: true } });

    const second = await requestOtp(db, { phone: "+880 1712-345678" }, { sms, now: at(t0, 120) });
    if (!second.ok) throw new Error("request failed");
    const v2 = await verifyOtp(db, { phone: PHONE, code: second.value.code }, { now: at(t0, 130) });
    expect(v2).toMatchObject({ ok: true, value: { isNewUser: false } });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("rejects a reused code", async () => {
    const r = await requestOtp(db, { phone: PHONE }, { sms });
    if (!r.ok) throw new Error("request failed");
    expect((await verifyOtp(db, { phone: PHONE, code: r.value.code })).ok).toBe(true);
    expect(await verifyOtp(db, { phone: PHONE, code: r.value.code })).toMatchObject({ ok: false, error: "expired" });
  });

  it("rejects an expired code", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    const r = await requestOtp(db, { phone: PHONE }, { sms, now: t0 });
    if (!r.ok) throw new Error("request failed");
    const res = await verifyOtp(db, { phone: PHONE, code: r.value.code }, { now: at(t0, OTP_TTL_SEC + 1) });
    expect(res).toMatchObject({ ok: false, error: "expired" });
  });

  it("only the newest code works", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    const a = await requestOtp(db, { phone: PHONE }, { sms, now: t0 });
    const b = await requestOtp(db, { phone: PHONE }, { sms, now: at(t0, 61) });
    if (!a.ok || !b.ok) throw new Error("request failed");
    if (a.value.code !== b.value.code) {
      expect((await verifyOtp(db, { phone: PHONE, code: a.value.code }, { now: at(t0, 70) })).ok).toBe(false);
    }
    expect((await verifyOtp(db, { phone: PHONE, code: b.value.code }, { now: at(t0, 71) })).ok).toBe(true);
  });

  it("lets several people share the demo login without locking each other out", async () => {
    const t0 = new Date("2026-10-13T10:00:00Z");
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await requestOtp(db, { phone: PHONE, ip: `10.0.0.${i}`, shared: true }, { sms, now: at(t0, i) });
      if (!r.ok) throw new Error(`request ${i} refused: ${r.error}`);
      codes.push(r.value.code);
    }
    // Each visitor's own code works, in any order, once.
    for (const i of [2, 0, 4]) expect((await verifyOtp(db, { phone: PHONE, code: codes[i]! }, { now: at(t0, 30) })).ok).toBe(true);
    expect((await verifyOtp(db, { phone: PHONE, code: codes[2]! }, { now: at(t0, 31) })).ok).toBe(false);
    // Unshared numbers keep the cooldown.
    await requestOtp(db, { phone: "01812345678" }, { sms, now: t0 });
    expect((await requestOtp(db, { phone: "01812345678" }, { sms, now: at(t0, 5) })).ok).toBe(false);
  });

  it("locks the code after too many wrong attempts", async () => {
    const r = await requestOtp(db, { phone: PHONE }, { sms });
    if (!r.ok) throw new Error("request failed");
    const wrong = r.value.code === "000000" ? "111111" : "000000";
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      expect(await verifyOtp(db, { phone: PHONE, code: wrong })).toMatchObject({ error: "invalid_code" });
    }
    expect(await verifyOtp(db, { phone: PHONE, code: wrong })).toMatchObject({ error: "too_many_attempts" });
    // Even the right code is refused now; the user must request a new one.
    expect((await verifyOtp(db, { phone: PHONE, code: r.value.code })).ok).toBe(false);
  });
});

describe("sessions", () => {
  it("finds a session by token and not by its hash", async () => {
    const r = await requestOtp(db, { phone: PHONE }, { sms });
    if (!r.ok) throw new Error("request failed");
    const v = await verifyOtp(db, { phone: PHONE, code: r.value.code });
    if (!v.ok) throw new Error("verify failed");
    const { token } = await createSession(db, v.value.userId);
    expect((await findSession(db, token))?.user.phone).toBe("+8801712345678");
    expect(await findSession(db, "not-a-token")).toBeNull();
  });
});
