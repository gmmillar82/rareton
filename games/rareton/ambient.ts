/** Village life and weather: ducks, butterflies, birds, the doorstep cat, bunting and rain. Purely decorative. */
import { CAT, INK, LAMPS, POND, WELL, type Point } from "./world";

type Ctx = CanvasRenderingContext2D;

/** Filled pixel rows ("#" = pixel) at a given pixel size, with an optional ink outline. */
function pixels(ctx: Ctx, rows: readonly string[], left: number, top: number, size: number, fill: string, outline = true) {
  if (outline) {
    ctx.fillStyle = INK;
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") ctx.fillRect(left + x * size - 1, top + y * size - 1, size + 2, size + 2); }));
  }
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === ".") return;
    ctx.fillStyle = c === "#" ? fill : c === "o" ? "#e39a3b" : c === "k" ? INK : c === "w" ? "#fbf7ee" : fill;
    ctx.fillRect(left + x * size, top + y * size, size, size);
  }));
}
const mirror = (rows: readonly string[]) => rows.map(row => [...row].reverse().join(""));

// Ducks paddle slow loops on the pond by day and tuck in at night.
export const DUCKS = [0, 2.1, 4.2];
const DUCK = ["..##....", ".#k#....", ".###o...", "..###...", "#######.", "########", ".######."];
const DUCK_ASLEEP = ["........", "........", "..##....", ".####...", "#######.", "########", ".######."];
export function paintDuck(ctx: Ctx, index: number, t: number, still: boolean, asleep: boolean) {
  const angle = DUCKS[index] + (still || asleep ? 0 : t * 0.07);
  const x = Math.round(POND.x + Math.cos(angle) * POND.rx * 0.55), y = Math.round(POND.y + Math.sin(angle) * POND.ry * 0.5);
  const rows = asleep ? DUCK_ASLEEP : Math.sin(angle) > 0 ? mirror(DUCK) : DUCK;
  ctx.fillStyle = "#bcd8d4"; ctx.fillRect(x - 18, y + 16, 36, 3);
  pixels(ctx, rows, x - 16, y - 12, 4, "#fbf7ee");
}

// Butterflies drift over the meadow and garden in daylight.
const BUTTERFLY_HOMES: Point[] = [
  { x: 1480, y: 260 }, { x: 1650, y: 300 }, { x: 1560, y: 390 }, { x: 1760, y: 250 },
  { x: 1510, y: 480 }, { x: 600, y: 900 }, { x: 300, y: 560 }, { x: -600, y: 380 },
];
const BUTTERFLY_COLORS = ["#e0707a", "#f0c24a", "#8aa2de", "#fbf7ee", "#b67fc9"];
export function paintButterflies(ctx: Ctx, t: number, still: boolean, visible: (x: number, y: number) => boolean) {
  BUTTERFLY_HOMES.forEach((home, i) => {
    const x = Math.round(home.x + (still ? 0 : Math.sin(t * 0.6 + i * 1.9) * 70));
    const y = Math.round(home.y - 30 + (still ? 0 : Math.cos(t * 0.45 + i * 2.7) * 35));
    if (!visible(x, y)) return;
    const open = still || Math.floor(t * 8 + i) % 2 === 0;
    pixels(ctx, open ? ["#.#", "#k#", "#.#"] : [".#.", ".k.", ".#."], x - 6, y - 6, 4, BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]);
  });
}

// Birds hop about the paths and flutter off when you come close.
export type Bird = { home: Point; x: number; y: number; hopAt: number; flying: number; hiddenUntil: number; left: boolean };
export function createBirds(): Bird[] {
  return [{ x: 760, y: 690 }, { x: 1180, y: 700 }, { x: 960, y: 900 }, { x: 520, y: 660 }, { x: 1500, y: 690 }, { x: -200, y: 700 }]
    .map(home => ({ home, x: home.x, y: home.y, hopAt: 0, flying: 0, hiddenUntil: 0, left: false }));
}
const BIRD = [".##..", "#k##o", "####.", ".##.."];
export function updateBird(bird: Bird, player: Point, now: number, dt: number, still: boolean) {
  if (bird.hiddenUntil > now) return;
  if (bird.flying > 0) {
    bird.flying += dt;
    bird.x += (bird.left ? -1 : 1) * 160 * dt; bird.y -= 120 * dt;
    if (bird.flying > 1.2) { bird.flying = 0; bird.hiddenUntil = now + 9000; bird.x = bird.home.x; bird.y = bird.home.y; }
    return;
  }
  if (Math.hypot(player.x - bird.x, player.y - bird.y) < 90) { bird.flying = 0.001; bird.left = player.x > bird.x; return; }
  if (!still && now > bird.hopAt) {
    bird.hopAt = now + 900 + ((bird.home.x * 7 + now) % 1400);
    const nx = bird.x + (((now / 97) % 3) - 1) * 12, ny = bird.y + (((now / 131) % 3) - 1) * 8;
    if (Math.hypot(nx - bird.home.x, ny - bird.home.y) < 60) { bird.left = nx < bird.x; bird.x = nx; bird.y = ny; }
  }
}
export function paintBird(ctx: Ctx, bird: Bird, now: number) {
  if (bird.hiddenUntil > now) return;
  const flapping = bird.flying > 0 && Math.floor(now / 90) % 2 === 0;
  const rows = flapping ? ["#...#", ".###o", "..#.."] : BIRD;
  ctx.globalAlpha = bird.flying > 0 ? Math.max(0, 1 - bird.flying / 1.2) : 1;
  pixels(ctx, bird.left ? mirror(rows) : rows, Math.round(bird.x) - 10, Math.round(bird.y) - 16, 4, "#9a7050");
  ctx.globalAlpha = 1;
}

// The doorstep cat's tail flicks now and then.
const CAT_ROWS = ["#...#...", "##.##...", "#####...", "#k#k###.", "########", ".#######"];
export function paintCat(ctx: Ctx, now: number, still: boolean) {
  const left = CAT.x - 16, top = CAT.y - 24;
  pixels(ctx, CAT_ROWS, left, top, 4, "#d9904a");
  const flick = !still && Math.floor(now / 1800) % 3 === 0;
  pixels(ctx, flick ? ["#.", "#.", "##"] : ["..", "#.", "##"], left + 32, top + 12, 4, "#d9904a");
  if (!still) {
    ctx.fillStyle = INK; ctx.font = "bold 11px ui-monospace, monospace"; ctx.textAlign = "left";
    ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(now / 900));
    ctx.fillText("z", left + 30, top - 4 - (Math.floor(now / 900) % 2) * 4);
    ctx.globalAlpha = 1;
  }
}

// Bunting strung from each lamp to the top of the well, like a maypole.
const BUNTING_COLORS = ["#c9405a", "#f0c24a", "#8aa2de", "#7fb069", "#fbf7ee"];
const WELL_TOP = { x: WELL.x, y: WELL.y - 122 };
export function paintBunting(ctx: Ctx, t: number, still: boolean) {
  LAMPS.forEach((lamp, strand) => {
    const a = { x: lamp.x, y: lamp.y - 98 }, b = WELL_TOP, sag = 34;
    const at = (u: number) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * sag });
    ctx.fillStyle = INK;
    for (let u = 0; u <= 1; u += 0.01) { const p = at(u); ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    const count = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 24);
    for (let i = 1; i < count; i++) {
      const p = at(i / count), sway = still ? 0 : Math.round(Math.sin(t * 2 + i + strand) * 1.5);
      const x = Math.round(p.x) - 6 + sway, y = Math.round(p.y) + 2;
      ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, 14, 3);
      ctx.fillStyle = BUNTING_COLORS[(i + strand) % BUNTING_COLORS.length];
      for (let row = 0; row < 6; row++) ctx.fillRect(x + row, y + row * 2, 12 - row * 2, 2);
    }
  });
}

// Rain: puddles on the paths while it's wet, a cool tint and falling streaks.
export const PUDDLES: Point[] = [
  { x: 700, y: 690 }, { x: 1230, y: 670 }, { x: 960, y: 480 }, { x: 960, y: 1000 }, { x: 420, y: 690 },
  { x: 1620, y: 700 }, { x: 380, y: 600 }, { x: -240, y: 650 }, { x: 870, y: 760 }, { x: 1060, y: 610 },
];
export function paintPuddles(ctx: Ctx, wetness: number, t: number, raining: boolean, still: boolean) {
  if (wetness <= 0.01) return;
  PUDDLES.forEach((p, i) => {
    const w = Math.round((26 + (i % 3) * 8) * wetness);
    ctx.globalAlpha = 0.7 * wetness;
    ctx.fillStyle = "#9fb8c2"; ctx.fillRect(p.x - w, p.y - 4, w * 2, 8); ctx.fillRect(p.x - w + 5, p.y - 7, w * 2 - 10, 14);
    if (raining && !still) {
      const r = ((t * 1.3 + i * 0.37) % 1) * 12;
      ctx.fillStyle = "#d4e4ea"; ctx.fillRect(Math.round(p.x - r), p.y - 1, Math.round(r * 2), 2);
    }
    ctx.globalAlpha = 1;
  });
}
export function paintRain(ctx: Ctx, level: number, t: number, still: boolean, cam: Point, vw: number, vh: number) {
  if (level <= 0.01) return;
  ctx.fillStyle = `rgba(70, 82, 104, ${(0.18 * level).toFixed(3)})`; ctx.fillRect(cam.x, cam.y, vw, vh);
  if (still) return;
  ctx.fillStyle = `rgba(220, 232, 240, ${(0.55 * level).toFixed(3)})`;
  const drops = Math.round(140 * level);
  for (let i = 0; i < drops; i++) {
    const x = cam.x + ((i * 97.3 + t * 90) % (vw + 60)) - 30, y = cam.y + ((i * 53.7 + t * 620) % (vh + 40)) - 20;
    for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x - k * 2), Math.round(y + k * 4), 2, 4);
  }
}
