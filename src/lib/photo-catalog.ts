/**
 * Real photographs of cattle taken in Bangladesh, free to use:
 *   - Unsplash License: https://unsplash.com/license
 *   - Pexels License:   https://www.pexels.com/license/
 * Each photo's place comes from its page (or, for a few Pexels photos with no place listed, from a
 * photographer whose other photos in this list are all located in Bangladesh). Images are served from
 * the sites' own CDNs. Pexels credits use the photographer's Pexels handle, and every use shows the photographer and links to the photo's page.
 *
 * The demo farm gives each photo to at most one animal, so no two animals share a picture.
 * Animals left without one show "No photo yet", as on a real farm.
 *
 * subject: what the photo suits — a Qurbani/haat bull, a cow, a cow with her calf, or working oxen/bull.
 * colour:  coat colour when the photo's description states it.
 */
export type CatalogPhoto = {
  id: string;
  source: "Unsplash" | "Pexels";
  page: string;
  image: string;
  photographer: string;
  place: string;
  subject: "haat" | "cow" | "calf" | "ox";
  colour?: "Black" | "White" | "Brown" | "Brown and white" | "Red and white";
  /** true when one animal is the clear subject (better for a profile photo). */
  single: boolean;
};

const u = (slug: string, photo: string, photographer: string, place: string, subject: CatalogPhoto["subject"], single: boolean, colour?: CatalogPhoto["colour"]): CatalogPhoto => ({
  id: `u-${slug}`,
  source: "Unsplash",
  page: `https://unsplash.com/photos/${slug}`,
  image: `https://images.unsplash.com/photo-${photo}`,
  photographer,
  place,
  subject,
  single,
  colour,
});

const p = (id: number, photographer: string, place: string, subject: CatalogPhoto["subject"], single: boolean, colour?: CatalogPhoto["colour"], ext = "jpeg"): CatalogPhoto => ({
  id: `p-${id}`,
  source: "Pexels",
  page: `https://www.pexels.com/photo/${id}/`,
  image: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}`,
  photographer,
  place,
  subject,
  single,
  colour,
});

export const ANIMAL_PHOTOS: CatalogPhoto[] = [
  /* ── Haat and Eid: bulls tied, decorated, being led ── */
  p(37961868, "tanhatamannasyed", "Dhaka", "haat", true, "White"),
  p(32401109, "monirulislam", "Dhaka", "haat", true, "Brown"),
  p(37961847, "tanhatamannasyed", "Dhaka", "haat", true),
  p(32401106, "monirulislam", "Dhaka", "haat", true),
  p(32401112, "monirulislam", "Dhaka", "haat", true),
  p(32401115, "monirulislam", "Dhaka", "haat", true),
  p(32401108, "monirulislam", "Dhaka", "haat", true),
  p(37961854, "tanhatamannasyed", "Dhaka", "haat", true),
  p(37961852, "tanhatamannasyed", "Dhaka", "haat", true),
  p(37961838, "tanhatamannasyed", "Dhaka", "haat", true),
  p(28308873, "mohammad-samir", "Bangladesh", "haat", true),
  p(32355112, "aymanshuvro", "Bangladesh", "haat", true),
  p(9068063, "simonreza", "Dhaka", "haat", true, "Brown"),
  u("WgiW1lIJVp8", "1586459226458-409b7248148a", "Yeasir Arafat", "Hazipur, Noakhali", "haat", true, "Brown and white"),
  u("l8ctIp0bFlA", "1658660552673-7810f0067c42", "mohammad samir", "Dhaka", "haat", true),
  u("f5dNxY-96T4", "1719340311599-582845d83221", "mohammad samir", "Dhaka", "haat", true),
  u("2Wfejo1Dw1c", "1634193956871-efe526423bb3", "mohammad samir", "Dhaka", "haat", true),
  u("Z7MgKbRg7OA", "1680077988887-4f98bcb9a7df", "Ayman Ahmed", "Sitakund, Chattogram", "haat", true, "White"),
  u("Cky0CldLkiQ", "1605822596985-3b5c5663844e", "Simon Reza", "Dhaka", "haat", true, "Brown"),
  // TC72x4GIwdg left out: its page places it at the National Zoo, not a farm or haat.
  p(37961859, "tanhatamannasyed", "Dhaka", "haat", false),
  p(37961869, "tanhatamannasyed", "Dhaka", "haat", false),
  p(37961857, "tanhatamannasyed", "Dhaka", "haat", false),
  p(37961866, "tanhatamannasyed", "Dhaka", "haat", false),
  p(37961843, "tanhatamannasyed", "Dhaka", "haat", false),
  p(37961839, "tanhatamannasyed", "Dhaka", "haat", false),
  p(32401139, "monirulislam", "Dhaka", "haat", false),
  p(32401123, "monirulislam", "Dhaka", "haat", false),
  p(39330283, "rakib-pixel", "Dhaka", "haat", false),
  p(37623057, "faisal-ibne-kalam", "Dhaka", "haat", false),
  u("5I5iEzp0p1Y", "1719340711091-2523db6befe4", "mohammad samir", "Dhaka", "haat", false),
  u("AAMTA-44Llw", "1688064498565-7b256f569591", "mohammad samir", "Dhaka", "haat", false),

  /* ── Cows: grazing, led home, by the pond ── */
  p(32422315, "aymanshuvro", "Chattogram", "cow", true, "Brown and white"),
  p(35140175, "masudar", "Bogura", "cow", true, "Brown"),
  p(39293347, "jubayer-ahmed", "Habiganj", "cow", true),
  p(39354123, "mahidulislamnakib", "Dhaka", "cow", true),
  p(32766724, "imshaamim", "Netrokona", "cow", true),
  p(34945963, "masudar", "Rangpur", "cow", true),
  p(36726788, "masudar", "Rangpur", "cow", true),
  p(38248372, "masudar", "Thanchi, Bandarban", "cow", true),
  p(35647436, "masudar", "Rangpur", "cow", true),
  p(10059590, "nfzzz", "Chattogram", "cow", true),
  p(30222866, "niloy007", "Bangladesh", "cow", true),
  p(32391385, "niloy007", "Bangladesh", "cow", true),
  p(32420351, "niloy007", "Bangladesh", "cow", true),
  p(32391461, "niloy007", "Bangladesh", "cow", true),
  p(14950111, "riiyad", "Chilmari, Kurigram", "cow", true),
  u("G24QRa265Bw", "1693667308707-1ce4fabfa78d", "Tamim Arafat", "Sonagazi, Feni", "cow", true, "Brown"),
  u("T2Q8J2H9E5U", "1705829123113-09b045f0c784", "Monoar Rahman Rony", "Dhamrai", "cow", true),
  u("BMtWCYYO3b0", "1646666994136-c644ddb32d61", "Ehteshamul Haque Adit", "Dhaka", "cow", true, "Brown and white"),
  u("9k6ZdM294xU", "1627829374569-8696ba1560ae", "Tarikul Raana", "Bangladesh", "cow", true, "Brown"),
  u("HJqWXBtqD5o", "1708943081020-2082b47e21ba", "Farhan Reza", "Bangladesh", "cow", true),
  p(29886234, "rabeebur", "Dhaka", "cow", false, "Brown"),
  p(24307850, "ferdous", "Pabna", "cow", false),
  p(24307856, "ferdous", "Pabna", "cow", false),
  p(36811391, "masudar", "Pirganj, Rangpur", "cow", false),
  p(35239071, "masudar", "Rangpur", "cow", false),
  p(36705424, "masudar", "Rangpur", "cow", false),
  p(35560425, "masudar", "Rangpur", "cow", false),
  p(35820091, "masudar", "Gaibandha", "cow", false),
  p(37651719, "masudar", "Thanchi, Bandarban", "cow", false),
  p(37651725, "masudar", "Thanchi, Bandarban", "cow", false),
  p(30412887, "hasnat-biswas", "Alfadanga, Faridpur", "cow", false),
  p(35425846, "ashraful-islam", "Rajshahi", "cow", false),
  p(32563057, "shantodebnath27", "Cumilla", "cow", false, undefined, "png"),
  p(34664365, "riiyad", "Chilmari, Kurigram", "cow", false),
  p(6968371, "tarikulraana", "Bangladesh", "cow", false, "White"),
  u("N0ouxDAN8Nw", "1766858207728-698384162e8e", "Fareed Akhyear Chowdhury", "Dinajpur", "cow", false),
  u("qTtoJZapvvE", "1560206577-6d02421758b8", "Hasib Imtiaz", "Jessore", "cow", false),
  u("_Pc3t9bOAvQ", "1762709613839-34c6f69fdfd9", "Kabiur Rahman Riyad", "Kurigram", "cow", false),
  u("fv81nw-Ni_Y", "1705851394452-4f795e7e2314", "Mahamud Hasan", "Chattogram", "cow", false),

  /* ── Cows with calves ── */
  p(29048358, "niloy007", "Bangladesh", "calf", false),
  p(26725811, "nafish", "Noapara, Jessore", "calf", false),
  p(31163549, "md-mohibullah-khan", "Chattogram", "calf", false, "Brown", "png"),
  p(8595767, "pranay-mandal", "Bangladesh", "calf", false),
  p(10844370, "the-ahnafpiash", "Faridpur", "calf", false, "Brown", "png"),
  u("dFHTJxzs3GU", "1740477305175-8b39a2ae83ce", "Fareed Akhyear Chowdhury", "Bangladesh", "calf", false),

  /* ── Working oxen and bulls ── */
  u("KwxWmdls00M", "1696244388825-fc0d4293f6d6", "Sheikh Nayim Hasan", "Kuakata", "ox", true),
  p(6052968, "shahadat-hossain", "Nikli, Kishoreganj", "ox", false),
  p(34946003, "masudar", "Rangpur", "ox", false),
  p(36062645, "masudar", "Rangpur", "ox", false),
];

/** Size the photo on the CDN it came from. */
export function sizedUrl(image: string, width = 900) {
  return image.includes("images.pexels.com")
    ? `${image}?auto=compress&cs=tinysrgb&w=${width}`
    : `${image}?w=${width}&q=75&auto=format&fit=crop`;
}

const byId = (id: string) => {
  const ph = ANIMAL_PHOTOS.find((x) => x.id === id);
  if (!ph) throw new Error(`No catalog photo ${id}`);
  return ph;
};

/** Photos for the public home page. The hero is the project's own picture (public/photos), so it carries no outside credit. */
export const HOME_PHOTOS = {
  hero: { image: "/photos/home-hero.jpg", width: 1672, height: 941 },
  sizes: [byId("p-34945963"), byId("p-35820091"), byId("u-qTtoJZapvvE")],
  strip: ["p-37961868", "u-_Pc3t9bOAvQ", "p-32422315", "p-6052968", "u-dFHTJxzs3GU", "p-32401109", "p-38248372", "u-N0ouxDAN8Nw", "p-36062645", "u-KwxWmdls00M", "p-32766724", "p-10059590"].map(byId),
};

export const creditOf = (ph: CatalogPhoto) => `${ph.photographer} · ${ph.source} · ${ph.place}`;
