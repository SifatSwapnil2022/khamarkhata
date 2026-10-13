import clsx from "clsx";
import Image from "next/image";

/** Cover photo, or a drawn placeholder for animals nobody has photographed yet. */
export function AnimalPhoto({
  url,
  alt,
  noPhotoLabel,
  sizes,
  className,
  priority = false,
}: {
  url: string | null;
  alt: string;
  noPhotoLabel: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      <div className={clsx("relative overflow-hidden bg-surface-2", className)}>
        <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-2 bg-surface-2 text-line-strong", className)}>
      <svg aria-hidden="true" viewBox="0 0 64 48" className="h-12 w-16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 10c4 0 7 2 9 5M54 10c-4 0-7 2-9 5" />
        <path d="M19 15c3-3 8-4 13-4s10 1 13 4c2 3 2 8 1 12l-3 9c-1 4-5 7-11 7s-10-3-11-7l-3-9c-1-4-1-9 1-12Z" />
        <circle cx="25" cy="24" r="1.6" fill="currentColor" />
        <circle cx="39" cy="24" r="1.6" fill="currentColor" />
        <path d="M26 35c2 1.5 4 2 6 2s4-.5 6-2" />
      </svg>
      <span className="text-sm font-medium text-muted">{noPhotoLabel}</span>
    </div>
  );
}
