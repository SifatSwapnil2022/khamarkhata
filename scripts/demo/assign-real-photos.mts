/**
 * Writes a migration that gives the demo farm's animals real photographs, one photo per animal,
 * and gives the named Qurbani bulls haat-style names that match their coat
 * (Kalo Manik and Kala Pahar for black bulls, Dhola Pahar for white, Lal Badsha for red…),
 * the way owners name them in the newspaper reports from each Eid's cattle haats.
 *
 * It removes only the stock Unsplash photos the demo seed added, never a photo someone uploaded.
 * Run once: npx tsx scripts/demo/assign-real-photos.mts
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "../../src/db/client";
import { rowsOf } from "../../src/db/rows";
import { ANIMAL_PHOTOS, sizedUrl, type CatalogPhoto } from "../../src/lib/photo-catalog";

const NAME = "20261017083000_demo_real_photos";
const DIR = path.join(process.cwd(), "netlify/database/migrations");
const OUT = path.join(DIR, NAME);
if (existsSync(OUT)) {
  console.error(`${NAME} already exists; delete it first if you really mean to regenerate.`);
  process.exit(1);
}

type Row = { tag: string; purpose: string; name: string | null; color: string | null; listed: boolean; young_calf: boolean };

const db = await createDb("memory", { migrate: true });
const rows = rowsOf<Row>(
  await db.execute(sql`
    select a.tag, a.purpose, a.name, a.color,
      exists (select 1 from listings l where l.animal_id = a.id) as listed,
      exists (select 1 from animals c where c.dam_id = a.id and c.birth_date > date '2026-10-13' - 150) as young_calf
    from animals a join farms f on f.id = a.farm_id and f.name like '%(demo)'
    where a.lifecycle = 'active'
    order by a.tag`),
);

type Hue = "black" | "white" | "red" | "mixed";
/** "mixed" also covers a coat nobody can confirm, so it only ever gets names that don't name a colour. */
const hueOf = (c: string | null | undefined): Hue => {
  if (!c) return "mixed";
  const s = c.toLowerCase();
  if (s.includes(" and ") || s.includes("face")) return "mixed";
  if (s.includes("black")) return "black";
  if (s.includes("white") || s.includes("grey")) return "white";
  return "red";
};

/* ── Names heard at the haats, grouped by coat ──
 * From newspaper reports of Eid cattle haats: Kala Pahar and Kalo Manik for black bulls, Dhola/Shada
 * Pahar for white, Lal Pahar and Lalu for red, and Raja Babu, Sultan, Badsha, Samrat, Bahadur for any
 * coat. Names of living people (film stars, politicians, players) are left out on purpose. */
const B = (en: string, bn: string): [string, string] => [en, bn];
const NAMES: Record<Hue, [string, string][]> = {
  black: [B("Kala Pahar", "কালা পাহাড়"), B("Kalo Manik", "কালো মানিক"), B("Kala Badsha", "কালা বাদশা"), B("Kalu Mia", "কালু মিয়া"), B("Kalo Raja", "কালো রাজা"), B("Kala Chan", "কালা চান"), B("Kala Babu", "কালা বাবু"), B("Kalo Hira", "কালো হীরা"), B("Kalo Sultan", "কালো সুলতান"), B("Kalo Nawab", "কালো নবাব"), B("Kalo Samrat", "কালো সম্রাট"), B("Kalo Toofan", "কালো তুফান"), B("Kala Mastan", "কালা মাস্তান"), B("Kalo Bahadur", "কালো বাহাদুর"), B("Kalo Sardar", "কালো সর্দার"), B("Kalo Megh", "কালো মেঘ"), B("Kala Jomidar", "কালা জমিদার"), B("Kalu", "কালু")],
  white: [B("Dhola Pahar", "ধলা পাহাড়"), B("Shada Pahar", "সাদা পাহাড়"), B("Shada Manik", "সাদা মানিক"), B("Dholu", "ধলু"), B("Shada Badsha", "সাদা বাদশা"), B("Dhola Mia", "ধলা মিয়া"), B("Megh Raja", "মেঘরাজা"), B("Rajhans", "রাজহাঁস"), B("Shwet Raja", "শ্বেত রাজা"), B("Dhola Raja", "ধলা রাজা"), B("Shada Sultan", "সাদা সুলতান"), B("Dhola Babu", "ধলা বাবু"), B("Shada Nawab", "সাদা নবাব"), B("Shada Samrat", "সাদা সম্রাট"), B("Dhola Chan", "ধলা চান"), B("Shada Hira", "সাদা হীরা"), B("Chand Raja", "চাঁদ রাজা"), B("Dhola Jomidar", "ধলা জমিদার"), B("Shada Toofan", "সাদা তুফান"), B("Dhola Bahadur", "ধলা বাহাদুর")],
  red: [B("Lal Pahar", "লাল পাহাড়"), B("Lal Badsha", "লাল বাদশা"), B("Lalu", "লালু"), B("Lal Mia", "লাল মিয়া"), B("Lal Manik", "লাল মানিক"), B("Sonar Chan", "সোনার চান"), B("Raja Mia", "রাজা মিয়া"), B("Lalu Mastan", "লালু মাস্তান"), B("Lal Raja", "লাল রাজা"), B("Lal Sultan", "লাল সুলতান"), B("Lal Nawab", "লাল নবাব"), B("Lal Samrat", "লাল সম্রাট"), B("Lal Toofan", "লাল তুফান"), B("Lal Babu", "লাল বাবু"), B("Lal Hira", "লাল হীরা"), B("Lal Jomidar", "লাল জমিদার"), B("Lal Bahadur", "লাল বাহাদুর"), B("Sona Mia", "সোনা মিয়া"), B("Lal Chan", "লাল চান")],
  mixed: [B("Raja Babu", "রাজা বাবু"), B("Sultan", "সুলতান"), B("Samrat", "সম্রাট"), B("Badsha", "বাদশা"), B("Shahenshah", "শাহেনশাহ"), B("Bahadur", "বাহাদুর"), B("Nawab", "নবাব"), B("Toofan", "তুফান"), B("Maharaja", "মহারাজা"), B("Jomidar", "জমিদার"), B("Sardar", "সর্দার"), B("Shahzada", "শাহজাদা"), B("Rustom", "রুস্তম"), B("Bagha", "বাঘা"), B("Durjoy", "দুর্জয়"), B("Bir", "বীর"), B("Rajkumar", "রাজকুমার"), B("Sinbad", "সিনবাদ")],
};
const SPARE: [string, string][] = [B("Mastan", "মাস্তান"), B("Pathan", "পাঠান"), B("Bijoy", "বিজয়"), B("Tiger", "টাইগার"), B("Pagla", "পাগলা"), B("Boss", "বস"), B("Pahari", "পাহাড়ি"), B("Raja", "রাজা")];

const used = new Set<string>();
const bnDigits = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
/** A coat-matched haat name; when a coat's names run out, the next is numbered as owners do ("Pagla-2"). */
function takeName(hue: Hue): [string, string] {
  const pool = [...NAMES[hue], ...SPARE];
  for (const n of pool) {
    if (!used.has(n[0])) {
      used.add(n[0]);
      return n;
    }
  }
  for (let k = 2; ; k++) {
    for (const n of pool) {
      const en = `${n[0]}-${k}`;
      if (!used.has(en)) {
        used.add(en);
        return [en, `${n[1]}-${bnDigits(k)}`];
      }
    }
  }
}

/* ── Cow names as village farmers give them: some say the coat (Lali is red, Dholi white,
 * Kali black, Shyamoli dark grey), most are flowers, birds, months and pet names. ── */
const COW_COAT: Record<Hue, [string, string][]> = {
  red: [B("Lali", "লালি"), B("Sonali", "সোনালী"), B("Lalbanu", "লালবানু")],
  white: [B("Dholi", "ধলি"), B("Dhoboli", "ধবলী"), B("Shada", "সাদা"), B("Rupali", "রুপালী")],
  black: [B("Kali", "কালী"), B("Kajol", "কাজল"), B("Kalobanu", "কালোবানু")],
  mixed: [B("Shyamoli", "শ্যামলী"), B("Chitra", "চিত্রা"), B("Phulki", "ফুলকি")],
};
const COW_PLAIN: [string, string][] = [
  B("Bokul", "বকুল"), B("Tara", "তারা"), B("Mitu", "মিতু"), B("Dolly", "ডলি"), B("Pori", "পরী"), B("Megh", "মেঘ"), B("Shapla", "শাপলা"), B("Jhinuk", "ঝিনুক"),
  B("Falguni", "ফাল্গুনী"), B("Moni", "মনি"), B("Kusum", "কুসুম"), B("Beli", "বেলী"), B("Oishi", "ঐশী"), B("Jui", "জুঁই"), B("Tuni", "টুনি"), B("Rani", "রানী"),
  B("Moyna", "ময়না"), B("Boishakhi", "বৈশাখী"), B("Hasna", "হাসনা"), B("Parul", "পারুল"), B("Bina", "বীণা"), B("Sraboni", "শ্রাবণী"), B("Bulbuli", "বুলবুলি"), B("Champa", "চম্পা"),
  B("Lucky", "লাকি"), B("Shiuli", "শিউলি"), B("Togor", "টগর"), B("Joba", "জবা"), B("Kamini", "কামিনী"), B("Malati", "মালতী"), B("Doyel", "দোয়েল"), B("Shalik", "শালিক"),
  B("Tia", "টিয়া"), B("Kokil", "কোকিল"), B("Chandona", "চন্দনা"), B("Phuli", "ফুলি"), B("Sonamoni", "সোনামনি"), B("Chandni", "চাঁদনী"), B("Josna", "জোছনা"), B("Borsha", "বর্ষা"),
  B("Ashari", "আষাঢ়ী"), B("Hena", "হেনা"), B("Mukta", "মুক্তা"), B("Panna", "পান্না"), B("Hira", "হীরা"), B("Modhu", "মধু"), B("Misti", "মিষ্টি"), B("Putul", "পুতুল"),
  B("Jhumur", "ঝুমুর"), B("Nupur", "নূপুর"), B("Rajoni", "রজনী"), B("Chobi", "ছবি"), B("Shobuj", "সবুজ"), B("Brishti", "বৃষ্টি"), B("Kakoli", "কাকলী"), B("Pakhi", "পাখি"),
  B("Mayabi", "মায়াবী"), B("Anondi", "আনন্দী"), B("Lokkhi", "লক্ষ্মী"), B("Golapi", "গোলাপী"), B("Rongila", "রঙিলা"), B("Shefali", "শেফালী"), B("Toma", "তমা"), B("Nodi", "নদী"),
  B("Kathali", "কাঠালী"), B("Chompa", "চম্পা রানী"), B("Rupsha", "রূপসা"), B("Padma", "পদ্মা"), B("Meghna", "মেঘনা"), B("Jamuna", "যমুনা"), B("Tista", "তিস্তা"), B("Karotoa", "করতোয়া"),
  B("Shonali", "শোনালী"), B("Hasi", "হাসি"), B("Khushi", "খুশি"), B("Dipa", "দীপা"), B("Rupa", "রুপা"), B("Sona", "সোনা"), B("Ratna", "রত্না"), B("Mala", "মালা"),
  B("Champi", "চম্পি"), B("Jhorna", "ঝর্ণা"), B("Dighi", "দিঘি"), B("Kolmi", "কলমি"), B("Shimul", "শিমুল"), B("Palash", "পলাশ"), B("Kadam", "কদম"), B("Tulshi", "তুলসী"),
  B("Mohua", "মহুয়া"), B("Laboni", "লাবণী"), B("Ruby", "রুবি"), B("Shirin", "শিরিন"), B("Babli", "বাবলি"), B("Chumki", "চুমকি"), B("Fulmoti", "ফুলমতি"), B("Bonolota", "বনলতা"),
];
const COAT_WORD = new Map<string, Hue>(Object.entries(COW_COAT).flatMap(([hue, ns]) => ns.map((n) => [n[0], hue as Hue] as const)));
COAT_WORD.set("Megh", "white"); // a cloud: grey-white

const cowUsed = new Set<string>();
function takeCowName(colour: string | null): [string, string] {
  const coat = colour ? COW_COAT[hueOf(colour)].find((n) => !cowUsed.has(n[0])) : undefined;
  // About one cow in five carries a coat name, as in a village herd; the rest get plain names.
  const plain = COW_PLAIN.find((n) => !cowUsed.has(n[0]) && !COAT_WORD.has(n[0]));
  const pick = coat && (cowUsed.size % 5 === 0 || !plain) ? coat : plain ?? coat ?? B(`Gabhi ${cowUsed.size + 1}`, `গাভী ${bnDigits(cowUsed.size + 1)}`);
  cowUsed.add(pick[0]);
  return pick;
}

const COLOUR_NAMED: Record<string, Hue> = { Shada: "white", Dhoboli: "white", Kali: "black", Kajol: "black", Lali: "red" };

const media: { tag: string; photo: CatalogPhoto }[] = [];
const updates = new Map<string, { name?: [string, string] | null; color?: string | null }>();
const taken = new Set<string>();

/** Give each photo to one animal from `pool`, preferring one whose coat already matches. */
function assign(photos: CatalogPhoto[], pool: Row[], namesClash?: (r: Row, p: CatalogPhoto) => boolean) {
  for (const ph of photos) {
    const free = pool.filter((r) => !taken.has(r.tag) && !(namesClash?.(r, ph) ?? false));
    if (!free.length) break;
    const match = ph.colour ? free.find((r) => hueOf(r.color) === hueOf(ph.colour)) : undefined;
    const r = match ?? free[0]!;
    taken.add(r.tag);
    media.push({ tag: r.tag, photo: ph });
    if (ph.colour && hueOf(r.color) !== hueOf(ph.colour)) {
      updates.set(r.tag, { ...updates.get(r.tag), color: ph.colour });
      r.color = ph.colour;
    } else if (!ph.colour && r.color) {
      // The photo's page doesn't say the coat, so the record shouldn't claim one the picture may contradict.
      updates.set(r.tag, { ...updates.get(r.tag), color: null });
      r.color = null;
    }
  }
}

const by = (purpose: string) => rows.filter((r) => r.purpose === purpose);
const first = (rs: Row[], ...keys: ((r: Row) => boolean)[]) =>
  [...rs].sort((a, b) => {
    for (const k of keys) {
      const d = Number(k(b)) - Number(k(a));
      if (d) return d;
    }
    return a.tag.localeCompare(b.tag);
  });

const singlesFirst = (ps: CatalogPhoto[]) => [...ps.filter((p) => p.single), ...ps.filter((p) => !p.single)];

// Qurbani bulls: listed and named bulls get the clearest haat photos.
const bulls = first(by("qurbani"), (r) => r.listed, (r) => r.name !== null);
assign(singlesFirst(ANIMAL_PHOTOS.filter((p) => p.subject === "haat")), bulls);

// Cows with a young calf get the cow-and-calf photos; the rest of the herd the cow photos.
const cows = first(by("dairy"), (r) => r.listed);
const clash = (r: Row, p: CatalogPhoto) => Boolean(p.colour && r.name && COLOUR_NAMED[r.name] && COLOUR_NAMED[r.name] !== hueOf(p.colour));
assign(ANIMAL_PHOTOS.filter((p) => p.subject === "calf"), cows.filter((r) => r.young_calf && !r.listed), clash);
assign(singlesFirst(ANIMAL_PHOTOS.filter((p) => p.subject === "cow")), cows, clash);

// One photo of a lone bull for the listed breeding bull. Ploughing oxen aren't breeding bulls, so they stay off the herd.
assign(ANIMAL_PHOTOS.filter((p) => p.subject === "ox" && p.single), first(by("breeding"), (r) => r.listed));

// Names: every Qurbani bull gets a haat name that suits its coat; the listed and photographed ones first,
// so they get the best-known names.
for (const r of bulls) updates.set(r.tag, { ...updates.get(r.tag), name: takeName(hueOf(r.color)) });

// Cows keep a name that already fits; a coat name on the wrong coat ("Shada" on a black cow) is
// replaced, and cows known only by tag get a name.
const coatClash = (r: Row) => r.name !== null && COAT_WORD.has(r.name) && (!r.color || COAT_WORD.get(r.name) !== hueOf(r.color));
for (const r of cows) if (r.name && !coatClash(r)) cowUsed.add(r.name);
for (const r of [...cows].sort((a, b) => a.tag.localeCompare(b.tag))) {
  if (r.name !== null && !coatClash(r)) continue;
  updates.set(r.tag, { ...updates.get(r.tag), name: takeCowName(r.color) });
}

/* ── SQL ── */
const q = (v: string | null | undefined) => (v === null || v === undefined ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const DEMO = `JOIN "farms" f ON f.id = a.farm_id AND f.name LIKE '%(demo)'`;
const stmts: string[] = [];

stmts.push(`-- Real photographs for the demo farm: one photo per animal, never shared between two animals.
-- ${media.length} animals get a photo from Unsplash or Pexels (taken in Bangladesh, credited, linked to its page).
-- The rest show "No photo yet", as on a real farm. Generated by scripts/demo/assign-real-photos.mts.
DELETE FROM "animal_media" m
USING "animals" a ${DEMO}
WHERE m.animal_id = a.id AND m.url LIKE 'https://images.unsplash.com/%' AND m.credit LIKE '%· Unsplash ·%';`);

stmts.push(`INSERT INTO "animal_media" ("farm_id", "animal_id", "url", "kind", "is_cover", "credit", "source_url")
SELECT a.farm_id, a.id, v.url, 'photo', true, v.credit, v.page
FROM (VALUES
${media.map((m) => `  (${q(m.tag)}, ${q(sizedUrl(m.photo.image))}, ${q(`${m.photo.photographer} · ${m.photo.source} · ${m.photo.place}`)}, ${q(m.photo.page)})`).join(",\n")}
) AS v(tag, url, credit, page)
JOIN "animals" a ON a.tag = v.tag
${DEMO};`);

const renames = [...updates.entries()];
stmts.push(`-- Coat colours follow the photo (left blank when the photo page does not state one); names follow the coat, so a "Kala Pahar" is always black.
UPDATE "animals" AS a
SET "name" = CASE WHEN v.set_name THEN v.name ELSE a."name" END,
    "name_bn" = CASE WHEN v.set_name THEN v.name_bn ELSE a."name_bn" END,
    "color" = CASE WHEN v.set_color THEN v.color ELSE a."color" END
FROM (VALUES
${renames.map(([tag, u]) => `  (${q(tag)}, ${u.name !== undefined ? "true" : "false"}, ${q(u.name?.[0] ?? null)}, ${q(u.name?.[1] ?? null)}, ${u.color !== undefined ? "true" : "false"}, ${q(u.color ?? null)})`).join(",\n")}
) AS v(tag, set_name, name, name_bn, set_color, color), "farms" f
WHERE a.tag = v.tag AND f.id = a.farm_id AND f.name LIKE '%(demo)';`);

stmts.push(`-- Listing titles start with the animal's name (or tag); keep them in step with the new names.
UPDATE "listings" AS l
SET "title" = COALESCE(a."name", a."tag") || substring(l."title" from position(' — ' in l."title"))
FROM "animals" a, "farms" f
WHERE l.animal_id = a.id AND a.purpose = 'qurbani' AND position(' — ' in l."title") > 0
  AND f.id = a.farm_id AND f.name LIKE '%(demo)';`);

mkdirSync(OUT);
writeFileSync(path.join(OUT, "migration.sql"), stmts.join("\n--> statement-breakpoint\n") + "\n");
const prev = readdirSync(DIR).filter((d) => d !== NAME && existsSync(path.join(DIR, d, "snapshot.json"))).sort().at(-1)!;
// Data only: the schema snapshot is unchanged, chained on to the previous one.
const snap = JSON.parse(readFileSync(path.join(DIR, prev, "snapshot.json"), "utf8")) as { id: string; prevIds: string[] };
writeFileSync(path.join(OUT, "snapshot.json"), JSON.stringify({ ...snap, id: randomUUID(), prevIds: [snap.id] }, null, 2) + "\n");

const named = renames.filter(([, u]) => u.name).length; // bulls and cows
console.log(`${media.length} photos assigned (${new Set(media.map((m) => m.photo.id)).size} distinct), ${named} animals named, ${renames.filter(([, u]) => u.color).length} coats changed. Wrote ${NAME}`);
process.exit(0);
