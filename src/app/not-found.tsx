import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
      <p className="font-display text-sm font-semibold text-primary">404</p>
      <h1 className="font-display text-3xl font-bold">This page isn&apos;t on the farm</h1>
      <p lang="bn" className="text-ink-2">
        এই পাতাটি খুঁজে পাওয়া যায়নি।
      </p>
      <Link href="/" className="font-semibold text-primary">
        ← Home · হোম
      </Link>
    </main>
  );
}
