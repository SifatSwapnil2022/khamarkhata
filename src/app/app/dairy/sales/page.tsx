import type { Metadata } from "next";
import { Badge, Card, PageHead, Section } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { listBuyers, milkBalance, recentSales } from "@/server/dairy";
import { DairyTabs } from "../DairyTabs";
import { AddBuyerForm, PaymentForm, SaleForm } from "./SalesForms";

export const metadata: Metadata = { title: "Milk sales" };

export default async function SalesPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requirePermission("milk.sales")]);
  const d = t.dairy;
  const db = await getDb();
  const [buyers, sales, balance] = await Promise.all([listBuyers(db, ctx.farm.id), recentSales(db, ctx.farm.id, 30), milkBalance(db, ctx.farm.id, 7)]);
  const fmt = formatter(locale);
  const L = t.animals.litre;
  const totalDue = buyers.reduce((s, b) => s + b.dueTk, 0);
  const pct = balance.sellable ? Math.min(100, (balance.sold / balance.sellable) * 100) : 0;
  const options = buyers.map((b) => ({ id: b.id, name: b.name, due: b.dueTk, price: b.avgPrice ? Math.round(b.avgPrice) : null }));

  return (
    <>
      <PageHead title={d.sales} subtitle={`${d.stats.dues}: ${fmt.tk(totalDue)}`}>
        <DairyTabs current="sales" t={d} canRecord={can(ctx.role, "milk.record")} canSales />
      </PageHead>

      <div className="page-column grid gap-8 pt-6 pb-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section title={d.buyers}>
            {buyers.length === 0 ? (
              <Card>
                <p className="text-muted">{d.noBuyers}</p>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="text-sm text-muted">
                      <th scope="col" className="px-4 py-3 font-semibold">{d.buyerCols.buyer}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{d.buyerCols.last30}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{d.buyerCols.price}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{d.buyerCols.due}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((b) => (
                      <tr key={b.id} className="border-t border-line">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{b.name}</p>
                          <p className="text-[13px] text-muted">
                            {d.kinds[b.kind]}
                            {b.lastSale ? ` · ${d.buyerCols.last} ${fmt.short(b.lastSale)}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {fmt.n(b.litres30)} {L}
                          <span className="block text-[13px] text-muted">{fmt.tk(b.amount30)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular">{b.avgPrice ? fmt.n(b.avgPrice, 0) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {b.dueTk > 0 ? (
                            <Badge tone="warn" className="text-sm">
                              {fmt.tk(b.dueTk)}
                            </Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={d.balance}>
            <Card>
              <div className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-[15px] text-ink-2">
                {fill(d.balanceNote, { sold: `${fmt.n(balance.sold)} ${L}`, sellable: `${fmt.n(balance.sellable)} ${L}` })}
              </p>
            </Card>
          </Section>

          <Section title={d.recent}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="text-sm text-muted">
                    <th scope="col" className="px-4 py-3 font-semibold">{d.recentCols.date}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{d.recentCols.buyer}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">{d.recentCols.litres}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">{d.recentCols.amount}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{d.recentCols.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-t border-line text-[15px]">
                      <td className="px-4 py-2.5 whitespace-nowrap tabular">{fmt.short(s.date)}</td>
                      <td className="max-w-56 truncate px-4 py-2.5">{s.buyer ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {fmt.n(s.litres, 1)} <span className="text-[13px] text-muted">× ৳{fmt.n(s.price)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular">{fmt.tk(s.amount)}</td>
                      <td className="px-4 py-2.5">
                        {s.paid >= s.amount ? (
                          <Badge tone="green">{d.paid}</Badge>
                        ) : s.paid > 0 ? (
                          <Badge tone="warn">{d.partPaid}</Badge>
                        ) : (
                          <Badge tone="warn">{d.unpaid}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {buyers.length ? (
            <>
              <Card>
                <h2 className="section-title mb-4">{d.sale}</h2>
                <SaleForm buyers={options} today={bdToday()} t={d} locale={locale} />
              </Card>
              <Card>
                <h2 className="section-title mb-4">{d.payment}</h2>
                <PaymentForm buyers={options.filter((b) => b.due > 0)} t={d} locale={locale} />
              </Card>
            </>
          ) : null}
          <Card>
            <h2 className="section-title mb-4">{d.addBuyer}</h2>
            <AddBuyerForm t={d} />
          </Card>
        </aside>
      </div>
    </>
  );
}
