"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type StoryPhoto = { url: string; credit: string | null; sourceUrl: string | null };
export type StoryBeat = {
  time: string;
  title: string;
  body: string;
  figure?: { value: string; note: string } | null;
  photo: StoryPhoto | null;
  /** That animal's record, shown on its photo. */
  card: ReactNode;
  extra?: ReactNode;
};

/**
 * Scroll story. On a wide screen the photo stays in place and changes as each part of the day
 * scrolls past; on a phone every part carries its own photo above the words.
 */
export function PhotoStory({ beats, creditLabel }: { beats: StoryBeat[]; creditLabel: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of refs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      {/* Wide screens: one frame, photos cross-fade */}
      <div className="hidden lg:block">
        <div className="sticky top-0 flex h-svh items-center py-10">
          <div className="relative h-full max-h-[760px] w-full overflow-hidden rounded-[30px] bg-deep-2 shadow-[0_30px_80px_rgb(5_20_12/0.25)]">
            {beats.map((b, i) =>
              b.photo ? (
                <div key={i} className="story-photo absolute inset-0" data-on={i === active} aria-hidden={i !== active}>
                  <div className={`absolute inset-0 ${i === active ? "ken-burns-loop" : ""}`}>
                    <Image src={b.photo.url} alt="" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
                    <div className="record-card max-w-[22rem] rounded-2xl px-4 py-3">{b.card}</div>
                    <Credit photo={b.photo} label={creditLabel} />
                  </div>
                </div>
              ) : null,
            )}
            <ol className="absolute top-6 left-6 flex gap-1.5" aria-hidden="true">
              {beats.map((_, i) => (
                <li key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-white" : "w-3 bg-white/45"}`} />
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div>
        {beats.map((b, i) => (
          <article
            key={i}
            data-i={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="flex flex-col justify-center py-8 lg:min-h-svh lg:py-0"
          >
            {/* Phones: the photo travels with its words */}
            {b.photo ? (
              <figure className="relative mb-6 aspect-[4/3] overflow-hidden rounded-[24px] bg-deep-2 lg:hidden">
                <Image src={b.photo.url} alt="" fill sizes="100vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="record-card absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-2xl px-3.5 py-2.5">{b.card}</div>
                <figcaption className="absolute top-3 right-3">
                  <Credit photo={b.photo} label={creditLabel} />
                </figcaption>
              </figure>
            ) : null}
            <p className="text-[15px] font-semibold text-primary">{b.time}</p>
            <h3 className="mt-2 text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.08] font-extrabold tracking-[-0.025em] text-balance">{b.title}</h3>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">{b.body}</p>
            {b.figure ? (
              <p className="mt-6 flex max-w-[30rem] items-baseline gap-3 border-t border-line pt-4">
                <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-primary tabular">{b.figure.value}</span>
                <span className="text-[14px] leading-snug text-muted">{b.figure.note}</span>
              </p>
            ) : null}
            {b.extra}
          </article>
        ))}
      </div>
    </div>
  );
}

function Credit({ photo, label }: { photo: StoryPhoto; label: string }) {
  if (!photo.credit) return null;
  const text = label.replace("{credit}", photo.credit);
  return photo.sourceUrl ? (
    <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-medium text-white no-underline backdrop-blur-sm hover:bg-black/70">
      {text}
    </a>
  ) : (
    <span className="shrink-0 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm">{text}</span>
  );
}
