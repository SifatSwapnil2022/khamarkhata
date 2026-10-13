"use client";

import { useActionState } from "react";
import { createFarmAction, type FormState } from "@/app/actions/farm";
import { FarmFields } from "@/components/FarmFields";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/en";

export function OnboardingForm({ t, locale, defaultName }: { t: Dictionary["onboarding"]; locale: Locale; defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createFarmAction, {});
  const errors = state.fields ?? {};

  return (
    <form action={action} className="mt-8 flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="danger">{t.errors.invalid}</Notice> : null}
      <Field label={t.yourName} htmlFor="ownerName" error={errors.ownerName ? t.errors.invalid : undefined}>
        <Input
          id="ownerName"
          name="ownerName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={defaultName}
          aria-invalid={Boolean(errors.ownerName)}
        />
      </Field>
      <FarmFields t={t} locale={locale} errors={errors} />
      <Button type="submit" disabled={pending} className="mt-2 min-h-12 text-base">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
