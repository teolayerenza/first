// Genera todo lo visual de la cuenta de Instagram en instagram/: foto de perfil, las placas de los 6 posteos
// fundacionales (1080×1350), las historias de lanzamiento (1080×1920) y las tapas de destacadas.
//
//   npm run build && npx next start -p 3200      # en otra terminal
//   node scripts/instagram/render.mjs http://localhost:3200
//
// Las capturas del formulario salen de la app real; el mapa, de data/cuadras.json. No usa números del modo
// demo: en las placas solo van datos reales (cantidad de cuadras, zonas) y cómo funciona la app.

import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { HIGHLIGHTS, ICON_OFFSET, ICONS, PROFILE, STORIES } from "./extras.mjs";
import { POSTS } from "./posts.mjs";

const BASE = process.argv[2] ?? "http://localhost:3200";
const OUT = "instagram";
const font = readFileSync("node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2").toString("base64");

// Colores de la web (src/app/globals.css).
const FIELD = {
  asfalto: ["#141414", "#f1f1ef", "#cfcdc5"],
  hormigon: ["#ebe9e4", "#141414", "#4a4945"],
  rojo: ["#c8342f", "#ffffff", "#ffe3e1"],
  amarillo: ["#f2c200", "#141414", "#3a3320"],
  verde: ["#0b6e3a", "#ffffff", "#d6f0e0"],
};

/** Mapa del casco con todas las cuadras, en gris de "sin relevar". */
function cascoSvg() {
  const segs = JSON.parse(readFileSync("data/cuadras.json", "utf8"));
  const pts = segs.flatMap((s) => s.coords);
  const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const W = (x1 - x0) * kx;
  const H = y1 - y0;
  const size = 820;
  const s = size / Math.max(W, H);
  const P = ([x, y]) => `${(((x - x0) * kx * s) + (size - W * s) / 2).toFixed(1)},${((y1 - y) * s + (size - H * s) / 2).toFixed(1)}`;
  const lines = segs.map((g) => `<polyline points="${g.coords.map(P).join(" ")}"/>`).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><g fill="none" stroke="#6b6a64" stroke-width="2.2" stroke-linecap="round">${lines}</g></svg>`;
}

const fontFace = `@font-face { font-family: H; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; }`;

/** Un ícono grande centrado sobre un campo de color (foto de perfil y tapas de destacadas). */
function iconHtml({ field, icon }, w, h, size) {
  const [bg, ink] = FIELD[field];
  return `<!doctype html><html><head><style>* { margin: 0 } body { width: ${w}px; height: ${h}px; background: ${bg}; color: ${ink};
    display: flex; align-items: center; justify-content: center; }</style></head>
    <body><svg viewBox="0 ${ICON_OFFSET[icon] ?? 0} 60 60" width="${size}" height="${size}" fill="currentColor">${ICONS[icon]}</svg></body></html>`;
}

function storyHtml(s) {
  const [bg, ink, ink2] = FIELD[s.field];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFace}
    * { margin: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1920px; background: ${bg}; color: ${ink}; font-family: H, sans-serif; }
    .s { height: 100%; padding: 280px 88px 420px; display: flex; flex-direction: column; justify-content: center; gap: 48px; }
    h1 { font-size: ${s.size ?? 128}px; font-weight: 600; line-height: 1; letter-spacing: -0.035em; }
    .big { font-size: 240px; font-weight: 600; line-height: .9; letter-spacing: -0.05em; }
    p { font-size: 60px; line-height: 1.25; color: ${ink2}; }
    .icon { width: 240px; height: 240px; }
    .map svg { width: 760px; height: 760px; }
  </style></head><body><div class="s">
    ${s.icon ? `<svg class="icon" viewBox="0 0 60 60" fill="currentColor">${ICONS[s.icon]}</svg>` : ""}
    ${s.big ? `<div class="big">${s.big}</div>` : ""}
    <h1>${s.title}</h1>
    ${s.text ? `<p>${s.text}</p>` : ""}
    ${s.map ? `<div class="map">${cascoSvg()}</div>` : ""}
  </div></body></html>`;
}

function slideHtml(slide, shots) {
  const [bg, ink, ink2] = FIELD[slide.field];
  const media = slide.shot ? `<img class="shot" src="data:image/png;base64,${shots[slide.shot]}"/>` : slide.map ? `<div class="map">${cascoSvg()}</div>` : "";
  const legend = slide.legend
    ? `<ul class="legend">${slide.legend.map(([c, t, d]) => `<li><span class="sw" style="background:${c}"></span><span><b>${t}</b><br>${d}</span></li>`).join("")}</ul>`
    : "";
  const head = `${slide.big ? `<div class="big">${slide.big}</div>` : ""}${slide.title ? `<h1>${slide.title}</h1>` : ""}${slide.text ? `<p>${slide.text}</p>` : ""}`;
  // Sin imagen, el texto va centrado en la altura para que no quede media placa vacía.
  const body = media || legend ? `${head}<div class="grow">${media}${legend}</div>` : `<div class="solo">${head}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFace}
    * { margin: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; background: ${bg}; color: ${ink}; font-family: H, sans-serif; }
    .slide { height: 100%; padding: 96px 88px 80px; display: flex; flex-direction: column; gap: 40px; }
    h1 { font-size: ${slide.size ?? 104}px; font-weight: 600; line-height: 1; letter-spacing: -0.035em; }
    .big { font-size: 220px; font-weight: 600; line-height: .9; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
    p { font-size: ${media || legend ? 44 : 54}px; line-height: 1.3; color: ${ink2}; max-width: 28ch; }
    .solo { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 48px; }
    p b { color: ${ink}; font-weight: 600; }
    .grow { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
    .shot { max-height: 100%; max-width: 100%; display: block; }
    .map svg { height: 640px; width: auto; }
    .legend { list-style: none; padding: 0; display: grid; gap: 30px; font-size: 38px; line-height: 1.25; }
    .legend li { display: flex; gap: 28px; align-items: flex-start; }
    .legend .sw { width: 64px; height: 64px; flex: none; }
    .legend b { font-weight: 600; }
    .foot { display: flex; justify-content: space-between; font-size: 32px; font-weight: 600; color: ${ink}; }
    .foot span:last-child { font-weight: 400; color: ${ink2}; }
  </style></head><body><div class="slide">
    ${body}
    <div class="foot"><span>Pocitos LP</span><span>${slide.foot ?? ""}</span></div>
  </div></body></html>`;
}

/** Capturas reales del formulario en un celular (modo oscuro). */
async function captureShots(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.6, colorScheme: "dark" });
  const shot = async (url, title, before) => {
    await p.goto(BASE + url, { waitUntil: "load" });
    await p.waitForTimeout(3500);
    if (before) await before();
    const el = p.locator("fieldset").filter({ hasText: title }).first();
    return (await el.screenshot()).toString("base64");
  };
  const shots = {
    donde: await shot("/reportar/pozo", "¿Dónde está?"),
    gravedad: await shot("/reportar/pozo", "¿Qué tan grave es?", () => p.getByText("Peligroso", { exact: true }).click()),
    parche: await shot("/reportar/parche", "¿Cómo quedó el parche?", () => p.getByText("Elevado", { exact: true }).click()),
    estado: await shot("/calificar", "¿Cómo está el asfalto?", () => p.getByText("Gastada", { exact: true }).click()),
  };
  await p.close();
  return shots;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--disable-gpu"] });
const shots = await captureShots(browser);
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const post of POSTS) {
  const dir = `${OUT}/posteos/${post.slug}`;
  mkdirSync(dir, { recursive: true });
  for (const [i, slide] of post.slides.entries()) {
    await page.setContent(slideHtml(slide, shots), { waitUntil: "load" });
    await page.screenshot({ path: `${dir}/${String(i + 1).padStart(2, "0")}.png` });
  }
  console.log(`${post.slug}: ${post.slides.length} placas`);
}
// Historias (1080×1920): el texto queda lejos de los bordes de arriba y de abajo, que tapa Instagram.
const story = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
mkdirSync(`${OUT}/historias/lanzamiento`, { recursive: true });
for (const [i, s] of STORIES.entries()) {
  await story.setContent(storyHtml(s), { waitUntil: "load" });
  await story.screenshot({ path: `${OUT}/historias/lanzamiento/${String(i + 1).padStart(2, "0")}.png` });
}
mkdirSync(`${OUT}/historias/destacadas`, { recursive: true });
for (const h of HIGHLIGHTS) {
  await story.setContent(iconHtml(h, 1080, 1920, 520), { waitUntil: "load" });
  await story.screenshot({ path: `${OUT}/historias/destacadas/${h.slug}.png` });
}
console.log(`historias: ${STORIES.length} de lanzamiento, ${HIGHLIGHTS.length} tapas de destacadas`);

const square = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
mkdirSync(`${OUT}/perfil`, { recursive: true });
await square.setContent(iconHtml(PROFILE, 1080, 1080, 700), { waitUntil: "load" });
await square.screenshot({ path: `${OUT}/perfil/foto-de-perfil.png` });
console.log("perfil: foto");
await browser.close();

