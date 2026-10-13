import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/* Small, deliberate set of primitives. Anything bigger lives with its feature. */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  accent: "bg-accent text-accent-ink hover:brightness-95",
  secondary: "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-surface",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "border-2 border-danger-ink bg-transparent text-danger-ink hover:bg-danger-bg",
};

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(buttonBase, variants[variant], className)} {...props} />;
}

export function buttonClass(variant: Variant = "primary", className?: string) {
  return clsx(buttonBase, variants[variant], "no-underline", className);
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

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputBase, "min-h-24 py-2.5", className)} {...props} />;
}

/** Ledger-paper card on the yard ground. `flush` drops the padding for edge-to-edge rows. */
export function Card({ className, flush = false, ...props }: ComponentProps<"section"> & { flush?: boolean }) {
  return <section className={clsx("rounded-[6px] bg-surface", !flush && "p-5", className)} {...props} />;
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

export type BadgeTone = "plain" | "green" | "warn" | "danger" | "dark";

export function Badge({ tone = "plain", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    plain: "bg-surface-2 text-ink-2",
    green: "bg-primary-soft text-primary-ink",
    warn: "bg-warn-bg text-warn-ink",
    danger: "bg-danger-bg text-danger-ink",
    dark: "bg-ink text-surface",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An ear tag, set in mono like the plastic tag itself. */
export function EarTag({ tag, className }: { tag: string; className?: string }) {
  return (
    <span
      className={clsx(
        "keep-mono inline-flex items-center rounded-[4px] bg-accent px-1.5 py-px font-mono text-[13px] font-medium tracking-wide text-accent-ink",
        className,
      )}
    >
      {tag}
    </span>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.56 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink"
    >
      খ
    </span>
  );
}

/**
 * The dark band at the top of each page. It continues the header so logo, title
 * and the page's own tabs read as one block.
 */
export function PageHead({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-deep text-surface">
      <div className="page-column pt-6 pb-0 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[length:var(--text-title)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance text-[#f1ead9]">
              {title}
            </h1>
            {subtitle ? <p className="mt-2 text-deep-ink">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2 pb-1">{actions}</div> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : <div className="h-8" />}
      </div>
    </div>
  );
}
