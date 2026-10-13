"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addBuyerAction, recordPaymentAction, recordSaleAction, type ActionState } from "@/app/actions/dairy";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { DairyDict } from "@/i18n/dairy";

type BuyerOption = { id: string; name: string; due: number; price: number | null };

const tk = (n: number, locale: "bn" | "en") => `৳${n.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN")}`;

function useErrors(state: ActionState, t: DairyDict) {
  return (k: string) => {
    const code = state.fields?.[k];
    return code ? (t.errors[code] ?? t.errors.range) : undefined;
  };
}

/** Reset the form after a successful submit, so the next entry starts clean. */
function useResetOnOk(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function SaleForm({ buyers, today, t, locale }: { buyers: BuyerOption[]; today: string; t: DairyDict; locale: "bn" | "en" }) {
  const [state, action, pending] = useActionState(recordSaleAction, {});
  const e = useErrors(state, t);
  const ref = useResetOnOk(state);
  const [buyerId, setBuyerId] = useState(state.values?.buyerId ?? buyers[0]?.id ?? "");
  const [litres, setLitres] = useState("");
  const [price, setPrice] = useState(String(buyers.find((b) => b.id === buyerId)?.price ?? ""));
  const amount = Math.round(Number(litres) * Number(price));

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4" noValidate>
      {state.ok ? <Notice tone="ok">{t.saleSaved.replace("{amount}", tk(state.data?.amount ?? 0, locale))}</Notice> : null}
      {state.error && !state.fields ? <Notice tone="danger">{t.errors[state.error] ?? t.errors.invalid}</Notice> : null}
      <Field label={t.saleBuyer} htmlFor="sale-buyer" error={e("buyerId")}>
        <Select
          id="sale-buyer"
          name="buyerId"
          value={buyerId}
          onChange={(ev) => {
            setBuyerId(ev.target.value);
            const p = buyers.find((b) => b.id === ev.target.value)?.price;
            if (p) setPrice(String(p));
          }}
        >
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.saleDate} htmlFor="sale-date" error={e("date")}>
        <Input id="sale-date" name="date" type="date" max={today} defaultValue={state.values?.date ?? today} aria-invalid={Boolean(e("date"))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.saleLitres} htmlFor="sale-litres" error={e("litres")}>
          <Input id="sale-litres" name="litres" inputMode="decimal" value={litres} onChange={(ev) => setLitres(ev.target.value)} aria-invalid={Boolean(e("litres"))} />
        </Field>
        <Field label={t.salePrice} htmlFor="sale-price" error={e("pricePerLitreTk")}>
          <Input id="sale-price" name="pricePerLitreTk" inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} aria-invalid={Boolean(e("pricePerLitreTk"))} />
        </Field>
      </div>
      <Field label={t.salePaid} htmlFor="sale-paid" hint={t.salePaidHint} error={e("paidTk")}>
        <Input id="sale-paid" name="paidTk" inputMode="numeric" defaultValue="0" aria-invalid={Boolean(e("paidTk"))} />
      </Field>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="font-display text-xl font-extrabold tabular" aria-live="polite">
          {Number.isFinite(amount) && amount > 0 ? tk(amount, locale) : "৳—"}
        </p>
        <Button type="submit" disabled={pending}>
          {t.saveSale}
        </Button>
      </div>
    </form>
  );
}

export function PaymentForm({ buyers, t, locale }: { buyers: BuyerOption[]; t: DairyDict; locale: "bn" | "en" }) {
  const [state, action, pending] = useActionState(recordPaymentAction, {});
  const e = useErrors(state, t);
  const ref = useResetOnOk(state);
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const due = buyers.find((b) => b.id === buyerId)?.due ?? 0;
  if (buyers.length === 0) return <p className="text-muted">{t.errors.nothing_due}</p>;
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4" noValidate>
      {state.ok ? <Notice tone="ok">{t.paymentSaved.replace("{due}", tk(state.data?.remaining ?? 0, locale))}</Notice> : null}
      <Field label={t.saleBuyer} htmlFor="pay-buyer" error={e("buyerId")}>
        <Select id="pay-buyer" name="buyerId" value={buyerId} onChange={(ev) => setBuyerId(ev.target.value)}>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {tk(b.due, locale)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.paymentAmount} htmlFor="pay-amount" error={e("amountTk")}>
        <Input id="pay-amount" name="amountTk" inputMode="numeric" placeholder={String(due)} aria-invalid={Boolean(e("amountTk"))} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t.savePayment}
      </Button>
    </form>
  );
}

export function AddBuyerForm({ t }: { t: DairyDict }) {
  const [state, action, pending] = useActionState(addBuyerAction, {});
  const e = useErrors(state, t);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4" noValidate>
      <Field label={t.buyerName} htmlFor="buyer-name" error={e("name")}>
        <Input id="buyer-name" name="name" required defaultValue={state.values?.name} aria-invalid={Boolean(e("name"))} />
      </Field>
      <Field label={t.buyerPhone} htmlFor="buyer-phone" error={e("phone")}>
        <Input id="buyer-phone" name="phone" type="tel" inputMode="tel" defaultValue={state.values?.phone} />
      </Field>
      <Field label={t.buyerKind} htmlFor="buyer-kind">
        <Select id="buyer-kind" name="kind" defaultValue={state.values?.kind ?? "collector"}>
          {(Object.keys(t.kinds) as (keyof DairyDict["kinds"])[]).map((k) => (
            <option key={k} value={k}>
              {t.kinds[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t.saveBuyer}
      </Button>
    </form>
  );
}
