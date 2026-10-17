import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PairBars, RankBars } from "@/components/charts";
import { Badge, buttonClass, Card, PageHead, PillTabs, Section, Select, StatCard } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { EXPENSE_CATEGORIES, EXPORTS, financeSummary, listExpenses, PERIODS, resolvePeriod, type ExpenseCategory } from "@/server/finance";
import { ExpenseForm } from "./ExpenseForm";

export const metadata: Metadata = { title: "Finance" };

const PHONE_ROWS = 12;

type Search = { period?: string; from?: string; to?: string; category?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("finance.view"), searchParams]);
  const f = t.finance;
  const today = bdToday();
  const { period, from, to } = resolvePeriod(sp, today);
  const category = EXPENSE_CATEGORIES.includes(sp.category as ExpenseCategory) ? (sp.category as ExpenseCategory) : undefined;
  const db = await getDb();
  const [sum, ledger] = await Promise.all([financeSummary(db, ctx.farm.id, from, to), listExpenses(db, ctx.farm.id, from, to, category)]);
  const fmt = formatter(locale);
  const canRecord = can(ctx.role, "finance.record");
  const range = (extra: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    const merged = { period, from: period === "custom" ? from : undefined, to: period === "custom" ? to : undefined, category, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return p.toString();
  };
  const Note = ({ e }: { e: (typeof ledger)[number] }) => (
    <>
      {e.tag ? (
        <Link href={`/app/animals/${encodeURIComponent(e.tag)}`} className="mr-1.5 font-semibold">
          {e.tag}
        </Link>
      ) : null}
      <span className="break-words">{e.note}</span>
      {e.animals > 1 ? <span className="text-muted"> · {fill(f.animalsCount, { n: fmt.n(e.animals) })}</span> : null}
      {e.source === "health" ? <Badge className="ml-1.5">{f.fromHealth}</Badge> : null}
    </>
  );
  const LedgerItem = ({ e }: { e: (typeof ledger)[number] }) => (
    <li className="border-t border-line px-4 py-3 first:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{f.categories[e.category]}</span>
        <span className="font-semibold whitespace-nowrap tabular">{fmt.tk(e.amount)}</span>
      </div>
      <p className="mt-0.5 text-sm text-ink-2">
        <span className="text-muted tabular">{fmt.date(e.date)}</span>
        {e.note || e.tag ? " · " : null}
        <Note e={e} />
      </p>
    </li>
  );
  const monthFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

  return (
    <>
      <PageHead title={f.title} subtitle={`${f.subtitle} ${fmt.date(from)} – ${fmt.date(to)}`}>
        <div className="flex flex-col gap-3">
          <PillTabs
            label={f.title}
            current={period}
            items={PERIODS.filter((p) => p !== "custom").map((p) => ({ key: p, href: `/app/finance?period=${p}`, label: f.periods[p] }))}
          />
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="period" value="custom" />
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {f.from}
              <input type="date" name="from" defaultValue={from} max={today} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px] font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              {f.to}
              <input type="date" name="to" defaultValue={to} max={today} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px] font-normal" />
            </label>
            <button type="submit" className={buttonClass(period === "custom" ? "primary" : "secondary")}>
              {f.show}
            </button>
          </form>
        </div>
      </PageHead>

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={f.revenue} value={fmt.tkShort(sum.revenue)} note={fill(f.revenueNote, { milk: fmt.tkShort(sum.milk), animals: fmt.tkShort(sum.animalSales) })} tone="green" />
          <StatCard label={f.expenses} value={fmt.tkShort(sum.expenses)} note={fmt.tk(sum.expenses)} />
          <StatCard label={f.net} value={fmt.tkShort(sum.net)} note={`${f.netNote}: ${sum.net < 0 ? "−\u2060" : ""}${fmt.tk(Math.abs(sum.net))}`} tone={sum.net < 0 ? "danger" : "green"} />
          <StatCard label={f.milkDue} value={fmt.tkShort(sum.milkDue)} note={f.milkDueNote} tone={sum.milkDue ? "warn" : undefined} href="/app/dairy/sales" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Section title={f.monthly}>
            <Card>
              <PairBars
                rows={sum.monthly.map((m) => ({ label: monthFmt.format(new Date(`${m.month}-01T00:00:00Z`)), a: m.revenue, b: m.expenses }))}
                locale={locale}
                names={[f.revenue, f.expenses]}
                tableToggle={t.animals.profile.tableToggle}
                colLabel={f.monthCol}
              />
            </Card>
          </Section>
          <Section title={f.byCategory}>
            <Card>
              {sum.byCategory.length === 0 ? (
                <p className="text-muted">{f.noExpenses}</p>
              ) : (
                <RankBars locale={locale} prefix="৳" rows={sum.byCategory.map((c) => ({ label: f.categories[c.category], value: c.total }))} />
              )}
            </Card>
          </Section>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Section title={f.ledger} aside={f.ledgerNote}>
            <form method="get" className="flex flex-wrap items-center gap-2">
              {Object.entries({ period, from: period === "custom" ? from : undefined, to: period === "custom" ? to : undefined }).map(([k, v]) =>
                v ? <input key={k} type="hidden" name={k} value={v} /> : null,
              )}
              <label htmlFor="category" className="sr-only">
                {f.form.category}
              </label>
              <Select id="category" name="category" defaultValue={category ?? ""} className="w-auto">
                <option value="">{f.allCategories}</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {f.categories[c]}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClass("secondary")}>
                {f.show}
              </button>
            </form>
            {ledger.length === 0 ? (
              <Card>
                <p className="text-muted">{f.noExpenses}</p>
              </Card>
            ) : (
              <>
                {/* Phones: one record per row, newest first; the rest folds away */}
                <div className="sm:hidden">
                  <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                    {ledger.slice(0, PHONE_ROWS).map((e) => (
                      <LedgerItem key={e.id} e={e} />
                    ))}
                  </ul>
                  {ledger.length > PHONE_ROWS ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-semibold text-primary">{fill(f.showMore, { n: fmt.n(ledger.length - PHONE_ROWS) })}</summary>
                      <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                        {ledger.slice(PHONE_ROWS).map((e) => (
                          <LedgerItem key={e.id} e={e} />
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] sm:block">
                  <table className="w-full text-left text-[15px]">
                    <thead>
                      <tr className="text-sm text-muted">
                        <th scope="col" className="px-4 py-3 font-semibold">{f.ledgerCols.date}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{f.ledgerCols.category}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{f.ledgerCols.note}</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">{f.ledgerCols.amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((e) => (
                        <tr key={e.id} className="border-t border-line">
                          <td className="px-4 py-2.5 whitespace-nowrap tabular">{fmt.date(e.date)}</td>
                          <td className="px-4 py-2.5">{f.categories[e.category]}</td>
                          <td className="max-w-72 px-4 py-2.5 text-ink-2">
                            <Note e={e} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular">{fmt.tk(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          <aside className="order-first flex min-w-0 flex-col gap-6 lg:order-none">
            {canRecord ? (
              <Card>
                <h2 className="section-title mb-4">{f.add}</h2>
                <ExpenseForm t={f} today={today} />
              </Card>
            ) : null}
            <Card>
              <h2 className="section-title">{f.exports}</h2>
              <p className="mt-1 mb-3 text-sm text-muted">{f.exportsNote}</p>
              <ul className="flex flex-wrap gap-2">
                {EXPORTS.map((k) => (
                  <li key={k}>
                    <a href={`/app/export/${k}?${range({ category: undefined })}`} className={buttonClass("secondary", "min-h-10 px-3 text-sm")} download>
                      <Download aria-hidden="true" className="size-4" /> {f.exportKinds[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="section-title">{f.definitions}</h2>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] text-ink-2">
                {f.definitionsBody.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
