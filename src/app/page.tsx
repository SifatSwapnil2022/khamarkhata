import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CloudOff, Languages, Moon, Sunrise, Sun, Sunset, Users } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { PHOTOS, photoAt } from "@/lib/photos";
import { getCurrentUser } from "@/server/auth";
import { bdToday } from "@/server/common";
import { getHomeData } from "@/server/home";
import type { SceneTag } from "./_home/FarmScene";
import { HomeScene } from "./_home/HomeScene";

export const metadata: Metadata = {
  title: { absolute: "Khamar Khata · খামার খাতা — farm records for Bangladeshi cattle farms" },
  description: "Milk per cow, vaccines, calving, pedigree and Qurbani weights, kept for every animal. With a cattle market where listings carry the farm's records.",
};

const TRACK = "farm-day";
const BEAT_ICONS = [Sunrise, Sun, Sunset, Moon];

export default async function HomePage() {
  const [{ locale, t }, current] = await Promise.all([getDictionary(), getCurrentUser()]);
  const h = t.home;
  const data = await getHomeData(await getDb());
  const fmt = formatter(locale);
  const today = bdToday();
  const nm = (o: { name: string | null; nameBn?: string | null }) => (locale === "bn" ? o.nameBn ?? o.name : o.name ?? o.nameBn);
  const label = (tag: string, name: string | null | undefined) => (name ? `${tag} · ${name}` : tag);

  /* Ear tags carry each animal's real record from the demo farm. */
  const cowTag = (c: (typeof data.cows)[number], id: string, beats: number[]): SceneTag => ({
    id,
    beats,
    title: label(c.tag, nm(c)),
    line: fill(h.tags.litresToday, { n: fmt.n(c.litres, 1) }),
    tone: "milk",
  });
  const bullTag = (b: (typeof data.bulls)[number], id: string, beats: number[]): SceneTag => ({
    id,
    beats,
    title: label(b.tag, b.name),
    line: fill(h.tags.bull, { kg: fmt.n(b.kg), proj: fmt.n(b.projectedKg) }),
    tone: "weight",
  });
  const dairy = data.cows.slice(0, 6).map((c, i) => cowTag(c, `dairy-${i}`, [1]));
  const bulls = data.bulls.slice(0, 5).map((b, i) => bullTag(b, `bull-${i}`, [3]));
  const f = data.family;
  const family = f
    ? {
        dam: { id: "dam", beats: [2], title: label(f.dam, f.damName), line: fill(h.tags.mother, { calf: f.calf }), tone: "kin" as const },
        calf: { id: "calf", beats: [0, 2], title: f.calf, line: fill(h.tags.calf, { date: fmt.date(f.calfBorn) }), tone: "kin" as const },
        sire: { id: "sire", beats: [2], title: f.sire ?? "—", line: f.sireBreed ? fill(h.tags.sire, { breed: f.sireBreed }) : h.tags.sireNoBreed, tone: "sire" as const },
      }
    : null;
  const heroTags = [data.cows[2] && cowTag(data.cows[2], "hero-cow", [0]), data.bulls[2] && bullTag(data.bulls[2], "hero-bull", [0])].filter(Boolean) as SceneTag[];

  const figures = [
    data.totals && data.day
      ? { figure: fill(h.beats[0]!.figure, { litres: fmt.n(data.totals.litres) }), note: fill(h.beats[0]!.figureNote, { cows: fmt.n(data.cows.length ? data.totals.milkCows : 0), date: fmt.date(data.day), farm: data.farm?.name ?? "" }) }
      : null,
    data.totals ? { figure: fmt.n(data.totals.pregnant), note: h.beats[1]!.figureNote } : null,
    data.eid && data.totals ? { figure: fmt.n(data.eid.days), note: fill(h.beats[2]!.figureNote, { bulls: fmt.n(data.totals.bulls) }) } : null,
    null,
  ];
  const listings = data.listings.slice(0, 6);
  const fallback = photoAt(8);
  const demoHref = current ? "/app" : "/login?demo=1";

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <SiteHeader t={t} locale={locale} path="/" signedIn={Boolean(current)} tone="overlay" />

      <main id="main">
        {/* ───── A day on the farm: the 3D scene stays put while the day passes ───── */}
        <section id={TRACK} aria-label={h.title} className="theme-light relative" style={{ height: "500svh" }}>
          <div className="sticky top-0 h-svh overflow-hidden">
            <HomeScene
              trackId={TRACK}
              heroTags={heroTags}
              dairy={dairy}
              bulls={bulls}
              family={family}
              fallback={{ url: fallback.url, credit: fallback.credit }}
              loading={h.sceneLoading}
            />
          </div>

          <div className="relative -mt-[100svh]">
            {/* Dawn: the farm and the promise */}
            <div className="page-column flex h-svh flex-col justify-end pb-[max(2rem,env(safe-area-inset-bottom))] lg:justify-center lg:pb-0">
              <div className="max-w-[34rem] rounded-[28px] bg-white/80 p-6 backdrop-blur-md sm:p-8 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <p lang="bn" aria-hidden="true" className="hero-wordmark font-display text-deep">
                  খামার খাতা
                </p>
                <h1 className="mt-3 text-[clamp(1.6rem,3.2vw,2.6rem)] leading-[1.08] font-extrabold tracking-[-0.025em] text-ink text-balance">{h.title}</h1>
                <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">{h.lede}</p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Link href={demoHref} className={buttonClass("primary", "min-h-12 px-6 text-base")}>
                    {h.ctaDemo}
                  </Link>
                  <Link href="/market" className={buttonClass("secondary", "min-h-12 px-6 text-base")}>
                    {h.ctaMarket}
                  </Link>
                </div>
                <p className="mt-5 max-w-[46ch] text-[13px] leading-snug text-muted">{h.demoData}</p>
                <p className="scroll-cue mt-6 hidden items-center gap-3 text-[15px] font-medium text-ink-2 lg:flex">
                  <span aria-hidden="true" className="scroll-cue-line" />
                  {h.scroll}
                </p>
              </div>
            </div>

            {/* Morning, noon, dusk, night */}
            {h.beats.map((b, i) => {
              const Icon = BEAT_ICONS[i]!;
              const dark = i >= 2;
              const fig = figures[i];
              return (
                <div key={b.time} className="page-column flex h-svh items-end pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:items-center lg:pb-0">
                  <article
                    className={`beat-panel w-full max-w-[27rem] rounded-[28px] p-6 sm:p-8 ${dark ? "on-dark bg-[#0d2036]/88 text-white" : "bg-white/90 text-ink"}`}
                  >
                    <p className={`flex items-center gap-2 text-[15px] font-semibold ${dark ? "text-[#bcd3ff]" : "text-primary"}`}>
                      <Icon aria-hidden="true" className="size-[18px]" />
                      {b.time}
                    </p>
                    <h2 className="mt-3 text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.1] font-extrabold tracking-[-0.025em] text-balance">{b.title}</h2>
                    <p className={`mt-3 text-[16px] leading-relaxed max-lg:line-clamp-4 ${dark ? "text-white/80" : "text-ink-2"}`}>{b.body}</p>
                    {fig ? (
                      <p className={`mt-5 flex items-baseline gap-3 border-t pt-4 ${dark ? "border-white/15" : "border-line"}`}>
                        <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap tabular">{fig.figure}</span>
                        <span className={`text-[14px] leading-snug ${dark ? "text-white/70" : "text-muted"}`}>{fig.note}</span>
                      </p>
                    ) : null}
                    {i === 3 ? (
                      <div className="mt-6 flex flex-wrap gap-2.5">
                        <Link href="/market" className={buttonClass("light")}>
                          {h.ctaMarket}
                        </Link>
                        <Link href={demoHref} className="inline-flex min-h-11 items-center rounded-xl px-4 text-[15px] font-semibold text-white no-underline ring-1 ring-white/30 hover:bg-white/10">
                          {h.ctaDemo}
                        </Link>
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>
        </section>

        {/* ───── The market ───── */}
        {listings.length ? (
          <section aria-labelledby="home-market" className="page-column py-16 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="home-market" className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">
                  {h.market}
                </h2>
                <p className="mt-2 text-[17px] text-ink-2">{h.marketNote}</p>
              </div>
              <Link href="/market" className={buttonClass("secondary")}>
                {h.marketAll}
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {listings.map((item) => (
                <li key={item.slug}>
                  <ListingCard item={item} t={t} fmt={fmt} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ───── Real photographs ───── */}
        <section aria-labelledby="home-photos" className="bg-deep py-16 text-white lg:py-24">
          <div className="page-column">
            <h2 id="home-photos" className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">
              {h.photos}
            </h2>
            <p className="mt-2 text-[17px] text-deep-ink">{h.photosNote}</p>
          </div>
          <ul className="photo-strip mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[max(1rem,calc((100vw-1240px)/2+2.5rem))] pb-4">
            {PHOTOS.slice(0, 10).map((p, i) => (
              <li key={p.page} className="shrink-0 snap-start">
                <figure className={`relative overflow-hidden rounded-[22px] bg-deep-2 ${i % 3 === 1 ? "h-[340px] w-[260px]" : "h-[340px] w-[420px] max-sm:w-[300px]"}`}>
                  <Image src={p.image} alt="" fill sizes="420px" className="object-cover" />
                  <figcaption className="absolute inset-x-3 bottom-3 rounded-xl bg-black/45 px-3 py-2 text-[13px] leading-tight text-white backdrop-blur-sm">
                    <span className="block font-semibold">{p.place}</span>
                    <a href={p.page} target="_blank" rel="noreferrer" className="text-white/80 no-underline hover:underline">
                      {p.photographer} · Unsplash
                    </a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

        {/* ───── Three plain facts ───── */}
        <section className="page-column grid gap-10 py-16 sm:grid-cols-3 lg:py-24">
          {h.facts.map((fct, i) => {
            const Icon = [CloudOff, Languages, Users][i]!;
            return (
              <div key={fct.title} className="border-t-2 border-primary pt-5">
                <Icon aria-hidden="true" className="size-6 text-primary" />
                <h3 className="mt-3 text-[1.35rem] leading-tight font-extrabold tracking-[-0.02em]">{fct.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{fct.body}</p>
              </div>
            );
          })}
        </section>

        {/* ───── Demo ───── */}
        <section className="page-column pb-16 lg:pb-24">
          <div className="relative isolate overflow-hidden rounded-[32px] bg-primary px-6 py-10 text-white sm:px-12 sm:py-14">
            <Image src={photoAt(0).url} alt="" fill sizes="1240px" className="-z-10 object-cover opacity-25 mix-blend-luminosity" />
            <h2 className="max-w-xl text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">{h.demoTitle}</h2>
            <p className="mt-3 max-w-xl text-[17px] text-white/85">{h.demoBody}</p>
            <Link href={demoHref} className={buttonClass("light", "mt-7 min-h-12 px-6 text-base")}>
              {h.ctaDemo}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
