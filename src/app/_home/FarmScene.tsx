"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  grazePose,
  heightAt,
  makeAnimal,
  makeBanana,
  makeBoat,
  makeFence,
  makeHaystack,
  makeHouse,
  makeMaterial,
  makeMoon,
  makePaddy,
  makePalm,
  makeShed,
  makeSky,
  makeStars,
  makeTerrain,
  makeTree,
  makeWater,
  PLACES,
  type Animal,
  type CoatKind,
} from "./world";

/** A floating ear tag: which beat shows it and what it says. */
export type SceneTag = { id: string; beats: number[]; title: string; line: string; tone?: "milk" | "kin" | "weight" | "sire" };

type Props = {
  /** Id of the tall element whose scroll position drives the scene. */
  trackId: string;
  dairy: SceneTag[];
  family: { dam: SceneTag; calf: SceneTag; sire: SceneTag } | null;
  bulls: SceneTag[];
  heroTags: SceneTag[];
  onReady?: () => void;
  onFail?: () => void;
};

/* Time of day for each beat: dawn, morning, noon, dusk, Eid night. */
const SKY = [
  { top: "#9cc8df", horizon: "#f7d6c8", sun: "#ffd7bf", light: "#ffe2cf", li: 2.1, hemi: 1.1, sunPos: [60, 14, 30] },
  { top: "#7ab9e4", horizon: "#d7ecef", sun: "#fff3e3", light: "#fff4e6", li: 2.6, hemi: 1.25, sunPos: [45, 45, 30] },
  { top: "#5aa8de", horizon: "#d6eef2", sun: "#ffffff", light: "#ffffff", li: 2.9, hemi: 1.35, sunPos: [10, 70, 25] },
  { top: "#36507f", horizon: "#f2a487", sun: "#ff9f7a", light: "#ffae8a", li: 1.6, hemi: 0.8, sunPos: [-60, 9, 10] },
  { top: "#0f1d3a", horizon: "#2e4372", sun: "#9db8ff", light: "#9fb8ff", li: 0.55, hemi: 0.45, sunPos: [-40, 40, -60] },
] as const;

/* Camera stops: [position, look-at] for each beat. */
const STOPS: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(38, 23, 43), new THREE.Vector3(0, 0, -3)],
  [new THREE.Vector3(-3.2, 6.8, 5.8), new THREE.Vector3(-7.4, 1.4, -5)],
  [new THREE.Vector3(8.8, 4.3, 8.4), new THREE.Vector3(3.4, 1.4, 1.6)],
  [new THREE.Vector3(12.5, 4.6, 3.8), new THREE.Vector3(9.4, 1.5, -7)],
  [new THREE.Vector3(-4, 13, 40), new THREE.Vector3(-6, 6, -20)],
];

const ease = (t: number) => t * t * (3 - 2 * t);
const hashish = (i: number) => {
  const v = Math.sin(i * 91.7) * 4375.85;
  return v - Math.floor(v);
};

export function FarmScene({ trackId, dairy, family, bulls, heroTags, onReady, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const tagLayer = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const allTags = [...heroTags, ...dairy, ...bulls, ...(family ? [family.dam, family.calf, family.sire] : [])];

  useEffect(() => {
    const el = host.current;
    const layer = tagLayer.current;
    if (!el || !layer) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: "high-performance" });
    } catch {
      onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !small;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#e9eee7", 45, 170);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);
    const mat = makeMaterial();

    /* World */
    const sky = makeSky();
    scene.add(sky.mesh);
    const stars = makeStars(small ? 300 : 700);
    scene.add(stars);
    const moon = makeMoon();
    moon.position.set(-45, 48, -260);
    scene.add(moon);
    scene.add(makeTerrain(mat));
    const water = makeWater();
    scene.add(water.mesh);
    const paddy = makePaddy(small ? 900 : 2200);
    scene.add(paddy.mesh);

    const place = (o: THREE.Object3D, x: number, z: number, ry = 0) => {
      o.position.set(x, heightAt(x, z), z);
      o.rotation.y = ry;
      scene.add(o);
      return o;
    };
    const dairyShed = place(makeShed(mat, 11, 4.4), PLACES.dairyShed.x, PLACES.dairyShed.z, Math.PI);
    place(makeShed(mat, 8.5, 4.2, "#9fb3bc"), PLACES.bullShed.x, PLACES.bullShed.z, Math.PI + 0.08);
    place(makeHouse(mat), PLACES.house.x, PLACES.house.z, 0.35);
    place(makeHaystack(mat, 1), -1.2, -9.5);
    place(makeHaystack(mat, 0.85), 1.4, -10.4);
    place(makeHaystack(mat, 0.75), 14.8, -9.5);
    for (const [x, z, h, l] of [
      [-18, -4, 7, 0.1],
      [-16.5, -15, 6.2, -0.08],
      [-11, -14.5, 7.4, 0.06],
      [15.5, -12.5, 6.6, -0.12],
      [-20, 3, 6, 0.14],
      [18.5, 3, 6.8, 0.1],
    ] as const)
      place(makePalm(mat, h, l), x, z, x);
    for (const [x, z, s] of [
      [-12, -18, 1.2],
      [-3, -15, 1.05],
      [5, -16, 1.25],
      [20, -6, 1],
      [-21, -9, 1.1],
    ] as const)
      place(makeTree(mat, s, x), x, z);
    for (const [x, z] of [
      [-10.5, -13.5],
      [-12.5, -6.5],
      [-17, -9],
      [4, -12],
      [12.5, -12.5],
    ] as const)
      place(makeBanana(mat), x, z, x * 0.7);
    scene.add(makeFence(mat, new THREE.Vector3(-1, 0, 0.2), new THREE.Vector3(9, 0, 0.6)));
    scene.add(makeFence(mat, new THREE.Vector3(9, 0, 0.6), new THREE.Vector3(10.5, 0, 9)));
    const boat = makeBoat(mat);
    boat.position.set(23, 0, -17);
    boat.rotation.y = 0.4;
    scene.add(boat);

    /* Herd */
    const animals: { a: Animal; wander?: { cx: number; cz: number; r: number; ang: number; w: number } }[] = [];
    const tagAnchors = new Map<string, THREE.Object3D>();
    const coats: CoatKind[] = ["hf", "hf", "red", "hf", "grey", "hf", "white"];
    // Milking line in the dairy shed, heads to the trough.
    for (let i = 0; i < 6; i++) {
      const a = makeAnimal(mat, coats[i]!, { udder: true, hump: coats[i] === "red" || coats[i] === "grey" });
      const x = dairyShed.position.x - 4.2 + i * 1.65;
      a.root.position.set(x, dairyShed.position.y + 0.2, dairyShed.position.z + 0.15);
      a.root.rotation.y = -Math.PI / 2;
      // Stagger tag heights so neighbours' tags don't sit on top of each other.
      a.tag.position.y += (i % 2) * 0.62;
      scene.add(a.root);
      animals.push({ a });
      if (dairy[i]) tagAnchors.set(dairy[i]!.id, a.tag);
    }
    // Fattening bulls, big and mostly zebu.
    const bullCoats: CoatKind[] = ["black", "white", "red", "grey", "black"];
    for (let i = 0; i < 5; i++) {
      const a = makeAnimal(mat, bullCoats[i]!, { bull: true, hump: true, scale: 1.08 });
      a.root.position.set(PLACES.bullShed.x - 3.3 + i * 1.65, heightAt(PLACES.bullShed.x, PLACES.bullShed.z) + 0.2, PLACES.bullShed.z + 0.2 + i * 0.13);
      a.root.rotation.y = -Math.PI / 2 + 0.08;
      a.tag.position.y += (i % 2) * 0.62;
      scene.add(a.root);
      animals.push({ a });
      if (bulls[i]) tagAnchors.set(bulls[i]!.id, a.tag);
    }
    // Mother and calf in the pasture.
    const dam = makeAnimal(mat, "hf", { udder: true });
    const calf = makeAnimal(mat, "hf", { scale: 0.55, horns: false });
    place(dam.root, PLACES.family.x, PLACES.family.z, -0.4);
    place(calf.root, PLACES.family.x + 1.15, PLACES.family.z - 1.25, 2.2);
    animals.push({ a: dam }, { a: calf });
    const sireAnchor = new THREE.Object3D();
    sireAnchor.position.set(PLACES.family.x + 2.9, heightAt(PLACES.family.x, PLACES.family.z) + 3.1, PLACES.family.z - 2.6);
    scene.add(sireAnchor);
    if (family) {
      tagAnchors.set(family.dam.id, dam.tag);
      tagAnchors.set(family.calf.id, calf.tag);
      tagAnchors.set(family.sire.id, sireAnchor);
    }
    // Grazing herd that wanders in slow circles.
    const grazers = small ? 6 : 11;
    const grazeCoats: CoatKind[] = ["hf", "red", "white", "grey", "fawn", "hf", "black", "red", "hf", "white", "fawn"];
    for (let i = 0; i < grazers; i++) {
      const a = makeAnimal(mat, grazeCoats[i]!, { udder: i % 3 !== 2, hump: grazeCoats[i] !== "hf" });
      const cx = PLACES.pasture.x - 3.6 + (i % 4) * 2.4 + (hashish(i) - 0.5) * 1.2;
      const cz = PLACES.pasture.z - 2 + Math.floor(i / 4) * 3 + (hashish(i + 7) - 0.5) * 1.2;
      const wander = { cx, cz, r: 0.8 + (i % 3) * 0.5, ang: i * 1.3, w: (i % 2 ? 1 : -1) * (0.02 + (i % 4) * 0.008) };
      a.root.position.set(cx, heightAt(cx, cz), cz);
      scene.add(a.root);
      animals.push({ a, wander });
    }
    // The first hero tags sit on animals visible from the wide shot.
    const heroAnchors = [animals[2]!.a.tag, animals[8]!.a.tag, calf.tag];
    heroTags.forEach((t, i) => heroAnchors[i] && tagAnchors.set(t.id, heroAnchors[i]!));

    /* Pedigree threads: dam → calf, sire straw → calf. */
    const threadMat = new THREE.MeshBasicMaterial({ color: "#c8ffd9", transparent: true, opacity: 0.95, fog: false });
    const threads: THREE.Mesh[] = [];
    const makeThread = (from: THREE.Object3D, to: THREE.Object3D) => {
      scene.updateMatrixWorld(true);
      const a = from.getWorldPosition(new THREE.Vector3());
      const b = to.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.35, 0));
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.4, 0));
      const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 48, 0.035, 6, false);
      g.setDrawRange(0, 0);
      const m = new THREE.Mesh(g, threadMat);
      scene.add(m);
      threads.push(m);
    };
    makeThread(dam.tag, calf.tag);
    makeThread(sireAnchor, calf.tag);

    /* Lights */
    const hemi = new THREE.HemisphereLight("#dff1ff", "#5b7f4f", 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#ffe2cf", 2.1);
    sun.castShadow = !small;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 200;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    /* Scroll → progress through the five beats */
    const track = document.getElementById(trackId);
    let target = 0;
    let cur = 0;
    const readScroll = () => {
      if (!track) return;
      const r = track.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };
    readScroll();
    cur = target;
    const mouse = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };

    /* Sizing; on wide screens the scene shifts right so the copy on the left stays clear. */
    let w = 1;
    let h = 1;
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (w >= 1024) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    resize();

    /* Tag elements */
    const tagEls = new Map<string, HTMLElement>();
    layer.querySelectorAll<HTMLElement>("[data-tag]").forEach((n) => tagEls.set(n.dataset.tag!, n));
    const beatsOf = new Map(allTags.map((t) => [t.id, t.beats]));

    const tmp = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const sunNext = new THREE.Vector3();
    const cFog = new THREE.Color();
    const cA = new THREE.Color();
    const cB = new THREE.Color();
    const lerpColor = (a: string, b: string, t: number) => cA.set(a).lerp(cB.set(b), t);

    let running = true;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let first = true;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!running || !visible) return;
      if (!reduce) elapsed += dt;
      cur += (target - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 3.5));
      const seg = cur * 4;
      const i0 = Math.min(3, Math.floor(seg));
      const k = ease(seg - i0);
      const beat = Math.round(seg);

      // Camera along the stops, with a little drift and pointer parallax.
      const [p0, l0] = STOPS[i0]!;
      const [p1, l1] = STOPS[i0 + 1]!;
      camPos.copy(p0).lerp(p1, k);
      camLook.copy(l0).lerp(l1, k);
      // Lift the camera in mid-transition so moves between stops arc over the island.
      camPos.y += Math.sin(k * Math.PI) * 4;
      if (!reduce) {
        camPos.x += mouse.x * 0.9 + Math.sin(elapsed * 0.15) * 0.4;
        camPos.y += -mouse.y * 0.5;
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      // Time of day.
      const s0 = SKY[i0]!;
      const s1 = SKY[i0 + 1]!;
      sky.uniforms.uTop.value.copy(lerpColor(s0.top, s1.top, k));
      sky.uniforms.uHorizon.value.copy(lerpColor(s0.horizon, s1.horizon, k));
      sky.uniforms.uSunColor.value.copy(lerpColor(s0.sun, s1.sun, k));
      const sp = tmp.fromArray(s0.sunPos).lerp(sunNext.fromArray(s1.sunPos), k);
      sun.position.copy(sp);
      sky.uniforms.uSunDir.value.copy(sp).normalize();
      sun.color.copy(lerpColor(s0.light, s1.light, k));
      sun.intensity = s0.li + (s1.li - s0.li) * k;
      hemi.intensity = s0.hemi + (s1.hemi - s0.hemi) * k;
      const fog = cFog.copy(sky.uniforms.uHorizon.value);
      (scene.fog as THREE.Fog).color.copy(fog);
      water.uniforms.uFogColor.value.copy(fog);
      water.uniforms.uSky.value.copy(sky.uniforms.uHorizon.value);
      water.uniforms.uSunDir.value.copy(sky.uniforms.uSunDir.value);
      water.uniforms.uSunColor.value.copy(sun.color).multiplyScalar(sun.intensity / 2.6);
      water.uniforms.uTime.value = elapsed;
      water.uniforms.uLight.value = Math.min(1, Math.max(0, (hemi.intensity - 0.45) / 0.65));
      paddy.time.value = elapsed;
      const night = Math.max(0, Math.min(1, (seg - 3) * 1.25));
      (moon.material as THREE.SpriteMaterial).opacity = night;
      (stars.material as THREE.PointsMaterial).opacity = night * 0.9;
      renderer.toneMappingExposure = 1 - night * 0.15;

      // Threads draw themselves in during the breeding beat.
      const kin = Math.max(0, 1 - Math.abs(seg - 2) * 1.6);
      for (const t of threads) {
        const g = t.geometry as THREE.TubeGeometry;
        g.setDrawRange(0, Math.floor((g.index ? g.index.count : g.attributes.position!.count) * Math.min(1, kin * 1.4)));
      }

      // The herd.
      for (const { a, wander } of animals) {
        if (!reduce) grazePose(a, elapsed, Boolean(wander) || a === dam || a === calf);
        if (wander && !reduce) {
          wander.ang += wander.w * dt * 6;
          const x = wander.cx + Math.cos(wander.ang) * wander.r;
          const z = wander.cz + Math.sin(wander.ang) * wander.r;
          // Stay on dry land.
          if (heightAt(x, z) < 0.3) {
            wander.w = -wander.w;
            continue;
          }
          a.root.position.set(x, heightAt(x, z), z);
          const dir = Math.sign(wander.w);
          a.root.rotation.y = -Math.atan2(Math.cos(wander.ang) * dir, -Math.sin(wander.ang) * dir);
        }
      }
      boat.position.y = Math.sin(elapsed * 1.1) * 0.06;
      boat.rotation.z = Math.sin(elapsed * 0.8) * 0.025;
      boat.position.x = 23 + Math.sin(elapsed * 0.05) * 2.5;

      renderer.render(scene, camera);

      // Ear tags follow their animals on screen.
      for (const [id, node] of tagEls) {
        const anchor = tagAnchors.get(id);
        const on = anchor && beatsOf.get(id)?.includes(beat);
        if (!anchor || !on) {
          node.dataset.on = "false";
          continue;
        }
        anchor.getWorldPosition(tmp);
        tmp.project(camera);
        const behind = tmp.z > 1;
        const x = (tmp.x * 0.5 + 0.5) * w;
        const y = (-tmp.y * 0.5 + 0.5) * h;
        const inside = !behind && x > 8 && x < w - 8 && y > 40 && y < h - 8;
        node.dataset.on = inside && Math.abs(seg - beat) < 0.38 ? "true" : "false";
        node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        node.dataset.flip = x > w - 250 ? "true" : "false";
      }

      if (first) {
        first = false;
        setReady(true);
        onReady?.();
      }
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([e]) => (visible = Boolean(e?.isIntersecting)), { rootMargin: "100px" });
    io.observe(el);
    const onVis = () => (running = document.visibilityState === "visible");
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // The scene is built once; tag text updates flow through the DOM, not a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={host} className={`absolute inset-0 transition-opacity duration-1000 [&>canvas]:block [&>canvas]:size-full ${ready ? "opacity-100" : "opacity-0"}`} />
      <div ref={tagLayer} className="pointer-events-none absolute inset-0 overflow-hidden">
        {allTags.map((t) => (
          <div key={t.id} data-tag={t.id} data-on="false" className="ear-tag absolute top-0 left-0 will-change-transform">
            <div className="ear-tag-card" data-tone={t.tone ?? "milk"}>
              <span className="ear-tag-id">{t.title}</span>
              <span className="ear-tag-line">{t.line}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
