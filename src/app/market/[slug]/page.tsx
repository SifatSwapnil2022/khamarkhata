import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";
import { AnimalPhoto } from "@/app/app/animals/AnimalPhoto";
import { BarChart } from "@/components/charts";
import { ListingCard } from "@/components/ListingCard";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Badge, Card } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { isDemoFarm } from "@/lib/demo";
import { fill, formatter } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { bdToday } from "@/server/common";
import { coatLabel } from "@/lib/coat";
import { getListing } from "@/server/market";
import { InquiryForm } from "./InquiryForm";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListing(await getDb(), slug);
  if (!l) return { title: "Listing" };
  return {
    title: l.card.title,
    description: l.description?.slice(0, 160) ?? undefined,
    openGraph: { title: l.card.title, images: l.photos[0] ? [{ url: `${l.photos[0].url}?w=1200&q=70&auto=format&fit=crop` }] : undefined },
  };
}

export default async function ListingPage({ params }: Params) {
  const [{ locale, t }, current, { slug }] = await Promise.all([getDictionary(), getCurrentUser(), params]);
  const m = t.market;
  const l = await getListing(await getDb(), slug);
  if (!l) notFound();
  const fmt = formatter(locale);
  const today = bdToday();
  const c = l.card;
  const lastW = l.weights.at(-1);
  const photo = l.photos[0] ?? null;
  const milkAvg = c.milkPerDay;
  const vName = (v: { name: string; nameBn: string | null }) => (locale === "bn" ? v.nameBn ?? v.name : v.name);
  const short = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  const facts: { label: string; value: string; note?: string }[] = [
    { label: m.fact.breed, value: c.breed ?? "—" },
    { label: m.fact.age, value: fmt.age(c.birthDate, today, t.animals.ageFmt) },
    { label: m.fact.sex, value: m.sexes[c.sex] },
    ...(l.color ? [{ label: m.fact.colour, value: coatLabel(l.color, locale)! }] : []),
    ...(lastW ? [{ label: m.fact.weight, value: `${fmt.n(lastW.kg)} ${t.animals.kg}`, note: fill(m.fact.weightBy, { method: m.methods[lastW.method as "scale" | "tape"] ?? lastW.method, date: fmt.date(lastW.date) }) }] : []),
    ...(milkAvg ? [{ label: m.fact.milk, value: fill(m.milk, { n: fmt.n(milkAvg, 1) }), note: m.fact.milkNote }] : []),
    { label: m.fact.origin, value: l.origin === "born" ? m.fact.born : m.fact.bought.replace("{date}", fmt.date(null)) },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader t={t} locale={locale} path={`/market/${slug}`} signedIn={Boolean(current)} />
      <main id="main" className="page-column pt-4 pb-14 lg:pt-6">
        <Link href="/market" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-muted no-underline hover:text-primary">
          ← {m.back}
        </Link>

        {isDemoFarm(c.farm) ? (
          <p role="note" className="mt-2 rounded-xl bg-warn-bg px-4 py-3 text-[15px] font-medium text-warn-ink">
            {m.demoNote}
          </p>
        ) : null}
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Left: photo and record */}
          <div className="flex min-w-0 flex-col gap-8">
            <figure className="relative overflow-hidden rounded-3xl border border-line bg-surface">
              <AnimalPhoto url={photo?.url ?? null} alt={c.title} noPhotoLabel={t.animals.noPhoto} sizes="(min-width: 1024px) 720px, 100vw" className="aspect-[4/3] w-full" priority />
              {photo?.credit ? (
                <figcaption className="absolute right-3 bottom-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[12px] text-white">
                  {m.photoBy}{" "}
                  {photo.sourceUrl ? (
                    <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="text-white underline-offset-2 hover:underline">
                      {photo.credit}
                    </a>
                  ) : (
                    photo.credit
                  )}
                </figcaption>
              ) : null}
            </figure>

            <section aria-labelledby="facts" className="flex flex-col gap-4">
              <div>
                <h2 id="facts" className="section-title justify-start gap-2">
                  <BadgeCheck aria-hidden="true" className="size-5 text-primary" /> {m.facts}
                </h2>
                <p className="mt-1 text-sm text-muted">{fill(m.factsNote, { farm: c.farm })}</p>
                <p className="mt-1 text-sm text-muted">{m.noCertify}</p>
              </div>
              <Card>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                  {facts.map((f) => (
                    <div key={f.label}>
                      <dt className="text-sm text-muted">{f.label}</dt>
                      <dd className="text-[17px] font-semibold">{f.value}</dd>
                      {f.note ? <dd className="text-[13px] text-muted">{f.note}</dd> : null}
                    </div>
                  ))}
                </dl>
              </Card>
            </section>

            {l.weights.length > 1 ? (
              <section className="flex flex-col gap-4">
                <h2 className="section-title">{m.weightChart}</h2>
                <Card>
                  <BarChart
                    data={l.weights.map((w, i) => ({
                      label: short.format(new Date(`${w.date}T00:00:00Z`)),
                      value: w.kg,
                      note: m.methods[w.method as "scale" | "tape"] ?? w.method,
                      tick: l.weights.length <= 16 || i % 3 === 0,
                    }))}
                    locale={locale}
                    unit={t.animals.kg}
                    name={m.fact.weight}
                    tableToggle={m.tableToggle}
                    colLabel={m.dayCol}
                    height={200}
                  />
                </Card>
              </section>
            ) : null}

            {l.milk.length > 7 ? (
              <section className="flex flex-col gap-4">
                <h2 className="section-title">{m.milkChart}</h2>
                <Card>
                  <BarChart
                    data={l.milk.map((d, i) => ({ label: short.format(new Date(`${d.date}T00:00:00Z`)), value: Math.round(d.litres * 10) / 10, tick: i % 10 === 0 }))}
                    locale={locale}
                    unit={t.animals.litre}
                    decimals={1}
                    name={m.fact.milk}
                    tableToggle={m.tableToggle}
                    colLabel={m.dayCol}
                    height={200}
                  />
                </Card>
              </section>
            ) : null}

            <div className="grid gap-8 sm:grid-cols-2">
              <section className="flex flex-col gap-4">
                <h2 className="section-title">{m.vaccinesTitle}</h2>
                <Card flush>
                  {l.vaccines.length === 0 ? (
                    <p className="p-5 text-muted">{m.noVaccines}</p>
                  ) : (
                    <table className="w-full text-left text-[15px]">
                      <thead>
                        <tr className="text-sm text-muted">
                          <th scope="col" className="px-4 py-3 font-semibold">{m.vaccineCols.vaccine}</th>
                          <th scope="col" className="px-4 py-3 font-semibold">{m.vaccineCols.given}</th>
                          <th scope="col" className="px-4 py-3 font-semibold">{m.vaccineCols.next}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {l.vaccines.map((v) => (
                          <tr key={v.name} className="border-t border-line">
                            <td className="px-4 py-2.5 font-semibold">{vName(v)}</td>
                            <td className="px-4 py-2.5 tabular">{fmt.date(v.date)}</td>
                            <td className="px-4 py-2.5 tabular">
                              {v.nextDue && v.nextDue >= today ? fmt.date(v.nextDue) : <Badge tone="warn">{fmt.date(v.nextDue)}</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
                <p className="flex items-start gap-2 text-[15px]">
                  {(l.treatments.meatUntil ?? "") >= today || (l.treatments.milkUntil ?? "") >= today ? (
                    <>
                      <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger-ink" />
                      <span className="text-danger-ink">
                        {(l.treatments.meatUntil ?? "") >= today ? fill(m.wdMeat, { date: fmt.date(l.treatments.meatUntil) }) : fill(m.wdMilk, { date: fmt.date(l.treatments.milkUntil) })}
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                      <span>
                        {l.treatments.count ? fill(m.treatments, { n: fmt.n(l.treatments.count) }) : m.noTreatments} {m.wdClear}
                      </span>
                    </>
                  )}
                </p>
              </section>

              <section className="flex flex-col gap-4">
                <h2 className="section-title">{m.pedigree}</h2>
                <Card className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm text-muted">{m.dam}</p>
                    <p className="font-semibold">{l.dam ? [l.dam.tag, l.dam.breed].filter(Boolean).join(" · ") : m.unknown}</p>
                  </div>
                  <div className="border-t border-line pt-4">
                    <p className="text-sm text-muted">{m.sire}</p>
                    <p className="font-semibold">{l.sire ? [l.sire.code, l.sire.breed].filter(Boolean).join(" · ") : m.unknown}</p>
                    {l.sire?.source ? <p className="text-[13px] text-muted">{l.sire.source}</p> : null}
                  </div>
                </Card>
              </section>
            </div>
          </div>

          {/* Right: price, farm, inquiry */}
          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">{m.categories[c.category]}</Badge>
                {l.status === "sold" ? <Badge tone="dark">{m.sold}</Badge> : null}
              </div>
              <h1 className="text-[1.75rem] leading-tight font-extrabold text-balance">{c.title}</h1>
              <p className="font-display text-[34px] leading-none font-extrabold tracking-[-0.02em] text-primary tabular">
                {fmt.tk(c.priceTk)}
                {c.negotiable ? <span className="ml-2 font-sans text-[15px] font-medium tracking-normal text-muted">{m.negotiable}</span> : null}
              </p>
              {l.description ? <p className="text-[16px] whitespace-pre-line text-ink-2">{l.description}</p> : null}
              <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3">
                <MapPin aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <div className="leading-tight">
                  <p className="font-semibold">{c.farm}</p>
                  <p className="text-sm text-muted">
                    {[c.upazila, c.district].filter(Boolean).join(", ")}
                    {l.farmSince ? ` · ${fill(m.farmSince, { date: fmt.date(l.farmSince) })}` : ""}
                  </p>
                </div>
              </div>
            </Card>
            {l.status === "active" ? (
              <Card>
                <h2 className="section-title">{m.ask}</h2>
                <p className="mt-1 mb-4 text-sm text-muted">{m.askNote}</p>
                <InquiryForm slug={slug} t={m} defaultName={current?.user.name ?? ""} defaultPhone={current?.user.phone ? current.user.phone.replace("+880", "0") : ""} />
              </Card>
            ) : null}
          </aside>
        </div>

        {l.more.length ? (
          <section className="mt-14 flex flex-col gap-4">
            <h2 className="section-title">{m.more}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {l.more.map((item) => (
                <li key={item.slug}>
                  <ListingCard item={item} t={t} fmt={fmt} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
