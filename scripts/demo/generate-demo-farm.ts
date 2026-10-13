/**
 * Generates the demo farm as a data migration:
 *   netlify/database/migrations/<ts>_demo_farm/migration.sql
 *
 * Shonali Dairy & Agro (demo), Shahjadpur, Sirajganj — as of 13 Oct 2026:
 *   100 milk cows · 50 calves · 100 Qurbani bulls · 10 breeding bulls
 * with pedigree links, 90 days of milk, breeding history, vaccines and treatments,
 * weigh-ins, feed, expenses, milk sales and marketplace listings.
 *
 * Deterministic (seeded PRNG): re-running produces the same file. Do not edit the
 * migration by hand once deployed — Netlify rejects changed migrations. Change this
 * script and add a new migration instead.
 *
 * Run: node --import tsx scripts/demo/generate-demo-farm.ts
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PHOTOS } from "./photos";

/* ───────────── deterministic helpers ───────────── */

let seed = 20261013;
function rand() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number) => rand() < p;
const round1 = (n: number) => Math.round(n * 10) / 10;
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
function uuid() {
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = "4";
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const TODAY = new Date("2026-10-13T00:00:00Z");
const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const MILK_DAYS = 90;
const MILK_START = addDays(TODAY, -(MILK_DAYS - 1));
const EID_2027 = new Date("2027-05-16T00:00:00Z");

/* ───────────── SQL writer ───────────── */

type V = string | number | boolean | null | Date | { raw: string };
const lit = (v: V): string => {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${iso(v)}'`;
  if (typeof v === "object") return v.raw;
  return `'${v.replace(/'/g, "''")}'`;
};
const statements: string[] = [];
function insert(table: string, cols: string[], rows: V[][]) {
  for (let i = 0; i < rows.length; i += 800) {
    const chunk = rows.slice(i, i + 800);
    statements.push(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n` +
        chunk.map((r) => `(${r.map(lit).join(", ")})`).join(",\n") +
        ";",
    );
  }
}

/* ───────────── people, farm, catalogs ───────────── */

const FARM = uuid();
const people = {
  owner: { id: uuid(), phone: "+8801700000001", name: "Rahim Uddin", role: "owner" },
  manager: { id: uuid(), phone: "+8801700000002", name: "Selim Hossain", role: "manager" },
  worker1: { id: uuid(), phone: "+8801700000003", name: "Karim Mia", role: "worker" },
  worker2: { id: uuid(), phone: "+8801700000004", name: "Jahangir Alam", role: "worker" },
  vet: { id: uuid(), phone: "+8801700000005", name: "Dr. Nasrin Akter", role: "vet" },
} as const;
const staff = Object.values(people);

insert(
  "users",
  ["id", "phone", "name", "locale"],
  staff.map((p) => [p.id, p.phone, p.name, "bn"]),
);
insert(
  "farms",
  ["id", "name", "district", "upazila", "segments", "settings", "created_by_id"],
  [
    [
      FARM,
      "Shonali Dairy & Agro (demo)",
      "Sirajganj",
      "Shahjadpur",
      { raw: "ARRAY['dairy','breeding','qurbani']::segment[]" },
      {
        raw: `'${JSON.stringify({ heatCycleDays: 21, pregnancyCheckDays: 75, gestationDays: 283, dryOffDaysBeforeCalving: 60, milkUnitPriceTk: 55 })}'::jsonb`,
      },
      people.owner.id,
    ],
  ],
);
insert(
  "memberships",
  ["farm_id", "user_id", "role"],
  staff.map((p) => [FARM, p.id, { raw: `'${p.role}'::role` }]),
);
insert(
  "audit_logs",
  ["farm_id", "actor_id", "action", "entity_type", "entity_id", "data"],
  [[FARM, people.owner.id, "farm.create", "farm", FARM, { raw: `'{"source":"demo seed"}'::jsonb` }]],
);
insert("platform_settings", ["key", "value"], [["eid_ul_adha:2027", { raw: `'{"date":"2027-05-16","confirmed":false}'::jsonb` }]]);

const BREEDS = [
  ["Local (Deshi)", "দেশি", true],
  ["Red Chittagong", "রেড চিটাগাং", true],
  ["Pabna", "পাবনা", true],
  ["North Bengal Grey", "নর্থ বেঙ্গল গ্রে", true],
  ["Munshiganj", "মুন্সীগঞ্জ", true],
  ["Sahiwal", "শাহিওয়াল", false],
  ["Holstein Friesian", "হলস্টেইন ফ্রিজিয়ান", false],
  ["Jersey", "জার্সি", false],
  ["Brahman", "ব্রাহমা", false],
  ["Sindhi", "সিন্ধি", false],
] as const;
const breedId = new Map<string, string>();
insert(
  "breeds",
  ["id", "species", "name", "name_bn", "is_local"],
  BREEDS.map(([name, bn, local]) => {
    const id = uuid();
    breedId.set(name, id);
    return [id, { raw: "'cattle'::species" }, name, bn, local];
  }),
);

const VACCINES = {
  FMD: { name: "FMD", bn: "ক্ষুরারোগ", days: 180, deworm: false },
  HS: { name: "HS", bn: "গলাফোলা", days: 180, deworm: false },
  ANTHRAX: { name: "Anthrax", bn: "তড়কা", days: 365, deworm: false },
  BQ: { name: "Black Quarter", bn: "বাদলা", days: 365, deworm: false },
  LSD: { name: "LSD", bn: "লাম্পি স্কিন", days: 365, deworm: false },
  DEWORM: { name: "Deworming", bn: "কৃমিনাশক", days: 90, deworm: true },
} as const;
type VKey = keyof typeof VACCINES;
const vaccineId = {} as Record<VKey, string>;
insert(
  "vaccines",
  ["id", "species", "name", "name_bn", "is_deworming", "default_interval_days"],
  (Object.keys(VACCINES) as VKey[]).map((k) => {
    const v = VACCINES[k];
    vaccineId[k] = uuid();
    return [vaccineId[k], { raw: "'cattle'::species" }, v.name, v.bn, v.deworm, v.days];
  }),
);

const SHEDS = {
  cowsA: "Gavi shed A",
  cowsB: "Gavi shed B",
  calves: "Calf shed",
  fat1: "Fattening shed 1",
  fat2: "Fattening shed 2",
  bulls: "Bull pen",
} as const;
type ShedKey = keyof typeof SHEDS;
const shedId = {} as Record<ShedKey, string>;
insert(
  "sheds",
  ["id", "farm_id", "name"],
  (Object.keys(SHEDS) as ShedKey[]).map((k) => {
    shedId[k] = uuid();
    return [shedId[k], FARM, SHEDS[k]];
  }),
);

const STRAWS = [
  { code: "HF-2214", name: "Holstein Friesian sire", breed: "Holstein Friesian", source: "Govt. AI centre" },
  { code: "HF-1980", name: "Holstein Friesian sire", breed: "Holstein Friesian", source: "Govt. AI centre" },
  { code: "SW-118", name: "Sahiwal sire", breed: "Sahiwal", source: "Private AI technician" },
  { code: "JR-305", name: "Jersey sire", breed: "Jersey", source: "Private AI technician" },
  { code: "RCC-44", name: "Red Chittagong sire", breed: "Red Chittagong", source: "Govt. AI centre" },
].map((s) => ({ ...s, id: uuid() }));
const straw = (code: string) => STRAWS.find((s) => s.code === code)!;
insert(
  "sires",
  ["id", "farm_id", "code", "name", "breed_label", "source"],
  STRAWS.map((s) => [s.id, FARM, s.code, s.name, s.breed, s.source]),
);

/* ───────────── animals ───────────── */

type Animal = {
  id: string;
  tag: string;
  name: string | null;
  nameBn: string | null;
  sex: "female" | "male";
  breed: string; // catalog breed name (primary)
  breedLabel: string;
  breedPercent: number | null;
  color: string;
  birthDate: Date;
  estimated: boolean;
  origin: "born" | "purchased";
  purchaseDate: Date | null;
  purchasePriceTk: number | null;
  purchasedFrom: string | null;
  damId: string | null;
  sireAnimalId: string | null;
  sireId: string | null;
  shed: ShedKey;
  purpose: "dairy" | "breeding" | "qurbani" | "calf";
  notes: string | null;
};
const animals: Animal[] = [];

const COLORS = {
  hf: ["Black and white", "Black and white", "Mostly black, white face", "Red and white"],
  sahiwal: ["Reddish brown", "Light red", "Dun"],
  jersey: ["Fawn", "Light brown", "Fawn with white patches"],
  rcc: ["Red", "Deep red"],
  local: ["Brown", "Grey-white", "Black", "Red-brown", "White"],
  grey: ["Grey", "Grey-white"],
  brahman: ["Grey", "White", "Light grey"],
};

const COW_NAMES: [string, string][] = [
  ["Lali", "লালি"], ["Moyna", "ময়না"], ["Shada", "সাদা"], ["Bokul", "বকুল"], ["Kajol", "কাজল"],
  ["Tuni", "টুনি"], ["Champa", "চম্পা"], ["Joba", "জবা"], ["Rani", "রানী"], ["Sonali", "সোনালী"],
  ["Bulbuli", "বুলবুলি"], ["Pakhi", "পাখি"], ["Shapla", "শাপলা"], ["Mukta", "মুক্তা"], ["Shefali", "শেফালী"],
  ["Kakoli", "কাকলি"], ["Rupa", "রূপা"], ["Chandni", "চাঁদনী"], ["Dolly", "ডলি"], ["Golapi", "গোলাপী"],
  ["Hasna", "হাসনা"], ["Jhinuk", "ঝিনুক"], ["Kusum", "কুসুম"], ["Laboni", "লাবণী"], ["Mitu", "মিতু"],
  ["Nupur", "নূপুর"], ["Oishi", "ঐশী"], ["Parul", "পারুল"], ["Rojina", "রোজিনা"], ["Shimul", "শিমুল"],
  ["Tara", "তারা"], ["Urmi", "ঊর্মি"], ["Jui", "জুঁই"], ["Beli", "বেলী"], ["Malati", "মালতী"],
  ["Hena", "হেনা"], ["Kamini", "কামিনী"], ["Dhoboli", "ধবলী"], ["Kali", "কালী"], ["Bina", "বীণা"],
  ["Shonchita", "সঞ্চিতা"], ["Mohona", "মোহনা"], ["Nodi", "নদী"], ["Megh", "মেঘ"], ["Brishti", "বৃষ্টি"],
  ["Sraboni", "শ্রাবণী"], ["Falguni", "ফাল্গুনী"], ["Boishakhi", "বৈশাখী"], ["Shorot", "শরৎ"], ["Hemonti", "হেমন্তী"],
  ["Ahladi", "আহ্লাদী"], ["Sundori", "সুন্দরী"], ["Dulali", "দুলালী"], ["Pori", "পরী"], ["Moni", "মনি"],
  ["Ratna", "রত্না"], ["Shila", "শিলা"], ["Pinki", "পিংকি"], ["Lucky", "লাকি"], ["Bijli", "বিজলী"],
];
const BULL_NAMES: [string, string][] = [
  ["Kalo Pahar", "কালো পাহাড়"], ["Raja Babu", "রাজা বাবু"], ["Sultan", "সুলতান"], ["Lal Mia", "লাল মিয়া"],
  ["Badshah", "বাদশাহ"], ["Toofan", "তুফান"], ["Bahubali", "বাহুবলী"], ["Kalo Manik", "কালো মানিক"],
  ["Shada Pahar", "সাদা পাহাড়"], ["Hira", "হীরা"], ["Panna", "পান্না"], ["Shahenshah", "শাহেনশাহ"],
  ["Bir Bahadur", "বীর বাহাদুর"], ["Dhola", "ধলা"], ["Lalu", "লালু"], ["Bhola", "ভোলা"], ["Tiger", "টাইগার"],
  ["Don", "ডন"], ["Hero", "হিরো"], ["Prince", "প্রিন্স"], ["Nawab", "নবাব"], ["Pathan", "পাঠান"],
  ["Megha", "মেঘা"], ["Jhor", "ঝড়"], ["Bijoy", "বিজয়"], ["Shamsher", "শমসের"], ["Mastan", "মাস্তান"],
  ["Golden Boy", "গোল্ডেন বয়"], ["Chand", "চাঁদ"], ["Surjo", "সূর্য"],
];

/* Breeding bulls B-001…B-010 */
const BREEDING_BULLS: { name: [string, string]; breed: string; label: string; pct: number | null; color: string[] }[] = [
  { name: ["Raja", "রাজা"], breed: "Sahiwal", label: "Sahiwal", pct: 100, color: COLORS.sahiwal },
  { name: ["Badal", "বাদল"], breed: "Sahiwal", label: "Sahiwal", pct: 100, color: COLORS.sahiwal },
  { name: ["Toofan Senior", "বড় তুফান"], breed: "Brahman", label: "Brahman × Local", pct: 50, color: COLORS.brahman },
  { name: ["Shera", "শেরা"], breed: "Brahman", label: "Brahman × Local", pct: 50, color: COLORS.brahman },
  { name: ["Lal Bahadur", "লাল বাহাদুর"], breed: "Red Chittagong", label: "Red Chittagong", pct: null, color: COLORS.rcc },
  { name: ["Chatgaiya", "চাটগাঁইয়া"], breed: "Red Chittagong", label: "Red Chittagong", pct: null, color: COLORS.rcc },
  { name: ["Pabna Raja", "পাবনার রাজা"], breed: "Pabna", label: "Pabna", pct: null, color: COLORS.local },
  { name: ["Dhusor", "ধূসর"], breed: "North Bengal Grey", label: "North Bengal Grey", pct: null, color: COLORS.grey },
  { name: ["Sindhu", "সিন্ধু"], breed: "Sindhi", label: "Red Sindhi", pct: 100, color: COLORS.sahiwal },
  { name: ["Kalu", "কালু"], breed: "Holstein Friesian", label: "HF × Local", pct: 75, color: COLORS.hf },
];
const breedingBulls: Animal[] = BREEDING_BULLS.map((b, i) => {
  const birth = addDays(TODAY, -int(3 * 365, 7 * 365));
  const bought = addDays(birth, int(500, 900));
  return {
    id: uuid(),
    tag: `B-${String(i + 1).padStart(3, "0")}`,
    name: b.name[0],
    nameBn: b.name[1],
    sex: "male",
    breed: b.breed,
    breedLabel: b.label,
    breedPercent: b.pct,
    color: pick(b.color),
    birthDate: birth,
    estimated: true,
    origin: "purchased",
    purchaseDate: bought < TODAY ? bought : addDays(TODAY, -400),
    purchasePriceTk: Math.round(between(150_000, 420_000) / 1000) * 1000,
    purchasedFrom: pick(["Breeder in Pabna", "Sahiwal breeder, Satkhira", "Govt. livestock farm auction", "Breeder in Chattogram"]),
    damId: null,
    sireAnimalId: null,
    sireId: null,
    shed: "bulls",
    purpose: "breeding",
    notes: "Natural service bull. Semen not collected.",
  };
});
animals.push(...breedingBulls);

/* Milk cows D-001…D-100 */
type CowProfile = { breed: string; label: string; pct: number | null; peak: number; color: string[]; strawLine: string };
const COW_MIX: [number, CowProfile][] = [
  [20, { breed: "Holstein Friesian", label: "HF × Local", pct: 50, peak: 12, color: COLORS.hf, strawLine: "HF" }],
  [15, { breed: "Holstein Friesian", label: "HF × Local", pct: 62.5, peak: 14, color: COLORS.hf, strawLine: "HF" }],
  [20, { breed: "Holstein Friesian", label: "HF × Local", pct: 75, peak: 16, color: COLORS.hf, strawLine: "HF" }],
  [20, { breed: "Sahiwal", label: "Sahiwal × Local", pct: 50, peak: 9, color: COLORS.sahiwal, strawLine: "SW" }],
  [10, { breed: "Jersey", label: "Jersey × Local", pct: 50, peak: 11, color: COLORS.jersey, strawLine: "JR" }],
  [5, { breed: "Red Chittagong", label: "Red Chittagong", pct: null, peak: 3.2, color: COLORS.rcc, strawLine: "RCC" }],
  [5, { breed: "Pabna", label: "Pabna", pct: null, peak: 5, color: COLORS.local, strawLine: "NAT" }],
  [5, { breed: "Local (Deshi)", label: "Local (Deshi)", pct: null, peak: 2.4, color: COLORS.local, strawLine: "NAT" }],
];
const cowProfiles = shuffle(COW_MIX.flatMap(([n, p]) => Array.from({ length: n }, () => p)));
const cowNames = shuffle(COW_NAMES);

type CowState = {
  animal: Animal;
  profile: CowProfile;
  peak: number;
  parity: number;
  lastCalving: Date;
  dryOffDate: Date | null;
  serviceHistory: { date: Date; method: "ai" | "natural"; strawCode: string | null; bullId: string | null; conceived: boolean }[];
  expectedCalving: Date | null;
};
const cows: CowState[] = [];

function strawFor(line: string) {
  if (line === "HF") return pick(["HF-2214", "HF-1980"]);
  if (line === "SW") return "SW-118";
  if (line === "JR") return "JR-305";
  if (line === "RCC") return "RCC-44";
  return null;
}

for (let i = 0; i < 100; i++) {
  const p = cowProfiles[i]!;
  const ageDays = int(3 * 365, 9 * 365);
  const birth = addDays(TODAY, -ageDays);
  const parity = Math.max(1, Math.min(6, Math.floor((ageDays - 2.6 * 365) / 400) + 1));
  const bornOnFarm = i >= 70; // dams assigned after all cows exist
  const nm = i < cowNames.length ? cowNames[i]! : null;
  const animal: Animal = {
    id: uuid(),
    tag: `D-${String(i + 1).padStart(3, "0")}`,
    name: nm?.[0] ?? null,
    nameBn: nm?.[1] ?? null,
    sex: "female",
    breed: p.breed,
    breedLabel: p.label,
    breedPercent: p.pct,
    color: pick(p.color),
    birthDate: birth,
    estimated: !bornOnFarm && chance(0.6),
    origin: bornOnFarm ? "born" : "purchased",
    purchaseDate: bornOnFarm ? null : addDays(birth, int(700, 1100)),
    purchasePriceTk: bornOnFarm ? null : Math.round((p.peak * 9000 + between(20_000, 60_000)) / 1000) * 1000,
    purchasedFrom: bornOnFarm ? null : pick(["Shahjadpur haat", "Ullapara haat", "Dairy farmer, Bera (Pabna)", "Baghabari dairy belt", "Neighbour farm"]),
    damId: null,
    sireAnimalId: null,
    sireId: null,
    shed: i < 50 ? "cowsA" : "cowsB",
    purpose: "dairy",
    notes: null,
  };
  if (animal.purchaseDate && animal.purchaseDate > TODAY) animal.purchaseDate = addDays(TODAY, -int(200, 600));

  // Reproductive timeline
  const dry = i % 100 >= 85; // last 15 in shuffled order are dry and heavily pregnant
  let lastCalving: Date;
  let expectedCalving: Date | null = null;
  let dryOffDate: Date | null = null;
  const serviceHistory: CowState["serviceHistory"] = [];
  const strawCode = strawFor(p.strawLine);
  const natBull = () => pick(breedingBulls.filter((b) => b.purpose === "breeding")).id;

  if (dry) {
    expectedCalving = addDays(TODAY, int(7, 60));
    const conceive = addDays(expectedCalving, -283);
    lastCalving = addDays(conceive, -int(75, 120));
    dryOffDate = addDays(expectedCalving, -60);
    if (chance(0.35)) {
      const first = addDays(conceive, -21);
      serviceHistory.push({ date: first, method: strawCode ? "ai" : "natural", strawCode, bullId: strawCode ? null : natBull(), conceived: false });
    }
    serviceHistory.push({ date: conceive, method: strawCode ? "ai" : "natural", strawCode, bullId: strawCode ? null : natBull(), conceived: true });
  } else {
    const dim = int(12, 340);
    lastCalving = addDays(TODAY, -dim);
    if (dim > 75) {
      const first = addDays(lastCalving, int(60, 95));
      if (first < TODAY) {
        const ok = chance(0.6);
        serviceHistory.push({ date: first, method: strawCode ? "ai" : "natural", strawCode, bullId: strawCode ? null : natBull(), conceived: ok });
        if (ok) expectedCalving = addDays(first, 283);
        else {
          const second = addDays(first, 21 + int(0, 2));
          if (second < addDays(TODAY, -3)) {
            const ok2 = chance(0.7);
            serviceHistory.push({ date: second, method: strawCode ? "ai" : "natural", strawCode, bullId: strawCode ? null : natBull(), conceived: ok2 });
            if (ok2) expectedCalving = addDays(second, 283);
          }
        }
      }
    }
  }

  animals.push(animal);
  cows.push({
    animal,
    profile: p,
    peak: p.peak * between(0.85, 1.15),
    parity,
    lastCalving,
    dryOffDate,
    serviceHistory,
    expectedCalving,
  });
}

// The 30 youngest cows were born on the farm (older ones were bought), so their mothers can be in the herd.
const youngest = new Set([...cows].sort((a, b) => b.animal.birthDate.getTime() - a.animal.birthDate.getTime()).slice(0, 30).map((c) => c.animal.id));
for (const c of cows) {
  const born = youngest.has(c.animal.id);
  c.animal.origin = born ? "born" : "purchased";
  if (born) {
    c.animal.purchaseDate = null;
    c.animal.purchasePriceTk = null;
    c.animal.purchasedFrom = null;
    c.animal.estimated = false;
  } else if (!c.animal.purchaseDate) {
    c.animal.purchaseDate = addDays(c.animal.birthDate, int(700, 1100));
    if (c.animal.purchaseDate > TODAY) c.animal.purchaseDate = addDays(TODAY, -int(200, 600));
    c.animal.purchasePriceTk = Math.round((c.profile.peak * 9000 + between(20_000, 60_000)) / 1000) * 1000;
    c.animal.purchasedFrom = pick(["Shahjadpur haat", "Ullapara haat", "Dairy farmer, Bera (Pabna)", "Baghabari dairy belt", "Neighbour farm"]);
  }
}
// Pedigree for the home-bred cows: dam = an older cow on the farm, sire = an AI straw of her line.
for (const c of cows.filter((c) => c.animal.origin === "born")) {
  const olderDams = cows.filter(
    (d) => d.animal.id !== c.animal.id && daysBetween(d.animal.birthDate, c.animal.birthDate) > 3.2 * 365 && d.profile.breed === c.profile.breed,
  );
  // Same-breed dam if there is one, otherwise any cow old enough to be her mother.
  const anyOlder = cows.filter((d) => d.animal.id !== c.animal.id && daysBetween(d.animal.birthDate, c.animal.birthDate) > 3.2 * 365);
  const dam = olderDams.length ? pick(olderDams) : anyOlder.length ? pick(anyOlder) : null;
  c.animal.damId = dam?.animal.id ?? null;
  const code = strawFor(c.profile.strawLine);
  if (code) c.animal.sireId = straw(code).id;
  else c.animal.sireAnimalId = pick(breedingBulls).id;
}

/* Calves C-001…C-050: born to cows that calved in the last ~11 months */
const recentlyCalved = shuffle(cows.filter((c) => !c.dryOffDate && daysBetween(c.lastCalving, TODAY) <= 330)).slice(0, 50);
const calfOf = new Map<string, Animal>();
recentlyCalved.forEach((dam, i) => {
  const female = i % 25 < 13; // 26 heifer calves, 24 bull calves
  const prev = dam.serviceHistory.length ? null : null; // previous service (before last calving) isn't modelled per straw
  void prev;
  const code = strawFor(dam.profile.strawLine);
  const sireBull = code ? null : pick(breedingBulls);
  let label = dam.profile.label;
  let pct = dam.profile.pct;
  if (code?.startsWith("HF") && pct) {
    pct = (pct + 100) / 2;
    label = "HF × Local";
  } else if (code === "SW-118" && pct) {
    pct = (pct + 100) / 2;
  } else if (code === "JR-305" && pct) {
    pct = (pct + 100) / 2;
  } else if (sireBull) {
    const base = (l: string) => l.split(" ×")[0]!.replace(" (Deshi)", "");
    label = dam.profile.label === sireBull.breedLabel ? dam.profile.label : `${base(sireBull.breedLabel)} × ${base(dam.profile.label)}`;
    pct = null;
  }
  const calf: Animal = {
    id: uuid(),
    tag: `C-${String(i + 1).padStart(3, "0")}`,
    name: null,
    nameBn: null,
    sex: female ? "female" : "male",
    breed: dam.profile.breed,
    breedLabel: label,
    breedPercent: pct,
    color: pick(dam.profile.color),
    birthDate: dam.lastCalving,
    estimated: false,
    origin: "born",
    purchaseDate: null,
    purchasePriceTk: null,
    purchasedFrom: null,
    damId: dam.animal.id,
    sireAnimalId: sireBull?.id ?? null,
    sireId: code ? straw(code).id : null,
    shed: "calves",
    purpose: "calf",
    notes: female ? "Heifer calf — kept as a future milker." : "Bull calf — to be raised for Qurbani.",
  };
  calfOf.set(dam.animal.id, calf);
  animals.push(calf);
});

/* Qurbani bulls Q-001…Q-100, bought at haats after Eid 2026 */
type BullProfile = { breed: string; label: string; pct: number | null; start: [number, number]; adg: number; color: string[] };
const BULL_MIX: [number, BullProfile][] = [
  [30, { breed: "Local (Deshi)", label: "Local (Deshi)", pct: null, start: [160, 230], adg: 0.45, color: COLORS.local }],
  [15, { breed: "Pabna", label: "Pabna", pct: null, start: [200, 280], adg: 0.55, color: COLORS.local }],
  [10, { breed: "North Bengal Grey", label: "North Bengal Grey", pct: null, start: [170, 240], adg: 0.5, color: COLORS.grey }],
  [15, { breed: "Sahiwal", label: "Sahiwal × Local", pct: 50, start: [230, 320], adg: 0.65, color: COLORS.sahiwal }],
  [10, { breed: "Holstein Friesian", label: "HF × Local", pct: 50, start: [260, 340], adg: 0.75, color: COLORS.hf }],
  [15, { breed: "Brahman", label: "Brahman × Local", pct: 50, start: [260, 360], adg: 0.8, color: COLORS.brahman }],
  [5, { breed: "Munshiganj", label: "Munshiganj", pct: null, start: [180, 250], adg: 0.5, color: COLORS.local }],
];
const bullProfiles = shuffle(BULL_MIX.flatMap(([n, p]) => Array.from({ length: n }, () => p)));
const bullNames = shuffle(BULL_NAMES);
const HAATS = ["Talgachhi haat, Shahjadpur", "Ullapara haat", "Enayetpur haat", "Bera haat (Pabna)", "Chandaikona haat"];
type BullState = { animal: Animal; profile: BullProfile; startWeight: number; adg: number; target: number };
const fattening: BullState[] = [];
for (let i = 0; i < 100; i++) {
  const p = bullProfiles[i]!;
  const bought = addDays(new Date("2026-06-08T00:00:00Z"), int(0, 75));
  const ageAtPurchase = int(15 * 30, 26 * 30);
  const startWeight = Math.round(between(p.start[0], p.start[1]));
  const slow = chance(0.1);
  const adg = round1(p.adg * (slow ? between(0.5, 0.65) : between(0.8, 1.2)) * 100) / 100;
  const expectedGain = p.adg * daysBetween(bought, EID_2027);
  const target = Math.round((startWeight + expectedGain) / 10) * 10;
  const nm = i < bullNames.length ? bullNames[i]! : null;
  const animal: Animal = {
    id: uuid(),
    tag: `Q-${String(i + 1).padStart(3, "0")}`,
    name: nm?.[0] ?? null,
    nameBn: nm?.[1] ?? null,
    sex: "male",
    breed: p.breed,
    breedLabel: p.label,
    breedPercent: p.pct,
    color: pick(p.color),
    birthDate: addDays(bought, -ageAtPurchase),
    estimated: true,
    origin: "purchased",
    purchaseDate: bought,
    purchasePriceTk: Math.round((startWeight * between(470, 560)) / 500) * 500,
    purchasedFrom: pick(HAATS),
    damId: null,
    sireAnimalId: null,
    sireId: null,
    shed: i < 50 ? "fat1" : "fat2",
    purpose: "qurbani",
    notes: slow ? "Slow gainer — check teeth and deworming." : null,
  };
  animals.push(animal);
  fattening.push({ animal, profile: p, startWeight, adg, target });
}

insert(
  "animals",
  [
    "id", "farm_id", "tag", "name", "name_bn", "species", "sex", "breed_id", "breed_label", "breed_percent", "color",
    "birth_date", "birth_date_estimated", "origin", "purchase_date", "purchase_price_tk", "purchased_from",
    "dam_id", "sire_animal_id", "sire_id", "shed_id", "purpose", "lifecycle", "notes",
  ],
  // Parents first so self-references resolve inside the same statement order.
  [...animals]
    .sort((a, b) => a.birthDate.getTime() - b.birthDate.getTime())
    .map((a) => [
      a.id, FARM, a.tag, a.name, a.nameBn, { raw: "'cattle'::species" }, { raw: `'${a.sex}'::sex` }, breedId.get(a.breed) ?? null,
      a.breedLabel, a.breedPercent === null ? null : Math.round(a.breedPercent), a.color, a.birthDate, a.estimated,
      { raw: `'${a.origin}'::origin` }, a.purchaseDate, a.purchasePriceTk, a.purchasedFrom, a.damId, a.sireAnimalId,
      a.sireId, shedId[a.shed], { raw: `'${a.purpose}'::purpose` }, { raw: "'active'::lifecycle" }, a.notes,
    ]),
);

/* ───────────── photos (Unsplash, taken in Bangladesh) ───────────── */

const media: V[][] = [];
function addPhoto(a: Animal, pool: readonly (typeof PHOTOS)[number][]) {
  const ph = pick(pool);
  media.push([FARM, a.id, `${ph.image}?w=900&q=75&auto=format&fit=crop`, "photo", true, `${ph.photographer} · Unsplash · ${ph.place}`, ph.page]);
}
const byUse = (use: string) => PHOTOS.filter((p) => p.use.includes(use as never));
for (const c of cows) addPhoto(c.animal, byUse("cow"));
for (const b of fattening) addPhoto(b.animal, byUse("bull"));
for (const b of breedingBulls) addPhoto(b, byUse("breeding"));
// Calves: no photo yet — the profile shows a placeholder, like a real farm that hasn't taken one.
insert("animal_media", ["farm_id", "animal_id", "url", "kind", "is_cover", "credit", "source_url"], media);

/* ───────────── breeding events ───────────── */

const breeding: V[][] = [];
const be = (animalId: string, type: string, date: Date, extra: Partial<Record<string, V>> = {}) =>
  breeding.push([
    FARM, animalId, { raw: `'${type}'::breeding_type` }, date,
    extra.method ?? null, extra.sireId ?? null, extra.sireAnimalId ?? null, extra.technician ?? null,
    extra.pdResult ?? null, extra.calvingEase ?? null, extra.calfId ?? null, extra.notes ?? null,
    extra.by ?? people.manager.id,
  ]);
const TECHS = ["Govt. AI technician, Shahjadpur", "Rafiq (private AI technician)", "Mizan (private AI technician)"];

for (const c of cows) {
  // Earlier calvings (history only)
  let prev = c.lastCalving;
  for (let k = 1; k < c.parity; k++) {
    prev = addDays(prev, -int(380, 440));
    if (prev > c.animal.birthDate) be(c.animal.id, "calving", prev, { calvingEase: { raw: "'normal'::calving_ease" }, notes: "Calf sold at weaning." });
  }
  const calf = calfOf.get(c.animal.id);
  be(c.animal.id, "calving", c.lastCalving, {
    calvingEase: { raw: `'${chance(0.88) ? "normal" : "assisted"}'::calving_ease` },
    calfId: calf?.id ?? null,
    notes: calf ? null : "Bull calf sold to a neighbouring farmer.",
    by: people.worker1.id,
  });
  const firstHeat = addDays(c.lastCalving, int(38, 55));
  if (firstHeat < TODAY && (!c.serviceHistory[0] || firstHeat < c.serviceHistory[0].date)) {
    be(c.animal.id, "heat", firstHeat, { notes: "Not served — waiting for body condition.", by: people.worker2.id });
  }
  for (const s of c.serviceHistory) {
    be(c.animal.id, "heat", s.date, { by: people.worker1.id });
    be(c.animal.id, "service", s.date, {
      method: { raw: `'${s.method}'::service_method` },
      sireId: s.strawCode ? straw(s.strawCode).id : null,
      sireAnimalId: s.bullId,
      technician: s.method === "ai" ? pick(TECHS) : "Natural service",
    });
    const pdDate = addDays(s.date, 75);
    if (s.conceived && pdDate < TODAY) {
      be(c.animal.id, "pregnancy_check", pdDate, { pdResult: { raw: "'positive'::pd_result" }, by: people.vet.id, technician: people.vet.name });
    }
  }
  if (c.dryOffDate && c.dryOffDate <= TODAY) be(c.animal.id, "dry_off", c.dryOffDate, { notes: "Dried off 60 days before calving." });
}
// One cow in heat today, so the dashboard has something urgent.
const inHeat = cows.find((c) => !c.dryOffDate && !c.expectedCalving && daysBetween(c.lastCalving, TODAY) > 60);
if (inHeat) be(inHeat.animal.id, "heat", TODAY, { notes: "Standing heat seen at 6 am. Call AI technician.", by: people.worker1.id });

insert(
  "breeding_events",
  ["farm_id", "animal_id", "type", "date", "method", "sire_id", "sire_animal_id", "technician", "pd_result", "calving_ease", "calf_id", "notes", "recorded_by_id"],
  breeding,
);

/* ───────────── health events ───────────── */

const health: V[][] = [];
const he = (
  a: Animal,
  type: string,
  date: Date,
  extra: { vaccine?: VKey; next?: Date | null; diagnosis?: string; drug?: string; dose?: string; milkUntil?: Date; meatUntil?: Date; cost?: number; notes?: string } = {},
) =>
  health.push([
    FARM, a.id, { raw: `'${type}'::health_type` }, date,
    extra.vaccine ? vaccineId[extra.vaccine] : null,
    extra.vaccine ? `${extra.vaccine}-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}-${int(10, 99)}` : null,
    extra.diagnosis ?? null, extra.drug ?? null, extra.dose ?? null, people.vet.name,
    extra.milkUntil ?? null, extra.meatUntil ?? null, extra.next ?? null, extra.cost ?? null, extra.notes ?? null, people.vet.id,
  ]);

const herdAdults = [...cows.map((c) => c.animal), ...breedingBulls];
const fmdLate = new Set(shuffle(herdAdults).slice(0, 20).map((a) => a.id)); // 20 still waiting for the October round
for (const a of herdAdults) {
  he(a, "vaccine", new Date("2026-04-12T00:00:00Z"), { vaccine: "FMD", next: fmdLate.has(a.id) ? new Date("2026-10-09T00:00:00Z") : null, cost: 60 });
  if (!fmdLate.has(a.id)) he(a, "vaccine", new Date("2026-10-05T00:00:00Z"), { vaccine: "FMD", next: new Date("2027-04-03T00:00:00Z"), cost: 60 });
  he(a, "vaccine", new Date("2026-05-10T00:00:00Z"), { vaccine: "HS", next: new Date("2026-11-06T00:00:00Z"), cost: 40 });
  he(a, "vaccine", new Date("2026-02-20T00:00:00Z"), { vaccine: "ANTHRAX", next: new Date("2027-02-20T00:00:00Z"), cost: 40 });
  he(a, "vaccine", new Date("2026-03-15T00:00:00Z"), { vaccine: "LSD", next: new Date("2027-03-15T00:00:00Z"), cost: 120 });
  he(a, "deworming", new Date("2026-07-20T00:00:00Z"), { vaccine: "DEWORM", next: new Date("2026-10-18T00:00:00Z"), drug: "Albendazole", cost: 80 });
}
for (const b of fattening) {
  const arrival = addDays(b.animal.purchaseDate!, int(2, 6));
  he(b.animal, "deworming", arrival, { vaccine: "DEWORM", next: addDays(arrival, 90), drug: "Ivermectin + Albendazole", cost: 120, notes: "On arrival from haat." });
  he(b.animal, "vaccine", addDays(arrival, 7), { vaccine: "FMD", next: addDays(arrival, 187), cost: 60 });
  he(b.animal, "vaccine", addDays(arrival, 14), { vaccine: "LSD", next: addDays(arrival, 379), cost: 120 });
  he(b.animal, "vaccine", addDays(arrival, 21), { vaccine: "HS", next: addDays(arrival, 201), cost: 40 });
  if (addDays(arrival, 90) < TODAY) he(b.animal, "deworming", addDays(arrival, 90), { vaccine: "DEWORM", next: addDays(arrival, 180), drug: "Albendazole", cost: 80 });
}
for (const c of animals.filter((a) => a.purpose === "calf")) {
  const age = daysBetween(c.birthDate, TODAY);
  if (age > 120) {
    he(c, "vaccine", addDays(c.birthDate, 120), { vaccine: "FMD", next: addDays(c.birthDate, 300), cost: 60 });
    he(c, "vaccine", addDays(c.birthDate, 130), { vaccine: "BQ", next: addDays(c.birthDate, 495), cost: 40 });
  }
  if (age > 30) he(c, "deworming", addDays(c.birthDate, 30), { vaccine: "DEWORM", next: addDays(c.birthDate, 120), drug: "Piperazine", cost: 30 });
}

// Treatments with withdrawal periods — milk from these days must not be sold.
const milkWithdrawal: { cowId: string; from: Date; until: Date }[] = [];
const mastitis = shuffle(cows.filter((c) => !c.dryOffDate)).slice(0, 5);
mastitis.forEach((c, k) => {
  const date = k === 0 ? addDays(TODAY, -2) : addDays(TODAY, -int(10, 80));
  const until = addDays(date, 4);
  milkWithdrawal.push({ cowId: c.animal.id, from: date, until });
  he(c.animal, "treatment", date, {
    diagnosis: "Clinical mastitis (one quarter)",
    drug: "Ceftriaxone + Meloxicam",
    dose: "Intramammary for 3 days",
    milkUntil: until,
    meatUntil: addDays(date, 10),
    cost: 1450,
    notes: "Milk discarded during withdrawal.",
  });
});
const footRot = shuffle(fattening).slice(0, 3);
footRot.forEach((b) => {
  const date = addDays(TODAY, -int(5, 60));
  he(b.animal, "treatment", date, { diagnosis: "Foot rot", drug: "Oxytetracycline LA", dose: "1 ml / 10 kg, single dose", meatUntil: addDays(date, 28), cost: 650 });
});
const bloat = fattening[17]!;
he(bloat.animal, "treatment", addDays(TODAY, -12), { diagnosis: "Frothy bloat after green fodder", drug: "Anti-bloat oral drench", cost: 300 });
const milkFever = cows.find((c) => daysBetween(c.lastCalving, TODAY) < 30);
if (milkFever) {
  he(milkFever.animal, "treatment", addDays(milkFever.lastCalving, 1), { diagnosis: "Milk fever (hypocalcaemia)", drug: "Calcium borogluconate IV", dose: "450 ml slow IV", cost: 900 });
}
for (let m = 0; m < 4; m++) {
  he(pick(cows).animal, "vet_visit", addDays(TODAY, -m * 30 - 3), { notes: "Monthly herd visit: udder checks, body condition, pregnancy diagnosis.", cost: 2000 });
}

insert(
  "health_events",
  ["farm_id", "animal_id", "type", "date", "vaccine_id", "batch_no", "diagnosis", "drug", "dose", "vet_name", "milk_withdrawal_until", "meat_withdrawal_until", "next_due_date", "cost_tk", "notes", "recorded_by_id"],
  health,
);

/* ───────────── milk (last 90 days) ───────────── */

function lactationFactor(dim: number) {
  // Rise to peak around day 50, then decline ~0.22% a day, floor at 35% of peak.
  if (dim < 50) return 0.72 + 0.28 * (dim / 50);
  return Math.max(0.35, 1 - 0.0022 * (dim - 50));
}
const milkRows: [string, number, number, number, boolean][] = []; // tag, day offset, am, pm, withheld
const dailyTotals = new Map<string, { sellable: number; withheld: number }>();
for (const c of cows) {
  const start = c.lastCalving > MILK_START ? addDays(c.lastCalving, 1) : MILK_START;
  const end = c.dryOffDate && c.dryOffDate < TODAY ? addDays(c.dryOffDate, -1) : TODAY;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dim = daysBetween(c.lastCalving, d);
    const pregnancyDrop = c.expectedCalving && daysBetween(d, c.expectedCalving) < 150 ? 0.9 : 1;
    const day = c.peak * lactationFactor(dim) * pregnancyDrop * between(0.93, 1.07);
    const withheld = milkWithdrawal.some((w) => w.cowId === c.animal.id && d >= w.from && d <= w.until);
    const am = round1(day * between(0.53, 0.58));
    const pm = round1(Math.max(0, day - am));
    milkRows.push([c.animal.tag, daysBetween(MILK_START, d), am, pm, withheld]);
    const t = dailyTotals.get(iso(d)) ?? { sellable: 0, withheld: 0 };
    if (withheld) t.withheld += am + pm;
    else t.sellable += am + pm;
    dailyTotals.set(iso(d), t);
  }
}
// Compact form: one row per cow-day, expanded into morning and evening records by the database.
for (let i = 0; i < milkRows.length; i += 2500) {
  const values = milkRows
    .slice(i, i + 2500)
    .map(([tag, d, am, pm, w]) => `('${tag}',${d},${am.toFixed(1)},${pm.toFixed(1)},${w})`)
    .join(",\n");
  statements.push(
    `INSERT INTO "milk_records" ("farm_id", "animal_id", "date", "session", "litres", "under_withdrawal", "recorded_by_id")\n` +
      `SELECT '${FARM}', a.id, DATE '${iso(MILK_START)}' + v.d, s.session::milk_session,\n` +
      `  CASE s.session WHEN 'am' THEN v.am ELSE v.pm END, v.w,\n` +
      `  CASE s.session WHEN 'am' THEN '${people.worker1.id}'::uuid ELSE '${people.worker2.id}'::uuid END\n` +
      `FROM (VALUES\n${values}\n) AS v(tag, d, am, pm, w)\n` +
      `JOIN "animals" a ON a.farm_id = '${FARM}' AND a.tag = v.tag\n` +
      `CROSS JOIN (VALUES ('am'), ('pm')) AS s(session);`,
  );
}

/* ───────────── milk buyers and sales ───────────── */

const BUYERS = [
  { id: uuid(), name: "Shahjadpur milk collection centre (cooperative)", kind: "collector", share: 0.8, price: 52 },
  { id: uuid(), name: "Moyna Mishti Bhandar", kind: "sweet_shop", share: 0.12, price: 60 },
  { id: uuid(), name: "Home delivery customers", kind: "direct", share: 0.05, price: 75 },
] as const;
insert("buyers", ["id", "farm_id", "name", "phone", "kind"], BUYERS.map((b) => [b.id, FARM, b.name, null, { raw: `'${b.kind}'::buyer_kind` }]));
const sales: V[][] = [];
for (const [date, t] of [...dailyTotals.entries()].sort()) {
  const d = new Date(`${date}T00:00:00Z`);
  for (const b of BUYERS) {
    const litres = round1(t.sellable * b.share);
    const amount = Math.round(litres * b.price);
    // The collection centre pays weekly; the current week is still due.
    const paid = b.kind === "collector" && daysBetween(d, TODAY) < 7 ? 0 : amount;
    sales.push([FARM, b.id, d, litres.toFixed(2), b.price.toFixed(2), amount, paid]);
  }
}
insert("milk_sales", ["farm_id", "buyer_id", "date", "litres", "price_per_litre_tk", "amount_tk", "paid_tk"], sales);

/* ───────────── weigh-ins and fattening plans ───────────── */

const weighRows: V[][] = [];
const latestWeight = new Map<string, number>();
function weigh(a: Animal, date: Date, kg: number, tape: boolean) {
  const girth = tape ? round1(Math.sqrt((kg * 300) / 1.1) * 1.0) : null; // rough inverse of Schaeffer's formula, for display
  weighRows.push([FARM, a.id, date, kg.toFixed(1), { raw: `'${tape ? "tape" : "scale"}'::weigh_method` }, girth, tape ? round1(girth! * 0.9) : null, round1(between(2.5, 3.6)).toFixed(1), people.worker2.id]);
  latestWeight.set(a.id, kg);
}
for (const b of fattening) {
  const tape = chance(0.25);
  for (let d = b.animal.purchaseDate!, n = 0; d <= TODAY; d = addDays(d, 14), n++) {
    const days = daysBetween(b.animal.purchaseDate!, d);
    const kg = Math.round((b.startWeight + b.adg * days) * between(0.985, 1.015) * 2) / 2;
    weigh(b.animal, d, n === 0 ? b.startWeight : kg, tape && n > 0);
  }
}
for (const c of animals.filter((a) => a.purpose === "calf")) {
  const birthKg = round1(between(22, 32));
  const adg = between(0.35, 0.55);
  for (let d = c.birthDate, n = 0; d <= TODAY; d = addDays(d, 30), n++) {
    weigh(c, d, round1(birthKg + adg * daysBetween(c.birthDate, d)), false);
  }
}
for (const b of breedingBulls) {
  const base = between(430, 720);
  weigh(b, addDays(TODAY, -95), Math.round(base), false);
  weigh(b, addDays(TODAY, -5), Math.round(base * between(1.0, 1.03)), false);
}
insert(
  "weigh_ins",
  ["farm_id", "animal_id", "date", "weight_kg", "method", "heart_girth_cm", "body_length_cm", "body_condition_score", "recorded_by_id"],
  weighRows,
);
insert(
  "fattening_plans",
  ["farm_id", "animal_id", "season_year", "start_date", "start_weight_kg", "target_weight_kg", "price_per_kg_tk", "notes"],
  fattening.map((b) => [FARM, b.animal.id, 2027, b.animal.purchaseDate!, b.startWeight.toFixed(1), b.target.toFixed(1), 550, null]),
);

/* ───────────── feed and expenses ───────────── */

const FEED: Record<ShedKey, [string, number, number][]> = {
  // item, kg per head per day, taka per kg
  cowsA: [["Napier grass (green)", 22, 4], ["Rice straw", 4, 6], ["Wheat bran", 2.5, 48], ["Mustard oil cake", 1, 62], ["Maize crush", 1.5, 38]],
  cowsB: [["Napier grass (green)", 22, 4], ["Rice straw", 4, 6], ["Wheat bran", 2.5, 48], ["Mustard oil cake", 1, 62], ["Maize crush", 1.5, 38]],
  calves: [["Calf starter", 0.8, 70], ["Green grass", 4, 4]],
  fat1: [["Rice straw", 5, 6], ["Napier grass (green)", 12, 4], ["Fattening concentrate", 3.5, 52], ["Molasses-urea mix", 0.4, 40]],
  fat2: [["Rice straw", 5, 6], ["Napier grass (green)", 12, 4], ["Fattening concentrate", 3.5, 52], ["Molasses-urea mix", 0.4, 40]],
  bulls: [["Napier grass (green)", 25, 4], ["Wheat bran", 3, 48], ["Rice straw", 5, 6]],
};
const headCount = (s: ShedKey) => animals.filter((a) => a.shed === s).length;
const feedRows: V[][] = [];
const monthlyFeed = new Map<string, number>();
for (let d = MILK_START; d <= TODAY; d = addDays(d, 1)) {
  for (const s of Object.keys(FEED) as ShedKey[]) {
    let heads = headCount(s);
    if (s === "fat1" || s === "fat2") heads = fattening.filter((b) => b.animal.shed === s && b.animal.purchaseDate! <= d).length;
    if (s === "calves") heads = animals.filter((a) => a.shed === "calves" && a.birthDate <= d).length;
    if (heads === 0) continue;
    for (const [item, kg, price] of FEED[s]) {
      const qty = round1(kg * heads * between(0.95, 1.05));
      const cost = Math.round(qty * price);
      feedRows.push([FARM, d, shedId[s], null, item, qty.toFixed(2), cost]);
      const m = iso(d).slice(0, 7);
      monthlyFeed.set(m, (monthlyFeed.get(m) ?? 0) + cost);
    }
  }
}
insert("feed_logs", ["farm_id", "date", "shed_id", "animal_id", "item", "quantity_kg", "cost_tk"], feedRows);

const expenses: V[][] = [];
for (const b of fattening) {
  expenses.push([FARM, b.animal.purchaseDate!, { raw: "'animal_purchase'::expense_category" }, b.animal.purchasePriceTk!, b.animal.id, shedId[b.animal.shed], `Bought at ${b.animal.purchasedFrom}`]);
  expenses.push([FARM, b.animal.purchaseDate!, { raw: "'transport'::expense_category" }, int(8, 15) * 100, b.animal.id, null, "Truck from haat"]);
}
for (const [month, cost] of monthlyFeed) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = addDays(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)), -1);
  const date = last < TODAY ? last : TODAY;
  expenses.push([FARM, date, { raw: "'feed'::expense_category" }, cost, null, null, `Feed for ${month} (from daily feed log)`]);
  expenses.push([FARM, date, { raw: "'labour'::expense_category" }, 8 * 15_000, null, null, "8 farm workers"]);
  expenses.push([FARM, date, { raw: "'utilities'::expense_category" }, int(14, 19) * 1000, null, null, "Electricity, water pump, fans"]);
  expenses.push([FARM, date, { raw: "'vet'::expense_category" }, 2000, null, null, "Monthly vet visit"]);
}
insert("expenses", ["farm_id", "date", "category", "amount_tk", "animal_id", "shed_id", "note"], expenses);

/* ───────────── marketplace: 12 bulls listed for Eid 2027 ───────────── */

const daysToEid = daysBetween(TODAY, EID_2027);
const listed = [...fattening].sort((a, b) => (latestWeight.get(b.animal.id) ?? 0) - (latestWeight.get(a.animal.id) ?? 0)).slice(0, 12);
insert(
  "listings",
  ["farm_id", "animal_id", "slug", "category", "title", "description", "price_tk", "negotiable", "district", "status", "published_at"],
  listed.map((b) => {
    const now = latestWeight.get(b.animal.id) ?? b.startWeight;
    const projected = Math.round(now + b.adg * daysToEid);
    const price = Math.round((projected * 600) / 5000) * 5000;
    return [
      FARM, b.animal.id, `${b.animal.tag.toLowerCase()}-${(b.animal.name ?? "bull").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-shonali`,
      { raw: "'qurbani'::listing_category" },
      `${b.animal.name ?? b.animal.tag} — ${b.animal.breedLabel}, ~${projected} kg by Eid`,
      `${b.animal.breedLabel}, ${b.animal.color.toLowerCase()}. ${Math.round(now)} kg today, gaining about ${b.adg.toFixed(2)} kg a day on straw, Napier grass and concentrate. Vaccinated (FMD, LSD, HS) and dewormed. No growth hormones. Visits welcome in Shahjadpur.`,
      price, true, "Sirajganj", { raw: "'active'::listing_status" }, { raw: "now()" },
    ];
  }),
);

/* ───────────── write ───────────── */

const dir = readdirSync(path.join(process.cwd(), "netlify/database/migrations")).find((d) => d.endsWith("_demo_farm"));
if (!dir) throw new Error("demo_farm migration folder not found — run `drizzle-kit generate --custom --name demo_farm` first.");
const header = [
  "-- Demo farm: Shonali Dairy & Agro (demo), Shahjadpur, Sirajganj — data as of 2026-10-13.",
  `-- ${cows.length} milk cows, ${animals.filter((a) => a.purpose === "calf").length} calves, ${fattening.length} Qurbani bulls, ${breedingBulls.length} breeding bulls.`,
  "-- Generated by scripts/demo/generate-demo-farm.ts. Do not edit by hand.",
  "-- Sign in as the owner with 01700-000001 (demo mode shows the code on screen).",
].join("\n");
writeFileSync(path.join("netlify/database/migrations", dir, "migration.sql"), `${header}\n${statements.join("\n--> statement-breakpoint\n")}\n`);
console.log(
  `Wrote ${dir}: ${animals.length} animals, ${milkRows.length * 2} milk records, ${breeding.length} breeding events, ` +
    `${health.length} health events, ${weighRows.length} weigh-ins, ${feedRows.length} feed logs, ${sales.length} milk sales, ${expenses.length} expenses.`,
);
