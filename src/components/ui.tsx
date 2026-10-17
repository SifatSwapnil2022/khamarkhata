import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Small, deliberate set of primitives. Anything bigger lives with its feature. */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "border border-danger-ink/40 bg-surface text-danger-ink hover:bg-danger-bg",
  light: "bg-white text-[#0c3b25] hover:bg-[#e2f1e7]",
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
  "min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] text-ink transition-colors placeholder:text-muted/70 hover:border-muted/60 focus:border-primary aria-[invalid=true]:border-danger-ink";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(inputBase, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputBase, "min-h-24 py-2.5", className)} {...props} />;
}

/** White card with a soft shadow. `flush` drops the padding for edge-to-edge rows. */
export function Card({ className, flush = false, ...props }: ComponentProps<"section"> & { flush?: boolean }) {
  return (
    <section
      className={clsx("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", !flush && "p-5 sm:p-6", className)}
      {...props}
    />
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "danger" | "ok"; children: ReactNode }) {
  const tones = {
    warn: "bg-warn-bg text-warn-ink",
    danger: "bg-danger-bg text-danger-ink",
    ok: "bg-primary-soft text-primary-ink",
  };
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={clsx("rounded-xl px-4 py-3 text-[15px] font-medium", tones[tone])}>
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
    dark: "bg-deep text-white",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An ear tag: the animal's ID, set like the printed tag. */
export function EarTag({ tag, className, tone = "light" }: { tag: string; className?: string; tone?: "light" | "solid" }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[13px] font-bold tracking-wide whitespace-nowrap tabular",
        tone === "solid" ? "bg-white/95 text-deep shadow-sm" : "bg-primary-soft text-primary-ink",
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
      style={{ width: size, height: size, fontSize: size * 0.54 }}
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-white"
    >
      খ
    </span>
  );
}

export type Photo = { url: string; credit?: string | null; sourceUrl?: string | null };

/**
 * Page header. With a photo it becomes a banner: the picture fills a rounded panel and the
 * title sits on a solid forest-green block (never text over a gradient).
 */
export function PageHead({
  title,
  subtitle,
  eyebrow,
  actions,
  photo,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  photo?: Photo | null;
  children?: ReactNode;
}) {
  if (photo) {
    return (
      <div className="page-column pt-4 lg:pt-8">
        <div className="relative isolate overflow-hidden rounded-3xl bg-deep">
          <Image src={photo.url} alt="" fill priority sizes="(min-width: 1240px) 1160px, 100vw" className="drift -z-10 object-cover" />
          <div className="flex min-h-[280px] flex-col justify-end p-4 sm:min-h-[340px] sm:p-6">
            <div className="on-dark max-w-2xl rounded-2xl bg-deep/95 p-5 text-white sm:p-7">
              {eyebrow ? <p className="text-sm font-semibold text-accent">{eyebrow}</p> : null}
              <h1 className="mt-1 text-[length:var(--text-title)] leading-[1.1] font-extrabold text-balance">{title}</h1>
              {subtitle ? <p className="mt-2 text-deep-ink">{subtitle}</p> : null}
              {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>
          {photo.credit ? (
            <p className="absolute top-3 right-4 rounded-full bg-black/45 px-2.5 py-0.5 text-[12px] text-white/90">
              {photo.sourceUrl ? (
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="text-white/90 no-underline hover:underline">
                  {photo.credit}
                </a>
              ) : (
                photo.credit
              )}
            </p>
          ) : null}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    );
  }
  return (
    <div className="page-column pt-6 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
          <h1 className="text-[length:var(--text-title)] leading-[1.1] font-extrabold text-balance">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[17px] text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

/** Link tabs as pills, each with an optional count. Each tab is a URL. */
export function PillTabs({
  items,
  current,
  label,
}: {
  items: { key: string; href: string; label: string; count?: string }[];
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold no-underline transition-colors",
              active ? "bg-primary text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-primary hover:ring-primary/40",
            )}
          >
            {item.label}
            {item.count ? (
              <span className={clsx("text-[13px] font-medium", active ? "text-white/80" : "text-muted")}>{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="section-title">
        <span>{title}</span>
        {aside ? <span className="font-sans text-sm font-normal tracking-normal text-muted">{aside}</span> : null}
      </h2>
      {children}
    </section>
  );
}

export type StatTone = "green" | "warn" | "danger" | undefined;

export function StatCard({
  label,
  value,
  unit,
  note,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: StatTone;
  icon?: ReactNode;
  href?: string;
}) {
  const accent = tone === "green" ? "text-primary" : tone === "warn" ? "text-warn-ink" : tone === "danger" ? "text-danger-ink" : "text-ink";
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px] font-medium text-muted">{label}</span>
        {icon ? (
          <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex">
            {icon}
          </span>
        ) : null}
      </div>
      <span className={clsx("mt-1 block font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap tabular sm:text-[30px]", accent)}>
        {value}
        {unit ? <span className="ml-1.5 font-sans text-[15px] font-medium tracking-normal text-muted">{unit}</span> : null}
      </span>
      {note ? <span className="mt-1 block text-sm text-muted">{note}</span> : null}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5";
  return href ? (
    <Link href={href} className={clsx(cls, "text-ink no-underline transition-colors hover:border-primary/40")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <p className="font-display text-xl font-bold">{title}</p>
      {body ? <p className="mt-1 max-w-md text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
