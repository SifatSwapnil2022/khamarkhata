"use client";

import { useActionState } from "react";
import { inquiryAction } from "@/app/actions/market";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";
import type { MarketDict } from "@/i18n/market";

export function InquiryForm({ slug, t, defaultName, defaultPhone }: { slug: string; t: MarketDict; defaultName: string; defaultPhone: string }) {
  const [state, action, pending] = useActionState(inquiryAction, {});
  const v = state.values ?? {};
  const err = (k: string) => (state.fields?.[k] ? (t.errors[state.fields[k]!] ?? t.errors.invalid) : undefined);
  if (state.ok) return <Notice tone="ok">{t.sent.replace("{phone}", state.ok)}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && !state.fields ? <Notice tone="danger">{t.errors[state.error] ?? t.errors.invalid}</Notice> : null}
      <input type="hidden" name="slug" value={slug} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label={t.name} htmlFor="inq-name" error={err("name")}>
        <Input id="inq-name" name="name" autoComplete="name" required defaultValue={v.name ?? defaultName} aria-invalid={Boolean(err("name"))} />
      </Field>
      <Field label={t.phone} htmlFor="inq-phone" error={err("phone")}>
        <Input id="inq-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={v.phone ?? defaultPhone} aria-invalid={Boolean(err("phone"))} />
      </Field>
      <Field label={t.message} htmlFor="inq-msg">
        <Textarea id="inq-msg" name="message" maxLength={800} placeholder={t.messagePh} defaultValue={v.message} />
      </Field>
      <Button type="submit" disabled={pending} className="min-h-12">
        {t.send}
      </Button>
    </form>
  );
}
