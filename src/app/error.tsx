"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
      <p className="font-display text-sm font-semibold text-primary">Khamar Khata · খামার খাতা</p>
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p lang="bn" className="text-ink-2">
        কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।
      </p>
      <div>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-[10px] bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
        >
          Try again · আবার চেষ্টা করুন
        </button>
      </div>
    </main>
  );
}
