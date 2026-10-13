import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/figtree/index.css";
import "@fontsource-variable/noto-sans-bengali/index.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLocale } from "@/i18n";

export const metadata: Metadata = {
  title: { default: "Khamar Khata — খামার খাতা", template: "%s · Khamar Khata" },
  description: "Farm records for Bangladeshi cattle farms: milk, breeding, vaccines and Qurbani fattening.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1410" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-ground text-ink antialiased">{children}</body>
    </html>
  );
}
