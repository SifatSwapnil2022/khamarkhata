import type { MetadataRoute } from "next";

/** Lets farmers add Khamar Khata to the home screen on Android and iPhone and open it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "খামার খাতা · Khamar Khata",
    short_name: "খামার খাতা",
    description: "গরুর খামারের খাতা: দুধ, টিকা, প্রজনন, কোরবানির ওজন আর হিসাব। Farm records for cattle farms in Bangladesh.",
    lang: "bn",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f3",
    theme_color: "#1f6b4a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
