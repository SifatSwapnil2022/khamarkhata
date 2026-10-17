import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CloudOff, Languages, Users } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass, EarTag } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { creditOf, HOME_PHOTOS, sizedUrl } from "@/lib/photo-catalog";
import { getCurrentUser } from "@/server/auth";
import { bdToday } from "@/server/common";
import { getHomeData } from "@/server/home";
import { PhotoStory, type StoryBeat } from "./_home/PhotoStory";

export const metadata: Metadata = {
  title: { absolute: "Khamar Khata · খামার খাতা — farm records for Bangladeshi cattle farms" },
  description: "Milk per cow, vaccines, calving, pedigree and Qurbani weights, kept for every animal, for farms of 2 cows or 2,000. With a cattle market where listings carry the farm's records.",
};

function RecordLine({ tag, name, line, sub }: { tag: string; name?: string | null; line: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-2">
        <EarTag tag={tag} />
        {name ? <span className="truncate font-display text-[16px] font-extrabold">{name}</span> : null}
      </span>
      <span className="text-[14px] font-medium text-[#33473c] tabular">{line}</span>
      {sub ? <span className="text-[13px] text-[#5b6d62]">{sub}</span> : null}
    </div>
  );
}

export default async function HomePage() {
  const [{ locale, t }, current] = await Promise.all([getDictionary(), getCurrentUser()]);
  const h = t.home;
  const data = await getHomeData(await getDb());
  const fmt = formatter(locale);
  const today = bdToday();
  const nm = (o: { name: string | null; nameBn?: string | null }) => (locale === "bn" ? o.nameBn ?? o.name : o.name ?? o.nameBn);
  const demoHref = current ? "/app" : "/login?demo=1";
  const startHref = current ? "/app" : "/login";

  const cow = data.cows.find((c) => c.photo) ?? data.cows[0];
  const bull = data.bulls.find((b) => b.photo) ?? data.bulls[0];
  const fam = data.family;
  const sale = data.sale;

  const beats: StoryBeat[] = [
    {
      ...h.beats[0]!,
      figure: data.totals && data.day ? { value: fill(h.beats[0]!.figure, { litres: fmt.n(data.totals.litres) }), note: fill(h.beats[0]!.figureNote, { cows: fmt.n(data.totals.milkCows), date: fmt.date(data.day) }) } : null,
      photo: cow?.photo ?? null,
      card: cow ? <RecordLine tag={cow.tag} name={nm(cow)} line={fill(h.tags.litresOn, { n: fmt.n(cow.litres, 1), date: data.day ? fmt.date(data.day) : "" })} /> : null,
    },
    {
      ...h.beats[1]!,
      figure: data.totals ? { value: fmt.n(data.totals.pregnant), note: h.beats[1]!.figureNote } : null,
      photo: fam?.photo ?? null,
      card: fam ? (
        <RecordLine
          tag={fam.dam}
          name={locale === "bn" ? fam.damNameBn ?? fam.damName : fam.damName}
          line={fill(h.tags.calf, { calf: fam.calf, date: fmt.date(fam.calfBorn) })}
          sub={fam.sire ? fill(h.tags.sire, { sire: fam.sireBreed ? `${fam.sire} · ${fam.sireBreed}` : fam.sire }) : undefined}
        />
      ) : null,
    },
    {
      ...h.beats[2]!,
      figure: data.eid && data.totals ? { value: fmt.n(data.eid.days), note: fill(h.beats[2]!.figureNote, { bulls: fmt.n(data.totals.bulls) }) } : null,
      photo: bull?.photo ?? null,
      card: bull ? <RecordLine tag={bull.tag} name={nm(bull)} line={fill(h.tags.bull, { kg: fmt.n(bull.kg), proj: fmt.n(bull.projectedKg) })} /> : null,
    },
    {
      ...h.beats[3]!,
      figure: null,
      photo: sale?.photo ?? null,
      card: sale ? (
        <div className="flex flex-col gap-1">
          <span className="line-clamp-2 font-display text-[15px] leading-snug font-extrabold">{sale.listing.title}</span>
          <span className="text-[14px] font-medium text-[#33473c] tabular">{fill(h.tags.listed, { price: sale.listing.priceTk ? fmt.tk(sale.listing.priceTk) : "—" })}</span>
        </div>
      ) : null,
      extra: (
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/market" className={buttonClass("primary", "min-h-12 px-6 text-base")}>
            {h.ctaMarket}
          </Link>
        </div>
      ),
    },
  ];

  const hero = HOME_PHOTOS.hero;
  const listings = data.listings.slice(0, 6);

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <SiteHeader t={t} locale={locale} path="/" signedIn={Boolean(current)} tone="overlay" />

      <main id="main">
        {/* ───── Hero: a real morning on a real farm ───── */}
        <section aria-labelledby="home-title" className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-deep text-white">
          <div className="ken-burns absolute inset-0 -z-20">
            <Image src={hero.image} alt="" fill priority sizes="100vw" className="object-cover object-[72%_center]" />
          </div>
          <div className="photo-scrim absolute inset-0 -z-10" />
          <div className="page-column w-full pt-28 pb-[max(2.25rem,env(safe-area-inset-bottom))] lg:pb-20">
            <div className="max-w-[40rem]">
              <p lang="bn" aria-hidden="true" className="hero-wordmark font-display text-white">
                খামার খাতা
              </p>
              <h1 id="home-title" className="mt-4 text-[clamp(1.65rem,3.4vw,2.75rem)] leading-[1.08] font-extrabold tracking-[-0.025em] text-balance">
                {h.title}
              </h1>
              <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-white/85">{h.lede}</p>
              <p className="mt-3 text-[16px] font-semibold text-[#9be3b8]">{h.forEveryone}</p>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <Link href={startHref} className={buttonClass("light", "min-h-13 px-6 text-base")}>
                  {h.ctaStart}
                </Link>
                <Link href={demoHref} className="inline-flex min-h-13 items-center justify-center rounded-xl px-6 text-base font-semibold text-white no-underline ring-1 ring-white/40 hover:bg-white/10">
                  {h.ctaDemo}
                </Link>
              </div>
              <p className="scroll-cue mt-8 hidden items-center gap-3 text-[15px] font-medium text-white/80 sm:flex">
                <span aria-hidden="true" className="scroll-cue-line" />
                {h.scroll}
              </p>
            </div>
          </div>
        </section>

        {/* ───── A day on the farm, one animal at a time ───── */}
        <section aria-labelledby="home-story" className="page-column pt-16 lg:pt-20">
          <h2 id="home-story" className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">
            {h.storyTitle}
          </h2>
          <p className="mt-2 max-w-[60ch] text-[16px] text-ink-2">
            {h.storyNote} {h.demoData}
          </p>
          <PhotoStory beats={beats} creditLabel={h.heroCredit} />
        </section>

        {/* ───── Every size of farm ───── */}
        <section aria-labelledby="home-sizes" className="page-column py-16 lg:py-24">
          <h2 id="home-sizes" className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">
            {h.sizesTitle}
          </h2>
          <p className="mt-2 max-w-[60ch] text-[17px] text-ink-2">{h.sizesNote}</p>
          <ul className="mt-8 grid gap-5 md:grid-cols-3">
            {h.sizes.map((s, i) => {
              const ph = HOME_PHOTOS.sizes[i]!;
              return (
                <li key={s.title} className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow-card)]">
                  <figure className="relative aspect-[16/10] bg-surface-2">
                    <Image src={sizedUrl(ph.image, 800)} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
                    <figcaption className="absolute right-2.5 bottom-2.5">
                      <a href={ph.page} target="_blank" rel="noreferrer" className="rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white no-underline backdrop-blur-sm">
                        {creditOf(ph)}
                      </a>
                    </figcaption>
                  </figure>
                  <div className="p-5">
                    <h3 className="text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em]">{s.title}</h3>
                    <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ───── Three steps to start ───── */}
        <section aria-labelledby="home-steps" className="bg-primary-soft/60 py-16 lg:py-20">
          <div className="page-column">
            <h2 id="home-steps" className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">
              {h.stepsTitle}
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {h.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-[22px] bg-surface p-5 shadow-[var(--shadow-card)]">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-[20px] font-extrabold text-white">
                    {fmt.digits(String(i + 1))}
                  </span>
                  <span>
                    <span className="block text-[18px] leading-tight font-extrabold">{s.title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink-2">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href={startHref} className={buttonClass("primary", "min-h-12 px-6 text-base")}>
                {h.ctaStart}
              </Link>
              <Link href="/help" className={buttonClass("secondary", "min-h-12 px-6 text-base")}>
                {h.stepsHelp}
              </Link>
            </div>
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
            <p className="mt-2 max-w-[60ch] text-[17px] text-deep-ink">{h.photosNote}</p>
          </div>
          <ul className="photo-strip mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[max(1rem,calc((100vw-1240px)/2+2.5rem))] pb-4">
            {HOME_PHOTOS.strip.map((p, i) => (
              <li key={p.id} className="shrink-0 snap-start">
                <figure className={`relative overflow-hidden rounded-[22px] bg-deep-2 ${i % 3 === 1 ? "h-[340px] w-[260px]" : "h-[340px] w-[420px] max-sm:w-[300px]"}`}>
                  <Image src={sizedUrl(p.image, 840)} alt="" fill sizes="420px" className="object-cover" />
                  <figcaption className="absolute inset-x-3 bottom-3 rounded-xl bg-black/45 px-3 py-2 text-[13px] leading-tight text-white backdrop-blur-sm">
                    <span className="block font-semibold">{p.place}</span>
                    <a href={p.page} target="_blank" rel="noreferrer" className="text-white/80 no-underline hover:underline">
                      {p.photographer} · {p.source}
                    </a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p className="page-column mt-4 text-[13px] text-deep-ink">{h.photoCredit}</p>
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
            <Image src={sizedUrl(HOME_PHOTOS.sizes[1]!.image, 1600)} alt="" fill sizes="1240px" className="-z-10 object-cover opacity-25 mix-blend-luminosity" />
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
