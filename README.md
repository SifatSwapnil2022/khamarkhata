# Khamar Khata · খামার খাতা

A record book for cattle farms in Bangladesh, in Bangla and English, for a farmer with 2 cows or a farm with 2,000. It keeps each animal's milk, vaccines, breeding, weight and sale, and it has a cattle market where listings show the farm's own records.

- **Dairy:** milk per cow, morning and evening; works without internet and sends later; milk sales and buyer dues.
- **Breeding:** heat, AI, pregnancy checks, calving and dry-off, with a calendar of what's due and an inbreeding warning.
- **Health:** vaccines for a whole group at once, treatments, and withdrawal periods that keep milk or meat out of sale.
- **Qurbani:** weigh-ins by scale or tape, each bull's projected weight at Eid, cost and margin per bull.
- **Money:** revenue, expenses and net by month and category; CSV downloads for Excel or Google Sheets.
- **Cattle market:** list an animal in a few taps; buyers see its weight, milk and vaccines and send a question; the farmer's number stays hidden.
- **Team:** owner, manager, worker and vet logins, each seeing only what their role needs.

---

## বাংলায় নির্দেশনা (খামারিদের জন্য)

খামার খাতা ফোনে বা কম্পিউটারে চলে। কোনো অ্যাপ নামাতে হয় না, শুধু ওয়েবসাইটটি খুলুন। ২টি গরু হোক বা ১০০০টি, একইভাবে চলে।

**কীভাবে ঢুকবেন**

1. আপনার মোবাইল নম্বর লিখুন, যেমন ০১৭১২-৩৪৫৬৭৮। তারপর **“কোড পাঠান”** চাপুন।
2. ফোনে একটি এসএমএস আসবে, তাতে ৬টি সংখ্যার কোড থাকবে।
3. কোডটি লিখে **“যাচাই করে এগিয়ে যান”** চাপুন।
4. প্রথমবার হলে খামারের নাম আর জেলা লিখুন। আপনার খামার তৈরি।

কোড কাউকে বলবেন না। খামার খাতার কেউ কখনো কোড চাইবে না।

**প্রতিদিনের কাজ**

| কী করবেন | কোথায় চাপবেন |
|---|---|
| গরু যোগ করা | **পশু** → **পশু যোগ করুন** → ট্যাগ নম্বর, জাত, জন্মতারিখ → **সংরক্ষণ করুন** |
| গরুর ছবি তোলা | পশুটি খুলুন → **ছবি তুলুন** → দিনের আলোয়, পাশ থেকে ছবি তুলুন |
| দুধ লেখা | **দুধ** → **দুধ লিখুন** → সকাল বা বিকাল → প্রতিটি গাভীর লিটার → **দোহন সংরক্ষণ** |
| টিকা বা চিকিৎসা | **স্বাস্থ্য** → **দলে টিকা** বা **চিকিৎসা লিখুন** |
| গরম, প্রজনন, বাচ্চা দেওয়া | **প্রজনন** → **ঘটনা লিখুন** |
| কোরবানির ষাঁড়ের ওজন | **কোরবানি** → **ওজন নিন** (পাল্লা না থাকলে ফিতার মাপেও হয়) |
| হাটে বিক্রি | **বাজার** → **বিজ্ঞাপন দিন** → পশু বাছুন, দাম লিখুন |
| কর্মী বা ডাক্তার যোগ | **টিম** → তার নম্বর লিখুন → ভূমিকা বাছুন → **আমন্ত্রণ পাঠান** |

**ফোনে অ্যাপের মতো রাখুন:** অ্যান্ড্রয়েডে Chrome-এ ⋮ চেপে “Add to Home screen”; আইফোনে Safari-তে শেয়ার বোতাম চেপে “Add to Home Screen”।

ওয়েবসাইটের **/help** পাতায় সব ধাপ ছবিসহ বড় অক্ষরে আছে, লগইন পাতাতেও ঢোকার নিয়ম লেখা আছে। উপরের **বাংলা / English** বোতামে যেকোনো সময় ভাষা বদলানো যায়। সাইট প্রথমে বাংলায় খোলে।

---

## Status

Deployed on Vercel with a Neon Postgres database in Singapore. Every push to `main` deploys.

Built so far:

- **Public pages:**
  - home page made of real photographs from Bangladeshi farms and haats, with slow photo motion and a scroll story
  - help page with step-by-step instructions in Bangla
  - sign-in instructions on the login page
  - cattle market
- **Sign-in:** phone sign-in with a one-time code, farms, team roles, Bangla/English, light and dark mode.
- **Records:** animals with profiles and pedigree, and each animal's own photo taken with the phone camera.
- **Farm work:** dairy, health, breeding, Qurbani, finance and CSV export.
- **Market:** listing form and buyer inquiries.
- **Install on phones:** installable on Android and iPhone home screens (web app manifest, safe-area layout).

## Tools and libraries

| Area | Tool | Why |
|---|---|---|
| Framework | [Next.js 15](https://nextjs.org/docs) (App Router, Server Components, Server Actions) | Pages render on the server, so cheap phones on slow connections get readable HTML first |
| UI | [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com/docs) | Mobile-first layouts and design tokens for light and dark mode |
| Language | [TypeScript 6](https://www.typescriptlang.org/docs/) (strict) | |
| Database | [PostgreSQL](https://www.postgresql.org/docs/): [Neon](https://neon.tech/docs) in production, [PGlite](https://pglite.dev) (Postgres in WebAssembly) locally and in tests | No database setup for development; tests run against real Postgres |
| ORM and migrations | [Drizzle ORM and drizzle-kit](https://orm.drizzle.team/docs/overview) | Typed queries; plain SQL migrations committed to the repo |
| Postgres driver | [postgres.js](https://github.com/porsager/postgres) | |
| Validation | [Zod 4](https://zod.dev) | Every form is checked on the server |
| Icons | [Lucide](https://lucide.dev) | |
| Fonts | [Noto Sans Bengali](https://fonts.google.com/noto/specimen/Noto+Sans+Bengali), [Manrope](https://fonts.google.com/specimen/Manrope), [Figtree](https://fonts.google.com/specimen/Figtree), self-hosted through [Fontsource](https://fontsource.org) | Bangla renders the same on every phone, with no external font requests |
| Charts | Hand-built SVG components | Small, readable at 12 px, each with a "show as table" option |
| Tests | [Vitest](https://vitest.dev) for unit and database tests, [Playwright](https://playwright.dev) for browser checks during development | |
| Linting | [ESLint 9](https://eslint.org) with `eslint-config-next` | |
| Hosting | [Vercel](https://vercel.com/docs) (region `sin1`, Singapore) | |
| CI | GitHub Actions: lint, type-check, tests, production build | |
| Photos | [Unsplash](https://unsplash.com/license) and [Pexels](https://www.pexels.com/license/) photos taken in Bangladesh, plus the project's own home-page photo | Real farms and haats, credited on every use |

## Demo farm

Every database includes a demo farm, *Shonali Dairy & Agro (demo)* in Shahjadpur, Sirajganj, with records as of 13 Oct 2026. Everything on it is sample data and is labelled as such on the site.

- **Herd:**
  - 100 milk cows (HF, Sahiwal and Jersey crosses, Red Chittagong, Pabna and local)
  - 50 calves, each linked to its mother and to the sire or AI straw
  - 100 Qurbani bulls
  - 10 breeding bulls
- **Records:**
  - 90 days of milk
  - full breeding history
  - vaccines and treatments
  - weigh-ins
  - feed
  - milk sales
  - expenses
  - market listings
- **Names:** cows have village names, and a name that describes the coat always matches it (Lali is red, Dholi is white, Kali is black). Qurbani bulls carry the kind of names reported from Eid cattle haats, matched to the coat:
  - black: *Kala Pahar*, *Kalo Manik*
  - white: *Dhola Pahar*, *Shada Pahar*
  - red: *Lal Pahar*, *Lalu*
  - any coat: *Raja Babu*, *Sultan*, *Badsha*

  Names of living people, popular at some haats, are left out on purpose.
- **Photos:**
  - 77 animals have a real photograph, and no two animals share one.
  - Each photo was taken in Bangladesh, comes from Unsplash or Pexels, and shows its photographer and a link to its page.
  - Where a photo's page doesn't state the coat colour, the animal's record leaves the colour blank and its name doesn't name a colour, so the name never contradicts the picture.
  - The other animals show "No photo yet", as on a real farm. Farmers add their own with the **Add photo** button.

Sign in as the owner with **01700-000001**. Staff accounts: 01700-000002 (manager), -03 and -04 (workers), -05 (vet). Many visitors can use the demo login at once.

The demo data comes from migrations generated by `scripts/demo/generate-demo-farm.ts` and `scripts/demo/assign-real-photos.mts`.

## Run it

Requires Node 22.9+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000 and sign in with any Bangladeshi number, such as `01711-111111`. In development the 6-digit code appears on the login screen and in the terminal.

No database setup is needed. Local development uses PGlite (stored in `./.data`), which migrates itself on first start. `npm run db:reset` wipes it; the demo farm returns on the next start.

To use a real Postgres instead:

```bash
docker compose up -d
# in .env:
DATABASE_URL=postgres://khamar:khamar@localhost:5432/khamar
npm run db:migrate
npm run dev
```

## Deploy on Vercel

1. Create a free Postgres on [Neon](https://neon.tech) (region: Singapore) and copy its connection string.
2. Import the GitHub repo on [Vercel](https://vercel.com/new). Framework: Next.js.
3. Add these environment variables:
   - `DATABASE_URL` (Neon, pooled)
   - `DATABASE_URL_UNPOOLED` (Neon, direct; optional)
   - `OTP_SECRET` (32+ random characters)
   - `SMS_PROVIDER=console`
   - `DEMO_MODE=true`
4. Deploy. The `vercel-build` script applies the migrations (schema and demo farm) to Neon before building.

`DEMO_MODE=true` shows sign-in codes on screen for any number. Turn it off once a real SMS gateway is connected.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest against an in-memory Postgres. It covers: phone rules, permissions, OTP and session security, team flows, dairy, health, breeding, Qurbani, finance, animal photos, and a 1,000-animal farm. |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm run db:generate` | Generate a SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

## Notes and limits

- **Photo storage:** animal photos are shrunk on the phone (longest side 1280 px, JPEG) and stored in Postgres. For farms with thousands of photos, an object store such as Vercel Blob or S3 would be the next step.
- **SMS:** no gateway is connected yet. `SMS_PROVIDER=console` logs codes instead of sending them.
- **Offline use:** milk entry works offline. The other forms need a connection.
- **Estimates:** due dates for breeding, Eid weight projections and tape weights are estimates and are labelled as such.

## Docs

- [Architecture, data model, permissions, auth](docs/ARCHITECTURE.md)
