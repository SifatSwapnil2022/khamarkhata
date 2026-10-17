import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { inquiryStatusAction, listingStatusAction } from "@/app/actions/market";
import { AnimalPhoto } from "@/app/app/animals/AnimalPhoto";
import { Badge, buttonClass, Card, EmptyState, PageHead, PillTabs, type BadgeTone } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { requirePermission } from "@/server/auth";
import { farmInquiries, farmListings } from "@/server/market";

export const metadata: Metadata = { title: "Marketplace" };

const STATUS_TONE: Record<string, BadgeTone> = { active: "green", draft: "plain", sold: "dark", withdrawn: "warn" };

export default async function FarmMarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("listing.manage"), searchParams]);
  const m = t.market;
  const db = await getDb();
  const [listings, inbox] = await Promise.all([farmListings(db, ctx.farm.id), farmInquiries(db, ctx.farm.id)]);
  const fmt = formatter(locale);
  const tab = sp.tab === "inbox" ? "inbox" : "listings";
  const fresh = inbox.filter((i) => i.status === "new").length;
  const when = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });

  return (
    <>
      <PageHead photo={bannerFor("market")} eyebrow={ctx.farm.name} title={m.manage} subtitle={m.manageSubtitle}>
        <PillTabs
          label={m.manage}
          current={tab}
          items={[
            { key: "listings", href: "/app/market", label: m.tabs.listings, count: fmt.n(listings.filter((l) => l.status === "active").length) },
            { key: "inbox", href: "/app/market?tab=inbox", label: m.tabs.inbox, count: fresh ? fill(m.newCount, { n: fmt.n(fresh) }) : fmt.n(inbox.length) },
          ]}
        />
      </PageHead>

      <div className="page-column flex flex-col gap-4 pt-6 pb-12">
        {tab === "listings" ? (
          listings.length === 0 ? (
            <EmptyState title={m.noListings} />
          ) : (
            <ul className="flex flex-col gap-3">
              {listings.map((l) => (
                <li key={l.slug}>
                  <Card className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[88px_minmax(0,1fr)_auto]">
                    <AnimalPhoto url={l.photoUrl} alt="" noPhotoLabel="" sizes="88px" className="size-[72px] rounded-xl sm:size-[88px] [&_span]:hidden" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[l.status]}>{m.statuses[l.status]}</Badge>
                        <span className="text-sm text-muted">{m.categories[l.category]}</span>
                        {l.newInquiries ? <Badge tone="warn">{fill(m.newCount, { n: fmt.n(l.newInquiries) })}</Badge> : null}
                      </p>
                      <p className="mt-1 truncate text-[17px] font-semibold">{l.title}</p>
                      <p className="text-[15px] text-ink-2 tabular">
                        {fmt.tk(l.priceTk)} · {l.tag}
                        {l.weightKg ? ` · ${fmt.n(l.weightKg)} ${t.animals.kg}` : ""} · {fill(m.inquiriesCount, { n: fmt.n(l.inquiries) })}
                      </p>
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
                      {l.status === "active" || l.status === "sold" ? (
                        <Link href={`/market/${l.slug}`} className={buttonClass("ghost")}>
                          {m.view}
                        </Link>
                      ) : null}
                      {l.status === "active" || l.status === "draft" || l.status === "withdrawn" ? (
                        <form action={listingStatusAction}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="status" value={l.status === "active" ? "withdrawn" : "active"} />
                          <button type="submit" className={buttonClass("secondary")}>
                            {l.status === "active" ? m.takeDown : l.status === "draft" ? m.publish : m.putBack}
                          </button>
                        </form>
                      ) : null}
                      {l.status === "active" ? (
                        <Link href={`/app/animals/${encodeURIComponent(l.tag)}/exit`} className={buttonClass("primary")}>
                          {m.markSold}
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        ) : inbox.length === 0 ? (
          <EmptyState title={m.noInquiries} />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {inbox.map((q) => (
              <li key={q.id}>
                <Card className={`flex h-full flex-col gap-3 ${q.status === "closed" ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{q.name}</p>
                      <p className="text-sm text-muted">{when.format(new Date(q.createdAt))}</p>
                    </div>
                    <Badge tone={q.status === "new" ? "warn" : q.status === "replied" ? "green" : "plain"}>{m.inquiryStatus[q.status]}</Badge>
                  </div>
                  <Link href={`/market/${q.slug}`} className="truncate text-sm font-semibold text-primary no-underline hover:underline">
                    {q.tag} · {q.title}
                  </Link>
                  {q.message ? <p className="text-[15px] text-ink-2">{q.message}</p> : null}
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
                    <a href={`tel:${q.phone}`} className={buttonClass("primary")}>
                      <Phone aria-hidden="true" className="size-4" /> {m.call} {q.phone.replace("+880", "0")}
                    </a>
                    <form action={inquiryStatusAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="status" value={q.status === "new" ? "replied" : q.status === "replied" ? "closed" : "new"} />
                      <button type="submit" className={buttonClass("ghost")}>
                        {q.status === "new" ? m.markReplied : q.status === "replied" ? m.close : m.reopen}
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
