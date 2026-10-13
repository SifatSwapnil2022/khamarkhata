import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/* Small, deliberate set of primitives. Anything bigger lives with its feature. */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "border border-line-strong bg-surface text-danger-ink hover:bg-danger-bg",
};

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(buttonBase, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<"a"> & { variant?: Variant }) {
  return <a className={clsx(buttonBase, variants[variant], "no-underline", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 aria-[invalid=true]:border-danger-ink";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(inputBase, "pr-8", className)} {...props} />;
}

/** `flush` drops the padding for cards whose rows run edge to edge. */
export function Card({ className, flush = false, ...props }: ComponentProps<"section"> & { flush?: boolean }) {
  return (
    <section className={clsx("rounded-[14px] border border-line bg-surface", !flush && "p-5", className)} {...props} />
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "danger" | "ok"; children: ReactNode }) {
  const tones = {
    warn: "bg-warn-bg text-warn-ink",
    danger: "bg-danger-bg text-danger-ink",
    ok: "bg-primary-soft text-primary-ink",
  };
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-[10px] px-3.5 py-2.5 text-sm font-medium", tones[tone])}>
      {children}
    </p>
  );
}

export function Badge({ tone = "plain", children }: { tone?: "plain" | "green" | "warn"; children: ReactNode }) {
  const tones = {
    plain: "bg-surface-2 text-ink-2",
    green: "bg-primary-soft text-primary-ink",
    warn: "bg-warn-bg text-warn-ink",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-primary font-bold text-white"
    >
      খ
    </span>
  );
}
