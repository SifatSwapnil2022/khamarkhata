/** Big numbered steps, for people who read slowly: one short sentence per step, a large number beside it. */
export function Steps({ steps, digits, size = "md" }: { steps: string[]; digits: (s: string) => string; size?: "md" | "sm" }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3.5">
          <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-display font-extrabold text-white ${size === "sm" ? "size-8 text-[16px]" : "size-10 text-[19px]"}`}
          >
            {digits(String(i + 1))}
          </span>
          <span className={`pt-1 leading-relaxed ${size === "sm" ? "text-[15.5px]" : "text-[17px]"}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
