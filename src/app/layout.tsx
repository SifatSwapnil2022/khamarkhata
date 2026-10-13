import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/hind-siliguri/400.css";
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLocale } from "@/i18n";

export const metadata: Metadata = {
  title: { default: "Khamar Khata — খামার খাতা", template: "%s · Khamar Khata" },
  description: "Farm records for Bangladeshi cattle farms: milk, breeding, vaccines and Qurbani fattening.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121a15" },
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
