import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * A char on the Jamuna near Shahjadpur, built from primitives: no model files to download.
 * Everything shares one flat-shaded, vertex-coloured material, so the whole island is a few
 * dozen draw calls. Units are metres; +x is east, +z is south (toward the camera), +y is up.
 */

/* ───────────────────────── Noise and terrain height ───────────────────────── */

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, z: number) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Raised homestead (bhita) where the sheds stand, and the fattening yard. */
export const PLACES = {
  dairyShed: new THREE.Vector3(-7, 0, -5),
  bullShed: new THREE.Vector3(9.5, 0, -7.5),
  family: new THREE.Vector3(2.5, 0, 3),
  house: new THREE.Vector3(-14.5, 0, -10),
  pasture: new THREE.Vector3(-13.5, 0, 3),
} as const;

const plateaus = [
  { c: PLACES.dairyShed, r: 8.5, h: 1.15 },
  { c: PLACES.bullShed, r: 6.5, h: 1.1 },
  { c: PLACES.house, r: 6, h: 1.25 },
];

/** Ground height at (x, z). Below 0 is river. */
export function heightAt(x: number, z: number) {
  const d = Math.hypot(x * 0.95, (z + 1) * 1.3) / 27;
  const n = fbm(x * 0.07 + 3.1, z * 0.07 - 1.7);
  const island = 1 - smooth(0.72, 1.02, d + (n - 0.5) * 0.35);
  let y = island * (0.62 + fbm(x * 0.18, z * 0.18) * 0.35) - (1 - island) * 1.6;
  for (const p of plateaus) {
    const k = 1 - smooth(p.r * 0.65, p.r, Math.hypot(x - p.c.x, z - p.c.z));
    y = y * (1 - k) + p.h * k;
  }
  return y;
}

/** Paddy fields: a patchwork of plots in the south-east, kept off the homesteads. */
export function isPaddy(x: number, z: number) {
  if (heightAt(x, z) < 0.35) return false;
  for (const p of plateaus) if (Math.hypot(x - p.c.x, z - p.c.z) < p.r + 1.5) return false;
  if (Math.hypot(x - PLACES.family.x, z - PLACES.family.z) < 8.5) return false;
  return x > -6 && z > 6 && x < 22;
}

/* ───────────────────────── Geometry helpers ───────────────────────── */

type Part = { g: THREE.BufferGeometry; color: THREE.ColorRepresentation | ((x: number, y: number, z: number) => THREE.Color) };

function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = geo.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Like paint, but the colour is worked out per vertex (for coat patches). */
function paintFn(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color) {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  // One colour per triangle (from its centre) keeps patches crisp under flat shading.
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const c = fn(cx, cy, cz);
    for (let k = 0; k < 3; k++) arr.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Transform helper: position, rotation (radians), scale. */
function at(g: THREE.BufferGeometry, p: [number, number, number], r: [number, number, number] = [0, 0, 0], s: [number, number, number] = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  return g.applyMatrix4(m);
}

function merge(parts: Part[]) {
  const geo = mergeGeometries(
    parts.map((p) => (typeof p.color === "function" ? paintFn(p.g, p.color) : paint(p.g, p.color))),
    false,
  )!;
  geo.computeVertexNormals();
  return geo;
}

export function makeMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadows = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  return m;
}

/* ───────────────────────── Terrain ───────────────────────── */

const GROUND = {
  silt: new THREE.Color("#dfe4d6"),
  wetSilt: new THREE.Color("#c3d0c4"),
  grass: new THREE.Color("#5fae55"),
  grassDark: new THREE.Color("#3f8f46"),
  bhita: new THREE.Color("#79b35d"),
  yard: new THREE.Color("#b9c6ab"),
  paddy: [new THREE.Color("#9ad46f"), new THREE.Color("#6cc062"), new THREE.Color("#4fa957"), new THREE.Color("#b5dd7c")],
  riverbed: new THREE.Color("#7fa69b"),
};

export function makeTerrain(mat: THREE.Material) {
  const size = 84;
  const seg = 110;
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).toNonIndexed();
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  // One colour per triangle, from its centre: crisp low-poly patches.
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const n = fbm(x * 0.3, z * 0.3);
    if (y < -0.15) c.copy(GROUND.riverbed);
    else if (y < 0.12) c.copy(GROUND.wetSilt);
    else if (y < 0.34) c.copy(GROUND.silt);
    else if (isPaddy(x, z)) c.copy(GROUND.paddy[(Math.floor(x / 4.2) + Math.floor(z / 3.1) * 3) & 3]!);
    else if (plateaus.some((p) => Math.hypot(x - p.c.x, z - p.c.z) < p.r * 0.62)) c.copy(GROUND.yard).lerp(GROUND.bhita, n * 0.8);
    else c.copy(GROUND.grass).lerp(GROUND.grassDark, n);
    c.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.035);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

/* ───────────────────────── Water ───────────────────────── */

export function makeWater() {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color("#2f7f86") },
    uShallow: { value: new THREE.Color("#7fc2bb") },
    uSky: { value: new THREE.Color("#cfe6ee") },
    uSunDir: { value: new THREE.Vector3(1, 0.3, 0.2).normalize() },
    uSunColor: { value: new THREE.Color("#ffffff") },
    uFogColor: { value: new THREE.Color("#dfeee9") },
    uFogNear: { value: 40 },
    uFogFar: { value: 160 },
    uLight: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.y += sin(w.x * 0.35 + uTime * 0.9) * 0.025 + cos(w.z * 0.42 - uTime * 0.7) * 0.025;
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uSky, uSunColor, uFogColor;
      uniform vec3 uSunDir;
      uniform float uFogNear, uFogFar, uLight;
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        // Ripples: a few drifting sine fields perturb the normal.
        float t = uTime;
        vec2 p = vWorld.xz;
        float dx = cos(p.x * 1.3 + t * 1.1) * 0.06 + cos((p.x + p.y) * 2.1 - t * 1.7) * 0.04;
        float dz = sin(p.y * 1.6 - t * 0.9) * 0.06 + sin((p.x - p.y) * 2.4 + t * 1.3) * 0.04;
        vec3 n = normalize(vec3(dx, 1.0, dz));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float shore = smoothstep(18.0, 46.0, length(p * vec2(0.95, 1.3)));
        vec3 col = mix(uShallow, uDeep, shore) * mix(0.28, 1.0, uLight);
        col = mix(col, uSky, fres * 0.65);
        vec3 h = normalize(uSunDir + v);
        float spec = pow(max(dot(n, h), 0.0), 220.0) * 1.6;
        col += uSunColor * spec;
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 60, 60).rotateX(-Math.PI / 2), mat);
  m.position.y = 0.02;
  return { mesh: m, uniforms };
}

/* ───────────────────────── Sky, stars, moon ───────────────────────── */

export function makeSky() {
  const uniforms = {
    uTop: { value: new THREE.Color("#8fc3e0") },
    uHorizon: { value: new THREE.Color("#f5d3c4") },
    uSunDir: { value: new THREE.Vector3(1, 0.2, 0.2).normalize() },
    uSunColor: { value: new THREE.Color("#ffe1c9") },
    uSunSize: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunColor, uSunDir;
      uniform float uSunSize;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
        col = mix(col, uHorizon * 0.92, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * (pow(s, 900.0 / uSunSize) * 1.2 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 40, 20), mat);
  sky.frustumCulled = false;
  return { mesh: sky, uniforms };
}

export function makeStars(count = 600) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = hash(i, 1.7);
    const v = hash(i, 9.3);
    const theta = u * Math.PI * 2;
    const y = 0.08 + v * 0.92;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(theta) * r * 380, y * 380, Math.sin(theta) * r * 380], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: "#e9f1ff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  return new THREE.Points(g, mat);
}

/** The Eid crescent, drawn once onto a canvas. */
export function makeMoon() {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  // Crescent on its own canvas first, so cutting the bite doesn't also cut the glow.
  const cres = document.createElement("canvas");
  cres.width = cres.height = s;
  const cc = cres.getContext("2d")!;
  cc.beginPath();
  cc.arc(s / 2, s / 2, s * 0.2, 0, Math.PI * 2);
  cc.fillStyle = "#f4f7ff";
  cc.fill();
  cc.globalCompositeOperation = "destination-out";
  cc.beginPath();
  cc.arc(s / 2 + s * 0.085, s / 2 - s * 0.05, s * 0.185, 0, Math.PI * 2);
  cc.fill();
  const glow = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
  glow.addColorStop(0, "rgba(210,228,255,0.22)");
  glow.addColorStop(1, "rgba(210,228,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.drawImage(cres, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const moon = new THREE.Sprite(mat);
  moon.scale.setScalar(46);
  return moon;
}

/* ───────────────────────── Buildings and props ───────────────────────── */

/** Goal-ghor: an open-sided cattle shed under a corrugated tin roof, with a feed trough. */
export function makeShed(mat: THREE.Material, w: number, d: number, roof = "#a9bcc0") {
  const parts: Part[] = [];
  const eave = 2.5;
  parts.push({ g: at(new THREE.BoxGeometry(w + 0.6, 0.2, d + 0.6), [0, 0.1, 0]), color: "#cfd7d0" });
  const postsX = Math.max(2, Math.round(w / 2.4));
  for (let i = 0; i <= postsX; i++) {
    const x = -w / 2 + (w * i) / postsX;
    for (const z of [-d / 2, d / 2]) parts.push({ g: at(new THREE.BoxGeometry(0.16, eave, 0.16), [x, eave / 2 + 0.2, z]), color: "#6f7f78" });
  }
  // Two roof slopes, built from strips so the corrugation reads at a distance.
  const strips = Math.round(w / 0.45);
  const slope = Math.atan2(0.75, d / 2);
  const len = Math.hypot(d / 2 + 0.5, 0.75);
  for (const side of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const x = -w / 2 - 0.3 + ((w + 0.6) * (i + 0.5)) / strips;
      parts.push({
        g: at(new THREE.BoxGeometry((w + 0.6) / strips, 0.06, len), [x, eave + 0.2 + 0.38, (side * (d / 2 + 0.5)) / 2], [side * -slope, 0, 0]),
        color: i % 2 ? roof : new THREE.Color(roof).offsetHSL(0, 0, -0.06),
      });
    }
  }
  parts.push({ g: at(new THREE.BoxGeometry(w - 0.4, 0.35, 0.5), [0, 0.38, -d / 2 + 0.55]), color: "#8ea69c" });
  return mesh(merge(parts), mat);
}

/** A small tin house on the homestead, walls painted the usual sea-green. */
export function makeHouse(mat: THREE.Material) {
  const parts: Part[] = [
    { g: at(new THREE.BoxGeometry(5, 0.3, 4), [0, 0.15, 0]), color: "#cfd5c8" },
    { g: at(new THREE.BoxGeometry(4.4, 2.2, 3.4), [0, 1.4, 0]), color: "#6fb3a2" },
    { g: at(new THREE.BoxGeometry(0.9, 1.6, 0.1), [0.6, 1.1, 1.72]), color: "#2f5d55" },
    { g: at(new THREE.BoxGeometry(0.7, 0.6, 0.1), [-1.3, 1.6, 1.72]), color: "#e8efe9" },
  ];
  for (const side of [-1, 1])
    parts.push({ g: at(new THREE.BoxGeometry(5, 0.08, 2.4), [0, 2.95, side * 0.95], [side * -0.62, 0, 0]), color: side > 0 ? "#9fb2b6" : "#8ea2a7" });
  return mesh(merge(parts), mat);
}

/** Rice-straw stack around a bamboo pole, the kind every cattle farm keeps. */
export function makeHaystack(mat: THREE.Material, s = 1) {
  const straw = "#cdbf8e";
  return mesh(
    merge([
      { g: at(new THREE.CylinderGeometry(1.05 * s, 1.25 * s, 1.6 * s, 9), [0, 0.8 * s, 0]), color: straw },
      { g: at(new THREE.ConeGeometry(1.15 * s, 1.5 * s, 9), [0, 2.35 * s, 0]), color: new THREE.Color(straw).offsetHSL(0, 0, 0.04) },
      { g: at(new THREE.CylinderGeometry(0.05, 0.05, 1.2 * s, 5), [0, 3.4 * s, 0]), color: "#6c6a55" },
    ]),
    mat,
  );
}

export function makePalm(mat: THREE.Material, h = 6, lean = 0.12) {
  const parts: Part[] = [];
  const segs = 6;
  let x = 0;
  for (let i = 0; i < segs; i++) {
    const y = (h * (i + 0.5)) / segs;
    x += lean * (i / segs);
    parts.push({ g: at(new THREE.CylinderGeometry(0.14 - i * 0.008, 0.17 - i * 0.008, h / segs + 0.02, 6), [x, y, 0], [0, 0, -lean]), color: "#7d8a78" });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({
      g: at(new THREE.ConeGeometry(0.3, 2.6, 4), [x + Math.cos(a) * 1.0, h - 0.15, Math.sin(a) * 1.0], [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25], [1, 1, 0.25]),
      color: i % 2 ? "#2f8f52" : "#3fa35c",
    });
  }
  return mesh(merge(parts), mat);
}

export function makeBanana(mat: THREE.Material) {
  const parts: Part[] = [{ g: at(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 6), [0, 0.8, 0]), color: "#7aa35a" }];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    parts.push({
      g: at(new THREE.BoxGeometry(0.5, 0.03, 1.8), [Math.cos(a) * 0.7, 1.75, Math.sin(a) * 0.7], [0.5, -a + Math.PI / 2, 0]),
      color: i % 2 ? "#4cb05a" : "#5cc26a",
    });
  }
  return mesh(merge(parts), mat);
}

/** Mango or jackfruit: a dark, rounded canopy. */
export function makeTree(mat: THREE.Material, s = 1, seed = 1) {
  const parts: Part[] = [{ g: at(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 2 * s, 6), [0, s, 0]), color: "#6b7564" }];
  for (let i = 0; i < 4; i++) {
    const a = seed * 2.1 + i * 1.7;
    parts.push({
      g: at(new THREE.IcosahedronGeometry((1.15 - i * 0.12) * s, 0), [Math.cos(a) * 0.6 * s, (2.5 + (i % 2) * 0.5) * s, Math.sin(a) * 0.6 * s]),
      color: ["#2e7d43", "#357f3f", "#2a6f3d", "#3b8a45"][i]!,
    });
  }
  return mesh(merge(parts), mat);
}

/** A country boat with a bamboo cabin, the kind that crosses to the char. */
export function makeBoat(base: THREE.MeshStandardMaterial) {
  // The hull is an open shell, so both faces must render.
  const mat = base.clone();
  mat.side = THREE.DoubleSide;
  const hull = new THREE.CylinderGeometry(0.75, 0.75, 6, 10, 1, true, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2);
  return mesh(
    merge([
      { g: at(hull, [0, 0.55, 0], [0, 0, 0], [1, 1, 0.75]), color: "#35495c" },
      { g: at(new THREE.ConeGeometry(0.56, 1.4, 8, 1, true), [3.6, 0.55, 0], [0, 0, -Math.PI / 2], [1, 1, 1]), color: "#35495c" },
      { g: at(new THREE.ConeGeometry(0.56, 1.4, 8, 1, true), [-3.6, 0.55, 0], [0, 0, Math.PI / 2], [1, 1, 1]), color: "#35495c" },
      { g: at(new THREE.BoxGeometry(6.4, 0.08, 0.1), [0, 0.95, 0.56]), color: "#c94a3d" },
      { g: at(new THREE.BoxGeometry(6.4, 0.08, 0.1), [0, 0.95, -0.56]), color: "#c94a3d" },
      { g: at(new THREE.CylinderGeometry(0.7, 0.7, 2, 9, 1, true, 0, Math.PI), [-0.4, 0.95, 0], [0, 0, Math.PI / 2]), color: "#9fa784" },
    ]),
    mat,
  );
}

export function makeFence(mat: THREE.Material, from: THREE.Vector3, to: THREE.Vector3) {
  const parts: Part[] = [];
  const n = Math.max(2, Math.round(from.distanceTo(to) / 1.1));
  for (let i = 0; i <= n; i++) {
    const p = from.clone().lerp(to, i / n);
    parts.push({ g: at(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), [p.x, heightAt(p.x, p.z) + 0.55, p.z]), color: "#a59f7c" });
  }
  for (const y of [0.45, 0.85]) {
    const mid = from.clone().lerp(to, 0.5);
    const len = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(0.035, 0.035, len, 4).rotateZ(Math.PI / 2);
    const ang = Math.atan2(to.z - from.z, to.x - from.x);
    parts.push({ g: at(g, [mid.x, heightAt(mid.x, mid.z) + y, mid.z], [0, -ang, 0]), color: "#b3ac87" });
  }
  return mesh(merge(parts), mat);
}

/* ───────────────────────── Paddy ───────────────────────── */

/** Rice hills planted in rows, one instanced mesh; a few lines of shader make them sway. */
export function makePaddy(max: number) {
  const blades = [0, 1, 2, 3].map((i) =>
    new THREE.ConeGeometry(0.035, 0.5, 3).translate(0, 0.25, 0).rotateZ(0.22).rotateY((i / 4) * Math.PI * 2),
  );
  const g = mergeGeometries(blades.map((b) => b.toNonIndexed()))!;
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
  const time = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
         float sway = sin(uTime * 1.5 + ip.x * 0.5 + ip.z * 0.35) * 0.25 * position.y * position.y;
         transformed.x += sway; transformed.z += sway * 0.4;`,
      );
  };
  const inst = new THREE.InstancedMesh(g, mat, max);
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const shades = ["#7cc864", "#68bd5c", "#8fd36d", "#5cb457"];
  let placed = 0;
  // Rows 0.5 m apart, hills 0.42 m apart along the row, with a bare ail (bund) between plots.
  for (let z = 6; z < 22 && placed < max; z += 0.5) {
    for (let x = -6; x < 22 && placed < max; x += 0.42) {
      const fx = (((x / 4.2) % 1) + 1) % 1;
      const fz = (((z / 3.1) % 1) + 1) % 1;
      if (fx < 0.09 || fz < 0.12) continue;
      const jx = x + (hash(x, z) - 0.5) * 0.08;
      const jz = z + (hash(z, x) - 0.5) * 0.08;
      if (!isPaddy(jx, jz)) continue;
      const plot = (Math.floor(x / 4.2) + Math.floor(z / 3.1) * 3) & 3;
      const sc = 0.8 + hash(jx * 3, jz) * 0.35 + plot * 0.06;
      m.compose(new THREE.Vector3(jx, heightAt(jx, jz) - 0.02, jz), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(jx, jz) * 6), new THREE.Vector3(sc, sc, sc));
      inst.setMatrixAt(placed, m);
      inst.setColorAt(placed, c.set(shades[plot]!).offsetHSL(0, 0, (hash(jz, jx) - 0.5) * 0.06));
      placed++;
    }
  }
  inst.count = placed;
  return { mesh: inst, time };
}

/* ───────────────────────── Cattle ───────────────────────── */

export type CoatKind = "hf" | "red" | "grey" | "white" | "black" | "fawn";
const COATS: Record<CoatKind, { base: string; spot?: string; face: string; muzzle: string }> = {
  hf: { base: "#f2f1ec", spot: "#1d2122", face: "#f2f1ec", muzzle: "#e3b6ae" },
  red: { base: "#a24f33", face: "#b25e40", muzzle: "#3a2a26" },
  grey: { base: "#c3c6be", spot: "#9a9f97", face: "#d8dad2", muzzle: "#3c3f3c" },
  white: { base: "#efede4", face: "#f7f5ee", muzzle: "#5b5450" },
  black: { base: "#25292a", face: "#2f3435", muzzle: "#4a4a46" },
  fawn: { base: "#c8a27c", face: "#d9bb98", muzzle: "#3e322b" },
};

export type Animal = {
  root: THREE.Group;
  head: THREE.Group;
  /** Where the floating ear tag hangs. */
  tag: THREE.Object3D;
  phase: number;
  speed: number;
};

/** Coat colour at a point on the body: patches for Holstein crosses, soft shading for the rest. */
function coatAt(coat: CoatKind, seed: number) {
  const c = COATS[coat];
  const base = new THREE.Color(c.base);
  const spot = c.spot ? new THREE.Color(c.spot) : null;
  return (x: number, y: number, z: number) => {
    if (spot) {
      const n = fbm(x * 2.1 + seed * 13.7, z * 2.6 + y * 1.9 + seed * 3.1);
      const k = coat === "hf" ? 0.5 : 0.62;
      if (n > k) return spot.clone();
    }
    // Darker toward the belly, a touch lighter on the back.
    return base.clone().offsetHSL(0, 0, (y - 1.1) * 0.08 + (hash(x * 9, z * 9) - 0.5) * 0.02);
  };
}

/**
 * One animal: body, legs and tail in one mesh; neck and head in another on a shoulder pivot,
 * so it can drop its head to graze. Zebu types (local, Sahiwal, Red Chittagong, grey) get a
 * hump and dewlap; cows an udder; bulls more bulk and a heavier hump.
 */
export function makeAnimal(mat: THREE.Material, coat: CoatKind, opts: { scale?: number; hump?: boolean; udder?: boolean; horns?: boolean; bull?: boolean } = {}): Animal {
  const c = COATS[coat];
  const seed = Math.random() * 10;
  const fur = coatAt(coat, seed);
  const s = opts.scale ?? 1;
  const bull = opts.bull ?? false;
  const girth = bull ? 1.12 : 1;

  const body: Part[] = [
    { g: at(new THREE.CapsuleGeometry(0.36, 0.95, 3, 9).rotateZ(Math.PI / 2), [0, 1.13, 0], [0, 0, 0.04], [1, 1.1 * girth, 0.92 * girth]), color: fur },
  ];
  for (const [x, z] of [
    [0.5, 0.2],
    [0.5, -0.2],
    [-0.52, 0.19],
    [-0.52, -0.19],
  ] as const) {
    body.push({ g: at(new THREE.CylinderGeometry(0.09, 0.065, 0.9, 6), [x, 0.5, z]), color: fur });
    body.push({ g: at(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 6), [x, 0.045, z]), color: "#2f2d2a" });
  }
  body.push({ g: at(new THREE.CylinderGeometry(0.025, 0.02, 0.78, 4), [-0.86, 0.88, 0], [0, 0, 0.12]), color: fur });
  body.push({ g: at(new THREE.ConeGeometry(0.06, 0.18, 5), [-0.9, 0.46, 0], [Math.PI, 0, 0]), color: "#2b2a27" });
  if (opts.hump) body.push({ g: at(new THREE.SphereGeometry(bull ? 0.27 : 0.2, 7, 5), [0.42, 1.48, 0], [0, 0, -0.2], [1.1, 0.9, 0.8]), color: fur });
  if (opts.udder) body.push({ g: at(new THREE.SphereGeometry(0.17, 7, 5), [-0.32, 0.72, 0], [0, 0, 0], [1.1, 0.75, 1]), color: "#e6aaa4" });
  const bodyMesh = mesh(merge(body), mat);

  // Head group pivots at the shoulder; +x is forward.
  const face = new THREE.Color(c.face);
  const headParts: Part[] = [
    { g: at(new THREE.CylinderGeometry(0.19 * girth, 0.27 * girth, 0.62, 7).rotateZ(-Math.PI / 2), [0.28, 0.08, 0], [0, 0, 0.32]), color: fur },
    { g: at(new THREE.CylinderGeometry(0.12, 0.19, 0.5, 6).rotateZ(-Math.PI / 2), [0.7, 0.06, 0], [0, 0, -0.75]), color: (x, y, z) => fur(x, y, z).lerp(face, 0.5) },
    { g: at(new THREE.SphereGeometry(0.14, 6, 4), [0.86, -0.13, 0], [0, 0, 0], [1, 0.85, 1.05]), color: c.muzzle },
    { g: at(new THREE.ConeGeometry(0.07, 0.26, 5), [0.55, 0.22, 0.2], [Math.PI / 2 - 0.25, 0, 0], [1, 1, 0.55]), color: fur },
    { g: at(new THREE.ConeGeometry(0.07, 0.26, 5), [0.55, 0.22, -0.2], [-Math.PI / 2 + 0.25, 0, 0], [1, 1, 0.55]), color: fur },
  ];
  if (opts.hump) headParts.push({ g: at(new THREE.BoxGeometry(0.4, 0.3, 0.06), [0.32, -0.2, 0], [0, 0, 0.35]), color: fur });
  if (opts.horns ?? true) {
    for (const side of [1, -1])
      headParts.push({ g: at(new THREE.ConeGeometry(0.035, bull ? 0.3 : 0.22, 5), [0.6, 0.34, side * 0.1], [side * 0.55, 0, -0.35]), color: "#e8e1cc" });
  }
  const head = new THREE.Group();
  head.position.set(0.5, 1.3, 0);
  head.add(mesh(merge(headParts), mat));

  const root = new THREE.Group();
  root.add(bodyMesh, head);
  root.scale.setScalar(s * (bull ? 1.1 : 1));
  const tag = new THREE.Object3D();
  tag.position.set(0.15, 2.05, 0);
  root.add(tag);
  return { root, head, tag, phase: Math.random() * 10, speed: 0.4 + Math.random() * 0.5 };
}

/** Head pose over time: long spells grazing with the head down, short looks up. */
export function grazePose(a: Animal, t: number, ground = true) {
  const cycle = (t * a.speed + a.phase) % 9;
  const down = ground && cycle < 6.2;
  const target = down ? -1.05 + Math.sin(t * 3 + a.phase) * 0.06 : -0.1 + Math.sin(t * 0.7 + a.phase) * 0.08;
  a.head.rotation.z += (target - a.head.rotation.z) * 0.035;
}
