/** Rareton's map, collision and pre-rendered scenery. World units are canvas pixels at zoom 1. */
import { FLOWERS, type FlowerId } from "./gifts";

/** The village spans x 0–1920; Whispering Woods extends west into negative x. */
export const WORLD = { x: -1000, width: 2920, height: 1280 } as const;
export const SPAWN = { x: 960, y: 800 } as const;
export const RADIUS = 14;
export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

export const INK = "#2b2620";
const GRASS = "#cfd8a8", GRASS_DARK = "#b9c48f", GRASS_LIGHT = "#dfe6bc", MEADOW = "#dbe2b2";
const SAND = "#eadbb5", SAND_EDGE = "#d2bd8c", COBBLE = "#e3d7bc", COBBLE_LINE = "#cbbd9c";
const WATER = "#8fb8bf", WATER_LIGHT = "#bcd8d4", LEAF = "#5f7d55", LEAF_LIGHT = "#7f9c6a";
const WOOD = "#8a6a45", WALL = "#f4ead2", WINDOW = "#a9c7d4", STONE = "#b9b2a3";

type Building = Box & { roof: string; sign?: string; chimney?: boolean };
export const BUILDINGS: Record<"post" | "bakery" | "cottageA" | "cottageB" | "cottageC", Building> = {
  post: { x: 820, y: 180, width: 280, height: 120, roof: "#5d7894", sign: "POST OFFICE" },
  bakery: { x: 260, y: 420, width: 240, height: 110, roof: "#b8614f", sign: "BAKERY", chimney: true },
  cottageA: { x: 1250, y: 860, width: 180, height: 100, roof: "#7b9460", chimney: true },
  cottageB: { x: 1520, y: 900, width: 180, height: 100, roof: "#c08a4a", chimney: true },
  cottageC: { x: 700, y: 900, width: 170, height: 95, roof: "#b8614f" },
};
export const SQUARE = { x: 960, y: 680, radius: 150 };
export const POND = { x: 410, y: 1050, rx: 190, ry: 110 };
export const MEADOW_AREA: Box = { x: 1380, y: 180, width: 460, height: 380 };
export const WELL = { x: 960, y: 695 };
export const BOARD = { x: 1120, y: 566 };
export const MAILBOX = { x: 1060, y: 332 };
/** Community garden plot where seed packets are planted, and the seed stall beside it. */
export const PLOT: Box = { x: 1410, y: 440, width: 210, height: 86 };
export const STALL = { x: 1730, y: 520 };
export const PLOT_SLOTS: Point[] = Array.from({ length: 8 }, (_, i) => ({ x: PLOT.x + 30 + (i % 4) * 50, y: PLOT.y + 38 + Math.floor(i / 4) * 40 }));
export const LAMPS: Point[] = [{ x: 840, y: 570 }, { x: 1090, y: 812 }, { x: 830, y: 812 }];

/** Whispering Woods: a winding path from the village road to a glade of standing stones, and Fern's hut. */
export const GLADE = { x: -620, y: 390, rx: 210, ry: 140 };
export const WOODS_PATHS: Point[][] = [
  [{ x: 130, y: 680 }, { x: -120, y: 680 }, { x: -280, y: 610 }, { x: -430, y: 500 }, { x: -560, y: 430 }],
  [{ x: -150, y: 690 }, { x: -330, y: 820 }, { x: -560, y: 960 }, { x: -735, y: 1000 }],
];
export const HUT: Box = { x: -820, y: 880, width: 170, height: 95 };
export const SIGNPOST = { x: 90, y: 612 };
/** A ginger cat naps on the green cottage's doorstep. */
export const CAT = { x: 1388, y: 978 };
export const STONES: Point[] = [0, 1, 2, 3, 4].map(i => {
  const angle = -Math.PI / 2 + (i - 2) * 0.95 + (i > 2 ? 0.9 : 0);
  return { x: Math.round(GLADE.x + Math.cos(angle) * 150), y: Math.round(GLADE.y + Math.sin(angle) * 95) };
});

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const nearPath = (p: Point, margin: number) => WOODS_PATHS.some(path => path.slice(1).some((b, i) => segmentDistance(p, path[i], b) < margin));

const border: Point[] = [];
for (let x = WORLD.x + 60; x < WORLD.x + WORLD.width; x += 130) border.push({ x, y: 70 }, { x: x + 40, y: 1262 });
for (let y = 200; y < WORLD.height - 100; y += 140) border.push({ x: WORLD.x + 42, y }, { x: 42, y }, { x: 1880, y: y + 50 });

/** Dense woodland, placed deterministically around the paths, glade and hut. */
export const WOOD_TREES: Point[] = [];
{
  let seed = 11;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let y = 150; y < 1220; y += 105) for (let x = WORLD.x + 120; x < -30; x += 115) {
    const p = { x: Math.round(x + (rand() - 0.5) * 70), y: Math.round(y + (rand() - 0.5) * 60) };
    const inGlade = ((p.x - GLADE.x) / (GLADE.rx + 40)) ** 2 + ((p.y - GLADE.y) / (GLADE.ry + 50)) ** 2 < 1;
    const byHut = p.x > HUT.x - 90 && p.x < HUT.x + HUT.width + 90 && p.y > HUT.y - 60 && p.y < HUT.y + HUT.height + 150;
    if (!inGlade && !byHut && !nearPath(p, 95) && rand() < 0.8) WOOD_TREES.push(p);
  }
}
export const TREES: Point[] = [...border,
  { x: 180, y: 300 }, { x: 620, y: 250 }, { x: 700, y: 470 }, { x: 1250, y: 300 }, { x: 1290, y: 520 },
  { x: 160, y: 780 }, { x: 1200, y: 1110 }, { x: 1460, y: 1160 }, { x: 1760, y: 1140 }, { x: 1780, y: 790 },
  { x: 1110, y: 1000 }, { x: 820, y: 1140 }, { x: 560, y: 760 }, { x: 1300, y: 770 },
];

export const OBSTACLES: Box[] = [
  ...Object.values(BUILDINGS),
  ...[...TREES, ...WOOD_TREES].map(tree => ({ x: tree.x - 16, y: tree.y - 14, width: 32, height: 22 })),
  HUT,
  ...STONES.map(stone => ({ x: stone.x - 14, y: stone.y - 10, width: 28, height: 14 })),
  { x: SIGNPOST.x - 6, y: SIGNPOST.y - 8, width: 12, height: 10 },
  { x: CAT.x - 16, y: CAT.y - 8, width: 34, height: 10 },
  { x: POND.x - POND.rx + 20, y: POND.y - POND.ry + 15, width: POND.rx * 2 - 40, height: POND.ry * 2 - 30 },
  { x: POND.x - POND.rx + 50, y: POND.y - POND.ry, width: POND.rx * 2 - 100, height: POND.ry * 2 },
  { x: WELL.x - 40, y: WELL.y - 35, width: 80, height: 40 },
  { x: BOARD.x - 36, y: BOARD.y - 12, width: 72, height: 14 },
  { x: MAILBOX.x - 10, y: MAILBOX.y - 12, width: 20, height: 14 },
  PLOT,
  { x: STALL.x - 58, y: STALL.y - 30, width: 116, height: 32 },
  ...LAMPS.map(lamp => ({ x: lamp.x - 6, y: lamp.y - 8, width: 12, height: 10 })),
];

export const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function walkable(p: Point, radius = RADIUS) {
  if (p.x < WORLD.x + 70 || p.x > WORLD.x + WORLD.width - 70 || p.y < 110 || p.y > WORLD.height - 50) return false;
  return !OBSTACLES.some(box => distance(p, { x: clamp(p.x, box.x, box.x + box.width), y: clamp(p.y, box.y, box.y + box.height) }) < radius);
}

/** Small collision steps prevent tunnelling; blocked diagonals slide along edges. */
export function advance(p: Point, dx: number, dy: number, radius = RADIUS) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let step = 0; step < steps; step++) {
    const next = { x: p.x + dx / steps, y: p.y + dy / steps };
    if (walkable(next, radius)) Object.assign(p, next);
    else {
      if (walkable({ x: next.x, y: p.y }, radius)) p.x = next.x;
      if (walkable({ x: p.x, y: next.y }, radius)) p.y = next.y;
    }
  }
}

export type FlowerSpot = Point & { flower: FlowerId; bloomAt: number };
export function createFlowerSpots(): FlowerSpot[] {
  const spots: FlowerSpot[] = [];
  const meadow: FlowerId[] = ["daisy", "sunflower", "tulip", "poppy", "daisy", "tulip", "sunflower", "daisy"];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    spots.push({ x: 1430 + col * 88 + (row % 2) * 40, y: 240 + row * 110 + ((col * 37) % 30), flower: meadow[(row * 5 + col) % meadow.length], bloomAt: 0 });
  }
  spots.push(
    { x: 640, y: 960, flower: "bluebell", bloomAt: 0 }, { x: 250, y: 900, flower: "bluebell", bloomAt: 0 },
    { x: 610, y: 1180, flower: "bluebell", bloomAt: 0 }, { x: 1300, y: 1010, flower: "tulip", bloomAt: 0 },
    { x: 1580, y: 1050, flower: "poppy", bloomAt: 0 }, { x: 540, y: 560, flower: "daisy", bloomAt: 0 },
  );
  // Starbells grow inside the stone circle and only open after dark.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    spots.push({ x: Math.round(GLADE.x + Math.cos(angle) * 70), y: Math.round(GLADE.y + Math.sin(angle) * 42), flower: "starbell", bloomAt: 0 });
  }
  return spots;
}

type Ctx = CanvasRenderingContext2D;
/** Draw several rects as one outlined shape: ink first, then fills. */
function blob(ctx: Ctx, rects: readonly (readonly [number, number, number, number])[], fill: string, outline = 4) {
  ctx.fillStyle = INK;
  for (const [x, y, w, h] of rects) ctx.fillRect(x - outline, y - outline, w + outline * 2, h + outline * 2);
  ctx.fillStyle = fill;
  for (const [x, y, w, h] of rects) ctx.fillRect(x, y, w, h);
}
const q = (value: number) => Math.round(value / 5) * 5;

/** A stepped ellipse, drawn as 5 px bands to keep the pixel look. */
function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  for (let y = -ry; y < ry; y += 5) {
    const half = q(rx * Math.sqrt(Math.max(0, 1 - ((y + 2.5) / ry) ** 2)));
    ctx.fillRect(cx - half, cy + y, half * 2, 5);
  }
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

export function paintGround(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width; canvas.height = WORLD.height;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(-WORLD.x, 0);
  ctx.fillStyle = GRASS; ctx.fillRect(WORLD.x, 0, WORLD.width, WORLD.height);
  // Woods floor: deeper, mossier grass west of the village.
  ctx.fillStyle = "#b3c28e"; ctx.fillRect(WORLD.x, 0, 20 - WORLD.x, WORLD.height);
  ctx.fillStyle = "#c1cd9c"; ctx.fillRect(20, 0, 40, WORLD.height);
  ctx.fillStyle = MEADOW;
  const m = MEADOW_AREA;
  ctx.fillRect(m.x + 20, m.y, m.width - 40, m.height); ctx.fillRect(m.x, m.y + 20, m.width, m.height - 40);
  const rand = random(7);
  for (let i = 0; i < 900; i++) {
    const x = q(WORLD.x + rand() * WORLD.width), y = q(rand() * WORLD.height);
    ctx.fillStyle = rand() < 0.7 ? GRASS_DARK : GRASS_LIGHT;
    ctx.fillRect(x, y, 5, 5); if (rand() < 0.5) ctx.fillRect(x + 5, y - 5, 5, 5);
  }
  // Paths: a sandy edge, then the path, then pebbles.
  const paths: Box[] = [
    { x: 100, y: 638, width: 1720, height: 84 }, { x: 918, y: 300, width: 84, height: 920 },
    { x: 340, y: 530, width: 80, height: 120 }, { x: 1002, y: 330, width: 70, height: 40 },
  ];
  ctx.fillStyle = SAND_EDGE; for (const p of paths) ctx.fillRect(p.x - 5, p.y - 5, p.width + 10, p.height + 10);
  ellipse(ctx, SQUARE.x, SQUARE.y, SQUARE.radius + 5, SQUARE.radius * 0.7 + 5, SAND_EDGE);
  ctx.fillStyle = SAND; for (const p of paths) ctx.fillRect(p.x, p.y, p.width, p.height);
  ellipse(ctx, SQUARE.x, SQUARE.y, SQUARE.radius, SQUARE.radius * 0.7, COBBLE);
  ctx.fillStyle = COBBLE_LINE;
  for (let y = SQUARE.y - 95; y < SQUARE.y + 100; y += 20) for (let x = SQUARE.x - 130; x < SQUARE.x + 130; x += 30) {
    const dx = (x - SQUARE.x) / SQUARE.radius, dy = (y - SQUARE.y) / (SQUARE.radius * 0.7);
    if (dx * dx + dy * dy < 0.85) ctx.fillRect(x + ((y / 20) % 2) * 15, y, 20, 5);
  }
  ctx.fillStyle = SAND_EDGE;
  for (let i = 0; i < 160; i++) {
    const p = paths[Math.floor(rand() * 2)];
    ctx.fillRect(q(p.x + rand() * p.width), q(p.y + rand() * p.height), 5, 5);
  }
  // Woods: glade clearing, winding dirt paths, moss and mushrooms.
  ellipse(ctx, GLADE.x, GLADE.y, GLADE.rx, GLADE.ry, "#c9d4a0");
  ellipse(ctx, GLADE.x, GLADE.y, GLADE.rx - 60, GLADE.ry - 40, "#d3dcaa");
  for (const [edge, fill, size] of [[SAND_EDGE, 0, 80], ["#c8b389", 1, 66]] as const) {
    ctx.fillStyle = edge;
    for (const path of WOODS_PATHS) path.slice(1).forEach((b, i) => {
      const a = path[i], steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
      for (let step = 0; step <= steps; step++) {
        const x = q(a.x + ((b.x - a.x) * step) / steps), y = q(a.y + ((b.y - a.y) * step) / steps);
        ctx.fillRect(x - size / 2, y - size / 2 + fill * 2, size, size - fill * 4);
      }
    });
  }
  const woods = random(23);
  for (let i = 0; i < 70; i++) {
    const x = q(WORLD.x + 80 + woods() * 900), y = q(140 + woods() * 1080);
    if (nearPath({ x, y }, 50)) continue;
    ctx.fillStyle = "#e9e1cc"; ctx.fillRect(x + 3, y - 6, 4, 8);
    ctx.fillStyle = woods() < 0.7 ? "#c2493d" : "#b48a4f"; ctx.fillRect(x - 2, y - 11, 14, 6); ctx.fillRect(x, y - 13, 10, 2);
    ctx.fillStyle = "#fbf7ee"; ctx.fillRect(x + 1, y - 10, 2, 2); ctx.fillRect(x + 7, y - 9, 2, 2);
  }
  ctx.fillStyle = "#9fb07c";
  for (let i = 0; i < 260; i++) ctx.fillRect(q(WORLD.x + woods() * 1000), q(woods() * WORLD.height), 10, 5);
  // Pond with ripples, lily pads and reeds.
  ellipse(ctx, POND.x, POND.y, POND.rx + 5, POND.ry + 5, INK);
  ellipse(ctx, POND.x, POND.y, POND.rx, POND.ry, WATER);
  ctx.fillStyle = WATER_LIGHT;
  for (const [x, y, w] of [[-110, -40, 50], [20, -70, 70], [-40, 10, 60], [60, 40, 45], [-130, 50, 35]]) ctx.fillRect(POND.x + x, POND.y + y, w, 5);
  for (const [x, y] of [[-60, -30], [90, -10], [30, 60]]) {
    ctx.fillStyle = LEAF_LIGHT; ctx.fillRect(POND.x + x, POND.y + y, 25, 15); ctx.fillStyle = WATER; ctx.fillRect(POND.x + x + 10, POND.y + y, 5, 5);
    ctx.fillStyle = "#f2b8c6"; ctx.fillRect(POND.x + x + 15, POND.y + y + 5, 5, 5);
  }
  ctx.fillStyle = LEAF;
  for (const [x, y] of [[-175, -30], [-170, 20], [160, 30], [150, -50], [-40, 100]]) { ctx.fillRect(POND.x + x, POND.y + y - 20, 5, 25); ctx.fillRect(POND.x + x + 8, POND.y + y - 15, 5, 20); }
  // Garden plot: a wooden frame around furrowed soil.
  ctx.fillStyle = INK; ctx.fillRect(PLOT.x - 8, PLOT.y - 8, PLOT.width + 16, PLOT.height + 16);
  ctx.fillStyle = WOOD; ctx.fillRect(PLOT.x - 5, PLOT.y - 5, PLOT.width + 10, PLOT.height + 10);
  ctx.fillStyle = "#8b6b4a"; ctx.fillRect(PLOT.x, PLOT.y, PLOT.width, PLOT.height);
  ctx.fillStyle = "#765a3d";
  for (let y = PLOT.y + 12; y < PLOT.y + PLOT.height; y += 20) ctx.fillRect(PLOT.x + 5, y, PLOT.width - 10, 5);
  // Flower beds under cottage windows.
  for (const b of [BUILDINGS.cottageA, BUILDINGS.cottageB, BUILDINGS.cottageC, BUILDINGS.bakery]) {
    for (let x = b.x + 10; x < b.x + b.width - 10; x += 15) {
      if (Math.abs(x - (b.x + b.width / 2)) < 30) continue;
      ctx.fillStyle = LEAF; ctx.fillRect(x, b.y + b.height + 5, 10, 5);
      ctx.fillStyle = ["#e0707a", "#f0c24a", "#8aa2de"][(x / 15) % 3 | 0]; ctx.fillRect(x + 2, b.y + b.height, 5, 5);
    }
  }
  return canvas;
}

export type Scenery = { canvas: HTMLCanvasElement; x: number; y: number; depth: number };

function sprite(width: number, height: number, draw: (ctx: Ctx) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext("2d")!);
  return canvas;
}

function building(b: Building): Scenery {
  const pad = 30, top = 70, wallH = 70;
  const width = b.width + pad * 2, height = top + b.height + 10;
  const canvas = sprite(width, height, ctx => {
    const left = pad, bottom = top + b.height, wallTop = bottom - wallH, roofTop = top - 40;
    blob(ctx, [[left, wallTop, b.width, wallH]], WALL);
    if (b.chimney) blob(ctx, [[left + b.width - 60, roofTop - 20, 24, 40]], "#9c6b55");
    // Stepped roof: widest (overhanging) at the eaves, narrower at the ridge.
    const bands: [number, number, number, number][] = [];
    for (let y = roofTop; y < wallTop; y += 10) {
      const t = (y - roofTop) / (wallTop - roofTop), inset = q((1 - t) * 40 - 16);
      bands.push([left + inset, y, b.width - inset * 2, 10]);
    }
    blob(ctx, bands, b.roof);
    ctx.fillStyle = "#0000001f";
    bands.forEach(([x, y, w], index) => { if (index % 2) ctx.fillRect(x, y + 5, w, 5); });
    const cx = left + b.width / 2;
    blob(ctx, [[cx - 20, bottom - 54, 40, 54]], WOOD, 3);
    ctx.fillStyle = "#f0c24a"; ctx.fillRect(cx + 10, bottom - 30, 5, 5);
    for (const wx of [left + b.width / 4 - 17, left + (b.width * 3) / 4 - 17]) {
      blob(ctx, [[wx, bottom - 52, 34, 28]], WINDOW, 3);
      ctx.fillStyle = INK; ctx.fillRect(wx + 15, bottom - 52, 4, 28); ctx.fillRect(wx, bottom - 40, 34, 4);
    }
    if (b.sign) {
      ctx.font = "bold 15px ui-monospace, monospace";
      const w = ctx.measureText(b.sign).width + 20;
      blob(ctx, [[cx - w / 2, wallTop - 30, w, 24]], "#f7efd9", 3);
      ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.sign, cx, wallTop - 17);
    }
  });
  return { canvas, x: b.x - pad, y: b.y - top, depth: b.y + b.height };
}

const treeSprites = new Map<number, HTMLCanvasElement>();
function tree(p: Point, variant: number): Scenery {
  let canvas = treeSprites.get(variant);
  if (!canvas) treeSprites.set(variant, canvas = variant === 2 ? pine() : broadleaf(variant));
  return { canvas, x: p.x - 65, y: p.y - 150, depth: p.y };
}

function pine() {
  return sprite(130, 160, ctx => {
    blob(ctx, [[57, 118, 16, 34]], WOOD);
    const tiers: [number, number, number, number][] = [];
    for (let i = 0; i < 6; i++) { const w = 30 + i * 14; tiers.push([65 - w / 2, 14 + i * 18, w, 20]); }
    blob(ctx, tiers, "#3f5e4a");
    ctx.fillStyle = "#56775c";
    tiers.forEach(([x, y, w], i) => { if (i % 2 === 0) ctx.fillRect(x + 6, y + 4, w / 3, 6); });
  });
}

function broadleaf(variant: number) {
  return sprite(130, 160, ctx => {
    blob(ctx, [[56, 110, 18, 42]], WOOD);
    const canopy: [number, number, number, number][] = variant
      ? [[20, 40, 90, 60], [35, 20, 60, 30], [10, 60, 110, 40], [30, 95, 70, 15]]
      : [[25, 30, 80, 70], [40, 12, 50, 30], [15, 55, 100, 45], [35, 95, 60, 15]];
    blob(ctx, canopy, LEAF);
    ctx.fillStyle = LEAF_LIGHT;
    ctx.fillRect(40, variant ? 30 : 22, 30, 10); ctx.fillRect(30, 55, 25, 10); ctx.fillRect(70, 70, 20, 10);
  });
}

function hut(): Scenery {
  const b = HUT, pad = 30, top = 70, wallH = 60;
  const canvas = sprite(b.width + pad * 2, top + b.height + 10, ctx => {
    const left = pad, bottom = top + b.height, wallTop = bottom - wallH, roofTop = top - 30;
    blob(ctx, [[left + 10, wallTop, b.width - 20, wallH]], "#a98b64");
    ctx.fillStyle = "#94774f"; for (let y = wallTop + 10; y < bottom; y += 14) ctx.fillRect(left + 10, y, b.width - 20, 3);
    blob(ctx, [[left + b.width - 55, roofTop - 18, 20, 36]], STONE);
    const bands: [number, number, number, number][] = [];
    for (let y = roofTop; y < wallTop; y += 10) { const t = (y - roofTop) / (wallTop - roofTop), inset = q((1 - t) * 45 - 12); bands.push([left + inset, y, b.width - inset * 2, 10]); }
    blob(ctx, bands, "#6f8a4e");
    ctx.fillStyle = "#86a262"; bands.forEach(([x, y, w], i) => { if (i % 2) ctx.fillRect(x + 8, y + 3, w - 16, 4); });
    const cx = left + b.width / 2;
    blob(ctx, [[cx - 17, bottom - 46, 34, 46]], "#6b4f33", 3);
    blob(ctx, [[left + 26, bottom - 44, 26, 22]], WINDOW, 3);
  });
  return { canvas, x: b.x - pad, y: b.y - top, depth: b.y + b.height };
}

function stone(p: Point): Scenery {
  const canvas = sprite(50, 70, ctx => {
    blob(ctx, [[12, 12, 26, 50], [16, 6, 18, 8]], "#a7a394", 3);
    ctx.fillStyle = "#8f8b7d"; ctx.fillRect(18, 24, 12, 3); ctx.fillRect(16, 40, 8, 3);
    ctx.fillStyle = "#7f9c6a"; ctx.fillRect(12, 54, 10, 8);
  });
  return { canvas, x: p.x - 25, y: p.y - 62, depth: p.y };
}

function signpost(): Scenery {
  const canvas = sprite(170, 110, ctx => {
    blob(ctx, [[82, 30, 6, 72]], WOOD, 3);
    blob(ctx, [[10, 18, 150, 26]], "#c9a36b", 3);
    ctx.fillStyle = INK; ctx.fillRect(4, 24, 6, 14);
    ctx.font = "bold 13px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("◀ WHISPERING WOODS", 85, 32);
  });
  return { canvas, x: SIGNPOST.x - 85, y: SIGNPOST.y - 102, depth: SIGNPOST.y };
}

function well(): Scenery {
  const canvas = sprite(120, 140, ctx => {
    blob(ctx, [[22, 30, 6, 70], [92, 30, 6, 70]], WOOD, 3);
    const roof: [number, number, number, number][] = [[10, 20, 100, 12], [20, 10, 80, 10], [35, 2, 50, 8]];
    blob(ctx, roof, "#b8614f", 3);
    ctx.fillStyle = INK; ctx.fillRect(58, 32, 4, 30);
    blob(ctx, [[52, 60, 16, 14]], WOOD, 2);
    blob(ctx, [[15, 85, 90, 40]], STONE);
    ctx.fillStyle = "#3d5a60"; ctx.fillRect(25, 90, 70, 10);
    ctx.fillStyle = "#a39b8b";
    for (let y = 105; y < 125; y += 10) for (let x = 15 + ((y / 10) % 2) * 10; x < 100; x += 20) ctx.fillRect(x, y, 15, 3);
  });
  return { canvas, x: WELL.x - 60, y: WELL.y - 125, depth: WELL.y };
}

function board(): Scenery {
  const canvas = sprite(100, 100, ctx => {
    blob(ctx, [[22, 30, 6, 64], [72, 30, 6, 64]], WOOD, 3);
    blob(ctx, [[12, 20, 76, 46]], "#b08858", 3);
    for (const [x, y, c] of [[20, 26, "#f7efd9"], [46, 30, "#f2dfe4"], [66, 26, "#e4ecd0"]] as const) {
      ctx.fillStyle = c; ctx.fillRect(x, y, 18, 22); ctx.fillStyle = INK; ctx.fillRect(x + 3, y + 6, 12, 2); ctx.fillRect(x + 3, y + 12, 9, 2);
    }
  });
  return { canvas, x: BOARD.x - 50, y: BOARD.y - 92, depth: BOARD.y };
}

function mailbox(): Scenery {
  const canvas = sprite(60, 80, ctx => {
    blob(ctx, [[27, 30, 6, 44]], WOOD, 3);
    blob(ctx, [[14, 12, 32, 24]], "#c0574a", 3);
    ctx.fillStyle = INK; ctx.fillRect(20, 22, 20, 3);
    blob(ctx, [[48, 6, 4, 18], [48, 6, 10, 7]], "#f0c24a", 2);
  });
  return { canvas, x: MAILBOX.x - 30, y: MAILBOX.y - 72, depth: MAILBOX.y };
}

function stall(): Scenery {
  const canvas = sprite(140, 130, ctx => {
    blob(ctx, [[14, 30, 6, 90], [120, 30, 6, 90]], WOOD, 3);
    blob(ctx, [[10, 82, 120, 36]], "#b08858", 3);
    for (let x = 18; x < 124; x += 18) {
      ctx.fillStyle = ["#e0707a", "#f0c24a", "#8aa2de", "#7fb069"][(x / 18) % 4 | 0];
      ctx.fillRect(x, 70, 12, 14); ctx.fillStyle = INK; ctx.fillRect(x, 70, 12, 2);
    }
    const stripes: [number, number, number, number][] = [[4, 18, 132, 26]];
    blob(ctx, stripes, "#f7efd9", 3);
    ctx.fillStyle = "#c9405a"; for (let x = 4; x < 136; x += 22) ctx.fillRect(x, 18, 11, 26);
    ctx.fillStyle = INK; for (let x = 4; x < 136; x += 11) ctx.fillRect(x, 44, 6, 5);
    ctx.font = "bold 14px ui-monospace, monospace";
    blob(ctx, [[40, 0, 60, 18]], "#f7efd9", 2);
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("SEEDS", 70, 10);
  });
  return { canvas, x: STALL.x - 70, y: STALL.y - 120, depth: STALL.y };
}

function lamp(p: Point): Scenery {
  const canvas = sprite(40, 110, ctx => {
    blob(ctx, [[17, 30, 6, 72]], "#4a4640", 3);
    blob(ctx, [[10, 10, 20, 20]], "#f3d27a", 3);
    ctx.fillStyle = INK; ctx.fillRect(8, 6, 24, 4);
  });
  return { canvas, x: p.x - 20, y: p.y - 102, depth: p.y };
}

export function paintScenery(): Scenery[] {
  return [
    ...Object.values(BUILDINGS).map(building),
    ...TREES.map((p, index) => tree(p, p.x < 0 ? 2 : index % 2)),
    ...WOOD_TREES.map((p, index) => tree(p, index % 3 ? 2 : index % 2)),
    hut(), signpost(), ...STONES.map(stone),
    well(), board(), mailbox(), stall(), ...LAMPS.map(lamp),
  ];
}

/** Building windows in world space, for the night-time glow. Matches building() geometry. */
export const WINDOWS: Box[] = Object.values(BUILDINGS).flatMap(b =>
  [b.x + b.width / 4 - 17, b.x + (b.width * 3) / 4 - 17].map(x => ({ x, y: b.y + b.height - 52, width: 34, height: 28 })));

/** Where fireflies gather at night: the meadow, the pond and the garden. */
export const FIREFLIES: Point[] = Array.from({ length: 44 }, (_, i) => {
  const areas = [{ x: 1400, y: 200, w: 420, h: 330 }, { x: 240, y: 880, w: 400, h: 300 }, { x: 1100, y: 850, w: 700, h: 300 }, { x: -800, y: 280, w: 360, h: 220 }];
  const area = areas[i % areas.length], a = (i * 7919) % 1000 / 1000, b = (i * 104729) % 1000 / 1000;
  return { x: area.x + a * area.w, y: area.y + b * area.h };
});

/** Chimney tops for animated smoke puffs. */
export const CHIMNEYS: Point[] = Object.values(BUILDINGS).filter(b => b.chimney).map(b => ({ x: b.x + b.width - 48, y: b.y - 66 }));

export function paintFlower(ctx: Ctx, spot: FlowerSpot, blooming: boolean) {
  const x = Math.round(spot.x), y = Math.round(spot.y);
  if (!blooming) {
    ctx.fillStyle = LEAF; ctx.fillRect(x - 2, y - 8, 4, 8); ctx.fillRect(x - 7, y - 10, 5, 4); ctx.fillRect(x + 2, y - 12, 5, 4);
    return;
  }
  const { head, color } = FLOWERS[spot.flower], scale = 4;
  const w = head[0].length * scale, h = head.length * scale, left = x - w / 2, top = y - 16 - h;
  ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 18, 6, 18);
  ctx.fillStyle = LEAF; ctx.fillRect(x - 1, y - 18, 3, 18); ctx.fillRect(x + 2, y - 10, 5, 3);
  ctx.fillStyle = INK;
  head.forEach((row, r) => [...row].forEach((pixel, c) => { if (pixel === "#") ctx.fillRect(left + c * scale - 2, top + r * scale - 2, scale + 4, scale + 4); }));
  ctx.fillStyle = color;
  head.forEach((row, r) => [...row].forEach((pixel, c) => { if (pixel === "#") ctx.fillRect(left + c * scale, top + r * scale, scale, scale); }));
}
