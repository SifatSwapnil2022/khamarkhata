"use client";

import { useActionState } from "react";
import { inviteAction, type FormState } from "@/app/actions/farm";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { Dictionary } from "@/i18n/en";

type T = Dictionary["team"];

export function InviteForm({ t, roles }: { t: T; roles: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteAction, {});
  const error = state.error as keyof T["errors"] | undefined;

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      {state.done ? <Notice tone="ok">{t.invited}</Notice> : null}
      <Field label={t.phone} htmlFor="invite-phone" error={error ? t.errors[error] : undefined}>
        <Input
          id="invite-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="01XXX-XXXXXX"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "invite-phone-error" : undefined}
        />
      </Field>
      <Field label={t.role} htmlFor="invite-role">
        <Select id="invite-role" name="role" defaultValue={roles.at(-1)?.value}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {t.sendInvite}
      </Button>
    </form>
  );
}
