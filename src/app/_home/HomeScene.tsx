"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import type { SceneTag } from "./FarmScene";

// Three.js loads after the page's text, so the words are readable before the farm appears.
const FarmScene = dynamic(() => import("./FarmScene").then((m) => m.FarmScene), { ssr: false });

export function HomeScene(props: {
  trackId: string;
  heroTags: SceneTag[];
  dairy: SceneTag[];
  bulls: SceneTag[];
  family: { dam: SceneTag; calf: SceneTag; sire: SceneTag } | null;
  fallback: { url: string; credit: string };
  loading: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  return (
    <div className="absolute inset-0 bg-[#e6eee8]">
      {/* Shown until the scene is ready, and kept if WebGL isn't available. */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${state === "ready" ? "opacity-0" : "opacity-100"}`}>
        <Image src={props.fallback.url} alt="" fill priority sizes="100vw" className="object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#e6eee8]/80 via-transparent to-transparent" />
        {state === "loading" ? (
          <p className="absolute right-5 bottom-5 rounded-full bg-white/90 px-3 py-1 text-[13px] font-medium text-ink-2" role="status">
            {props.loading}
          </p>
        ) : null}
      </div>
      {state !== "failed" ? (
        <FarmScene
          trackId={props.trackId}
          heroTags={props.heroTags}
          dairy={props.dairy}
          bulls={props.bulls}
          family={props.family}
          onReady={() => setState("ready")}
          onFail={() => setState("failed")}
        />
      ) : null}
    </div>
  );
}
