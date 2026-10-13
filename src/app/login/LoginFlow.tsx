"use client";

import { useActionState, useEffect, useState } from "react";
import { requestCodeAction, verifyCodeAction, type RequestCodeState } from "@/app/actions/auth";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { Dictionary } from "@/i18n/en";

type T = Dictionary["login"];

export function LoginFlow({ t, next }: { t: T; next: string }) {
  const [reqState, requestCode, requesting] = useActionState<RequestCodeState, FormData>(requestCodeAction, {
    step: "phone",
  });
  // "Use a different number" dismisses the current code step; a new request brings it back.
  const [dismissed, setDismissed] = useState<RequestCodeState | null>(null);
  const onCodeStep = reqState.step === "code" && dismissed !== reqState;

  if (onCodeStep) {
    return (
      <CodeStep
        key={reqState.phone + String(reqState.debugCode)}
        t={t}
        state={reqState}
        next={next}
        onResend={requestCode}
        resending={requesting}
        onChangeNumber={() => setDismissed(reqState)}
      />
    );
  }

  const error = reqState.step === "phone" ? reqState.error : undefined;
  return (
    <form action={requestCode} className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-ink-2">{t.subtitle}</p>
      </div>
      <Field label={t.phoneLabel} hint={t.phoneHint} error={error ? t.errors[error as keyof T["errors"]] : undefined} htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="01XXX-XXXXXX"
          defaultValue={reqState.step === "phone" ? reqState.phone : reqState.phone.replace(/^\+88/, "")}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "phone-error" : "phone-hint"}
          className="text-lg tracking-wide"
        />
      </Field>
      <Button type="submit" disabled={requesting} className="min-h-12 text-base">
        {requesting ? t.sending : t.sendCode}
      </Button>
    </form>
  );
}

function CodeStep({
  t,
  state,
  next,
  onResend,
  resending,
  onChangeNumber,
}: {
  t: T;
  state: Extract<RequestCodeState, { step: "code" }>;
  next: string;
  onResend: (form: FormData) => void;
  resending: boolean;
  onChangeNumber: () => void;
}) {
  const [verifyState, verify, verifying] = useActionState(verifyCodeAction, {});
  const [wait, setWait] = useState(state.retryAfterSec);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const error = verifyState.error;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.codeLabel}</h1>
        <p className="mt-2 text-ink-2">
          {t.codeSentTo} <strong className="whitespace-nowrap text-ink">{state.masked}</strong>
        </p>
      </div>

      {state.debugCode ? (
        <Notice tone="warn">
          {t.devCode} <strong className="font-display tracking-[0.2em]">{state.debugCode}</strong>
        </Notice>
      ) : null}

      <form action={verify} className="flex flex-col gap-5">
        <input type="hidden" name="phone" value={state.phone} />
        <input type="hidden" name="next" value={next} />
        <Field label={t.codeLabel} error={error ? t.errors[error as keyof T["errors"]] : undefined} htmlFor="code">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9০-৯]{6}"
            maxLength={6}
            required
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "code-error" : undefined}
            className="min-h-14 text-center font-display text-2xl tracking-[0.5em]"
          />
        </Field>
        <Button type="submit" disabled={verifying} className="min-h-12 text-base">
          {verifying ? t.verifying : t.verify}
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={onChangeNumber} className="min-h-11 font-semibold text-primary hover:text-primary-hover">
          {t.changeNumber}
        </button>
        {wait > 0 ? (
          <span className="text-muted" aria-live="polite">
            {t.resendIn} {wait}
            {t.seconds}
          </span>
        ) : (
          <form action={onResend}>
            <input type="hidden" name="phone" value={state.phone} />
            <button type="submit" disabled={resending} className="min-h-11 font-semibold text-primary hover:text-primary-hover">
              {t.resend}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
