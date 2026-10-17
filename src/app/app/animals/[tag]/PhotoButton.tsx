"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { animalPhotoAction, type PhotoState } from "@/app/actions/media";

/** Longest side after shrinking. Enough for a sharp profile photo, small enough for a slow connection. */
const MAX_SIDE = 1280;

/** Shrink on the phone, so a 5 MB camera photo goes up as roughly 200 KB. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  const img: CanvasImageSource & { width: number; height: number } =
    bitmap ??
    (await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = URL.createObjectURL(file);
    }));
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.8));
}

export function PhotoButton({
  tag,
  hasPhoto,
  t,
}: {
  tag: string;
  hasPhoto: boolean;
  t: { add: string; change: string; saving: string; saved: string; hint: string; errors: Record<string, string> };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState<PhotoState, FormData>(animalPhotoAction, {});
  const [pending, start] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLocalError(null);
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.set("tag", tag);
      fd.set("photo", new File([blob], `${tag}.jpg`, { type: "image/jpeg" }));
      start(() => action(fd));
    } catch {
      setLocalError("type");
    }
  }

  const error = localError ?? state.error ?? null;
  return (
    <div className="flex flex-col items-start gap-1">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black/60 px-3.5 text-[15px] font-semibold text-white backdrop-blur-sm hover:bg-black/75 disabled:opacity-70"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
        {pending ? t.saving : hasPhoto ? t.change : t.add}
      </button>
      <p role="status" aria-live="polite" className="rounded-lg bg-black/55 px-2 text-[13px] text-white empty:hidden">
        {error ? (t.errors[error] ?? t.errors.type) : state.ok && !pending ? t.saved : ""}
      </p>
    </div>
  );
}
