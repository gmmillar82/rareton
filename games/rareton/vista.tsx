/**
 * The garden vista: a detailed, bright pixel-art scene for planting seed packets.
 * Planting and the result come from the SDK client (via sow/harvest); the Bloom button only
 * chooses when the already-decided flower is revealed.
 */
import { useEffect, useRef, useState } from "react";
import { spriteFrame, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import type { FriendSoundCue } from "@rarefriends/friendsdk/sounds";
import type { ChanceGameDefinition, GamePlay } from "@rarefriends/friendsdk/game";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { FLOWERS, outcomeOf, type GardenFlower } from "./gifts";

const W = 320;
const INK = "#1d1b17";
type Ctx = CanvasRenderingContext2D;
type Phase = "idle" | "planting" | "growing" | "ready" | "opening" | "revealed";
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) { const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1); }
}
function poly(ctx: Ctx, points: readonly (readonly [number, number])[], color: string) {
  ctx.fillStyle = color; ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
function rows(ctx: Ctx, pattern: readonly string[], left: number, top: number, size: number, palette: Record<string, string>) {
  pattern.forEach((row, y) => [...row].forEach((c, x) => { const color = palette[c]; if (color) rect(ctx, left + x * size, top + y * size, size, size, color); }));
}

/** Layout shared by the static backdrop and the animated layer. */
function layout(H: number) {
  // Tall (phone portrait) frames lift the horizon and planter so the bloom clears the controls.
  const tall = H > 260;
  const hy = Math.round(H * (tall ? 0.33 : 0.4));
  const pt = Math.round(H * (tall ? 0.48 : 0.58));
  return { H, hy, pt, hole: { x: 164, y: pt + 7 } };
}
type Layout = ReturnType<typeof layout>;

function backdrop(H: number) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!, { hy, pt } = layout(H);
  // Anime sky: banded blues fading to a warm haze, dithered at each band edge.
  const bands = ["#3b86dd", "#4f97e6", "#66a9ee", "#80baf2", "#9dcbf5", "#bddcf5", "#dcebf2", "#f4efd8"];
  const bandH = hy / bands.length;
  bands.forEach((color, i) => {
    rect(ctx, 0, i * bandH, W, bandH + 1, color);
    if (i) for (let x = (i % 2); x < W; x += 2) rect(ctx, x, i * bandH, 1, 1, bands[i - 1]);
  });
  // Far mountains, pale with distance, with snowy peaks.
  const peaks: [number, number][] = [[-10, 30], [30, 52], [70, 34], [115, 58], [160, 40], [205, 62], [250, 38], [290, 50], [335, 30]];
  const ridge = (x: number, lift: number) => {
    for (let i = 0; i < peaks.length - 1; i++) {
      const [x0, h0] = peaks[i], [x1, h1] = peaks[i + 1];
      if (x >= x0 && x <= x1) { const t = (x - x0) / (x1 - x0), tri = 1 - Math.abs(t - 0.5) * 2; return hy - (h0 + (h1 - h0) * t) * 0.55 - tri * 10 - lift; }
    }
    return hy;
  };
  for (let x = 0; x < W; x++) {
    const top = Math.round(ridge(x, 0));
    rect(ctx, x, top, 1, hy - top, x % 7 < 3 ? "#9db3de" : "#a9bee4");
    if (hy - top > 26) rect(ctx, x, top, 1, Math.min(5, (hy - top - 26) / 3 + 2), "#f4f8ff");
  }
  // Rolling hills: a lighter far layer and a nearer green layer, dotted with round trees.
  const hill = (x: number, base: number, amp: number, freq: number, phase: number) => base - Math.abs(Math.sin(x * freq + phase)) * amp;
  for (let x = 0; x < W; x++) {
    const far = Math.round(hill(x, hy + 2, 12, 0.018, 0.6)), near = Math.round(hill(x, hy + 4, 7, 0.031, 2.1));
    rect(ctx, x, far, 1, hy + 6 - far, "#a8d68f");
    rect(ctx, x, near, 1, hy + 6 - near, "#8ccb73");
  }
  for (let i = 0; i < 26; i++) {
    const x = (i * 53) % W, y = Math.round(hill(x, hy + 3, 9, 0.024, 1.3)) - 1;
    rect(ctx, x, y, 1, 3, "#6b5238"); disc(ctx, x, y - 2, 2 + (i % 2), i % 3 ? "#4f9e55" : "#5fae5d");
  }
  // A tiny hilltop village (the windmill's blades are animated separately).
  for (const [x, roof] of [[222, "#d9604e"], [232, "#6f8bc0"], [241, "#d9604e"]] as const) {
    rect(ctx, x, hy - 9, 7, 5, "#f4ead2"); poly(ctx, [[x - 1, hy - 9], [x + 3.5, hy - 13], [x + 8, hy - 9]], roof);
  }
  rect(ctx, 256, hy - 20, 5, 16, "#efe3c8"); poly(ctx, [[255, hy - 20], [258.5, hy - 24], [262, hy - 20]], "#b8614f");
  // Fields in one-point perspective: stripes converge on a vanishing point at the horizon.
  const vx = 160;
  const stripes = ["#b9d86a", "#9ccd5e", "#e5cf6c", "#a6d263", "#8fc45a", "#cfe07a"];
  for (let i = -14; i < 14; i++) {
    const x0 = vx + i * 34, x1 = vx + (i + 1) * 34;
    poly(ctx, [[vx, hy + 4], [x0 * 3 - vx * 2, H * 3], [x1 * 3 - vx * 2, H * 3]], stripes[(i + 28) % stripes.length]);
  }
  // Furrow lines get closer together towards the horizon.
  for (let k = 1; k < 18; k++) {
    const y = Math.round(hy + 4 + (H - hy) * (k / 18) ** 2);
    ctx.globalAlpha = 0.18; rect(ctx, 0, y, W, 1, "#3f6b35"); ctx.globalAlpha = 1;
  }
  // A split-rail fence running off into the distance.
  let prev: [number, number, number] | null = null;
  for (let i = 0; i <= 9; i++) {
    const t = i / 9, x = 6 + t * 118, base = pt - 4 - t * (pt - hy - 14), h = 20 * (1 - t * 0.75), w = Math.max(1, 3 - t * 2);
    rect(ctx, x, base - h, w, h, "#9b6a42"); rect(ctx, x, base - h, w, 1, "#c79566");
    if (prev) for (const k of [0.3, 0.65]) {
      const [px, pb, ph] = prev;
      ctx.strokeStyle = "#a8744a"; ctx.lineWidth = Math.max(1, 2 - t * 1.5);
      ctx.beginPath(); ctx.moveTo(px, pb - ph * (1 - k)); ctx.lineTo(x, base - h * (1 - k)); ctx.stroke();
    }
    prev = [x, base, h];
  }
  // The raised planter box, seen from above and slightly to the left so three faces show.
  const FL: [number, number] = [108, pt + 14], FR: [number, number] = [206, pt + 14], BL: [number, number] = [120, pt], BR: [number, number] = [220, pt];
  poly(ctx, [[FL[0] - 1, FL[1] + 23], [FR[0] + 1, FR[1] + 23], [BR[0] + 1, BR[1] + 22], [FR[0] + 1, FR[1] + 23]], "rgba(40,60,30,0.35)");
  ctx.globalAlpha = 0.28; poly(ctx, [[FL[0] - 4, FL[1] + 24], [FR[0] + 14, FR[1] + 24], [FR[0] + 22, FR[1] + 18], [FL[0] + 4, FL[1] + 18]], "#2f4a28"); ctx.globalAlpha = 1;
  poly(ctx, [FR, BR, [BR[0], BR[1] + 20], [FR[0], FR[1] + 22]], "#7d522e");
  poly(ctx, [FL, FR, [FR[0], FR[1] + 22], [FL[0], FL[1] + 22]], "#b07a48");
  for (let y = FL[1] + 7; y < FL[1] + 22; y += 7) rect(ctx, FL[0], y, FR[0] - FL[0], 1, "#8a5a32");
  for (const x of [FL[0] + 2, FR[0] - 4]) rect(ctx, x, FL[1] + 1, 2, 20, "#9a6a3c");
  poly(ctx, [FL, FR, BR, BL], "#c9925c");
  poly(ctx, [[FL[0] + 4, FL[1] - 2], [FR[0] - 4, FR[1] - 2], [BR[0] - 4, BR[1] + 2], [BL[0] + 4, BL[1] + 2]], "#6b4a32");
  for (let i = 1; i < 5; i++) {
    const t = i / 5; ctx.globalAlpha = 0.5;
    rect(ctx, FL[0] + 6 + (BL[0] - FL[0]) * t, FL[1] - 2 - (FL[1] - BL[1]) * t, FR[0] - FL[0] - 12, 1, "#553926"); ctx.globalAlpha = 1;
  }
  // Out-of-focus foreground flowers frame the bottom corners.
  for (const [x, y, c, r] of [[14, H - 8, "#f28fb0", 7], [34, H - 3, "#ffd66b", 6], [290, H - 6, "#b38be8", 7], [308, H - 12, "#f7f3e8", 5], [272, H - 2, "#f28fb0", 5]] as const) {
    rect(ctx, x - 1, y, 2, 12, "#4f9e55"); disc(ctx, x, y - 1, r, c); disc(ctx, x - 1, y - 2, Math.max(1, r - 3), "#fff8e8");
  }
  for (let x = 0; x < W; x += 3) { const h = 3 + ((x * 7) % 5); rect(ctx, x, H - h, 1, h, "#5fae5d"); }
  return canvas;
}

function drawSun(ctx: Ctx, t: number, still: boolean, L: Layout) {
  const x = 262, y = Math.round(L.hy * 0.28);
  ctx.globalAlpha = 0.35; disc(ctx, x, y, 17, "#fff3b0"); ctx.globalAlpha = 0.55; disc(ctx, x, y, 12, "#fff6c8"); ctx.globalAlpha = 1;
  disc(ctx, x, y, 8, "#fffbe8");
  const glint = still ? 5 : 5 + Math.round(Math.sin(t * 2) * 2);
  rect(ctx, x - glint * 3, y, glint * 6, 1, "#fffbe8"); rect(ctx, x, y - glint * 3, 1, glint * 6, "#fffbe8");
  // Anime lens flare: soft hexes along the diagonal.
  ctx.globalAlpha = 0.22;
  for (const [k, r, c] of [[0.35, 4, "#fff3b0"], [0.6, 6, "#bfe6ff"], [0.85, 3, "#ffd6f0"]] as const) disc(ctx, x + (160 - x) * k, y + (L.hy - y) * k * 1.4, r, c);
  ctx.globalAlpha = 1;
}

function drawClouds(ctx: Ctx, t: number, still: boolean, L: Layout) {
  const clouds = [[40, 0.18, 1], [150, 0.1, 0.8], [230, 0.24, 1.2]] as const;
  clouds.forEach(([x0, row, s], i) => {
    const x = ((x0 + (still ? 0 : t * (3 + i))) % (W + 80)) - 40, y = Math.round(L.hy * row + 8);
    const puffs: [number, number, number][] = [[0, 4, 9], [11, 0, 11], [24, 3, 9], [-10, 7, 7], [34, 7, 7]];
    for (const [dx, dy, r] of puffs) disc(ctx, x + dx * s, y + dy * s + 2, r * s, "#d9d2ef");
    for (const [dx, dy, r] of puffs) disc(ctx, x + dx * s, y + dy * s, r * s, "#ffffff");
    disc(ctx, x + 8 * s, y - 3 * s, 4 * s, "#ffffff"); rect(ctx, x - 16 * s, y + 9 * s, 58 * s, 4 * s, "#d9d2ef");
  });
}

function drawWindmill(ctx: Ctx, t: number, still: boolean, L: Layout) {
  const cx = 258.5, cy = L.hy - 20, a = still ? 0.4 : t * 1.4;
  ctx.strokeStyle = "#fbf7ee"; ctx.lineWidth = 1.5;
  for (let k = 0; k < 4; k++) {
    const angle = a + (k * Math.PI) / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8); ctx.stroke();
  }
  rect(ctx, cx - 1, cy - 1, 2, 2, "#6b5238");
}

const HAT = ["....hhhh....", "...hhhhhh...", "...rrrrrr...", "hhhhhhhhhhhh"];
const CAN = ["..cccc.....", ".c....c..c.", "cccccccccc.", "ccccccc....", "ccccccc....", ".ccccc....."];

/** A Friend sprite at 3× with the canonical white halo, a straw hat, and a watering can. */
function drawFarmer(ctx: Ctx, sprites: GenerationSprites, footX: number, footY: number, t: number, still: boolean, facing: "left" | "right", watering: number, bobPhase: number) {
  const walk = spriteFrame(sprites, facing, false, still ? 0 : Math.floor(t * 5 + bobPhase) % 8, facing).frame.rows;
  const s = 3, bob = still ? 0 : Math.round(Math.sin(t * 3 + bobPhase)), left = Math.round(footX - 8 * s), top = Math.round(footY - 16 * s + bob);
  walk.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") rect(ctx, left + x * s - s, top + y * s - s, s * 3, s * 3, "#ffffff"); }));
  walk.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") rect(ctx, left + x * s, top + y * s, s, s, "#000000"); }));
  // Hat sits on the topmost filled rows of this Friend's own silhouette.
  const first = walk.findIndex(row => row.includes("#"));
  const span = walk.slice(first, first + 3).join("").length ? walk.slice(first, first + 3) : walk;
  let min = 16, max = 0;
  span.forEach(row => [...row].forEach((c, x) => { if (c === "#") { min = Math.min(min, x); max = Math.max(max, x); } }));
  const hatLeft = left + ((min + max + 1) / 2) * s - 6 * 2, hatTop = top + first * s - 7;
  rows(ctx, HAT, hatLeft, hatTop, 2, { h: "#f2d27a", r: "#d9604e" });
  rect(ctx, hatLeft, hatTop + 6, 24, 1, "#c9a24e");
  // Watering can, tipped towards the planter while watering.
  const dir = facing === "right" ? 1 : -1, canX = footX + dir * 20, canY = footY - 22 + bob;
  ctx.save(); ctx.translate(canX, canY); ctx.scale(dir, 1); ctx.rotate(watering * 0.55);
  rows(ctx, CAN, -8, -6, 2, { c: "#5d97b5" }); rect(ctx, -6, -4, 6, 2, "#8cc0da");
  ctx.restore();
  return { spoutX: canX + dir * (16 * Math.cos(watering * 0.55)), spoutY: canY + 14 * Math.sin(watering * 0.55) - 2 };
}

const CAT = ["#...#...", "##.##...", "#####...", "#k#k###.", "########", ".#######", ".#.#.#.#"];
function drawCat(ctx: Ctx, x: number, y: number, t: number) {
  const hop = Math.abs(Math.sin(t * 14)) * 3, legs = Math.floor(t * 14) % 2;
  rows(ctx, legs ? CAT : [...CAT.slice(0, 6), "#.#...#."], x, y - hop, 2, { "#": "#d9904a", k: INK });
  rows(ctx, ["##", ".#"], x + 16, y - hop + 4, 2, { "#": "#d9904a" });
}

function drawPlant(ctx: Ctx, L: Layout, height: number, bud: number, wiggle: number) {
  const { x, y } = L.hole;
  if (height <= 0) return;
  const top = y - height, sway = Math.round(wiggle);
  rect(ctx, x - 1 + sway / 2, top, 2, height, "#3f8f45"); rect(ctx, x + sway / 2, top, 1, height, "#6cc06a");
  if (height > 8) { rows(ctx, ["##..", ".###"], x - 5, y - height * 0.45, 1.5, { "#": "#5fae5d" }); rows(ctx, ["..##", "###."], x + 1, y - height * 0.62, 1.5, { "#": "#5fae5d" }); }
  if (bud > 0) {
    const r = Math.max(1, Math.round(3 * bud));
    disc(ctx, x + sway, top - r, r + 1, INK); disc(ctx, x + sway, top - r, r, "#9fd07a"); disc(ctx, x + sway - 1, top - r - 1, Math.max(1, r - 2), "#f3d7e6");
  }
}

function drawBloom(ctx: Ctx, L: Layout, flower: GardenFlower, t: number, still: boolean, open: number) {
  const { x, y } = L.hole, head = FLOWERS[flower].head, s = Math.max(1, Math.round(5 * open));
  const top = y - 30, w = head[0].length * s, h = head.length * s, left = Math.round(x - w / 2), headTop = Math.round(top - h);
  rect(ctx, x - 1, top, 2, 30, "#3f8f45"); rect(ctx, x, top, 1, 30, "#6cc06a");
  rows(ctx, ["##..", ".###"], x - 6, y - 16, 2, { "#": "#5fae5d" }); rows(ctx, ["..##", "###."], x + 1, y - 24, 2, { "#": "#5fae5d" });
  if (flower === "goldensun" || flower === "orchid" || flower === "moonflower") {
    // Rare blooms glow with slowly turning rays.
    ctx.save(); ctx.translate(x, headTop + h / 2); ctx.rotate(still ? 0 : t * 0.5); ctx.globalAlpha = 0.35 * open;
    ctx.fillStyle = flower === "moonflower" ? "#dfe6ff" : "#ffe27a";
    for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -46); ctx.lineTo(4, -46); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  head.forEach((row, r) => [...row].forEach((c, col) => { if (c === "#") rect(ctx, left + col * s - 1, headTop + r * s - 1, s + 2, s + 2, INK); }));
  head.forEach((row, r) => [...row].forEach((c, col) => { if (c === "#") rect(ctx, left + col * s, headTop + r * s, s, s, FLOWERS[flower].color); }));
  head.forEach((row, r) => [...row].forEach((c, col) => { if (c === "#" && (r + col) % 3 === 0) { ctx.globalAlpha = 0.45; rect(ctx, left + col * s, headTop + r * s, Math.ceil(s / 2), Math.ceil(s / 2), "#ffffff"); ctx.globalAlpha = 1; } }));
}

function drawSparkles(ctx: Ctx, cx: number, cy: number, t: number, count: number, radius: number, color: string) {
  for (let i = 0; i < count; i++) {
    const a = t * 1.8 + (i * Math.PI * 2) / count, r = radius + Math.sin(t * 3 + i) * 3;
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.7), on = (Math.floor(t * 6) + i) % 3 !== 0;
    if (on) { rect(ctx, x, y - 1, 1, 3, color); rect(ctx, x - 1, y, 3, 1, color); }
  }
}

type Props = {
  me: GenerationSprites; helper?: GenerationSprites; definition: ChanceGameDefinition;
  packets: bigint; balance: bigint; canBuy: boolean; pendingPlay?: GamePlay; busy: boolean; paused: boolean; reducedMotion: boolean; error: string;
  sow(): Promise<bigint | null>; harvest(id: bigint): Promise<GardenFlower | null>; buy(): void; sound(cue: FriendSoundCue): void; onClose(): void;
};

export function GardenVista(props: Props) {
  const { me, helper, definition, packets, balance, canBuy, pendingPlay, busy, paused, reducedMotion: still, error } = props;
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), bloomButton = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle"), [result, setResult] = useState<GardenFlower | null>(null), [leaving, setLeaving] = useState(false);
  const scene = useRef({ phase: "idle" as Phase, since: 0, result: null as GardenFlower | null, cat: -1, still });
  const pendingResult = useRef<Promise<GardenFlower | null> | null>(null), autoBloom = useRef(0);
  scene.current.still = still;
  const go = (next: Phase) => { scene.current.phase = next; scene.current.since = performance.now(); setPhase(next); };

  useEffect(() => {
    const node = canvas.current, box = wrap.current, ctx = node?.getContext("2d");
    if (!node || !box || !ctx) return;
    let frame = 0, back: HTMLCanvasElement | null = null, backH = 0;
    const render = (now: number) => {
      const H = Math.max(180, Math.round((W * box.clientHeight) / Math.max(1, box.clientWidth)));
      if (node.height !== H || node.width !== W) { node.width = W; node.height = H; }
      if (!back || backH !== H) { back = backdrop(H); backH = H; }
      const L = layout(H), t = now / 1000, s = scene.current, still = s.still, since = (now - s.since) / 1000;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(back, 0, 0);
      drawSun(ctx, t, still, L); drawClouds(ctx, t, still, L); drawWindmill(ctx, t, still, L);
      // Sometimes the cat dashes across the far field while things grow.
      if (s.cat >= 0 && !still) {
        const run = (now - s.cat) / 1000;
        if (run < 2.6) drawCat(ctx, -20 + run * 140, L.hy + (L.pt - L.hy) * 0.45, t); else s.cat = -1;
      }
      const growing = s.phase === "growing", watering = growing && since > 0.4 && since < 2.8 ? Math.min(1, (since - 0.4) * 3, (2.8 - since) * 3) : 0;
      const a = drawFarmer(ctx, me, 80, L.pt + 16, t, still, "right", watering, 0);
      const b = helper ? drawFarmer(ctx, helper, 250, L.pt + 18, t, still, "left", watering, 2) : null;
      if (watering > 0.3 && !still) for (const spout of [a, b]) {
        if (!spout) continue;
        for (let k = 0; k < 10; k++) {
          const p = ((t * 1.6 + k / 10) % 1), x = spout.spoutX + (L.hole.x - spout.spoutX) * p, y = spout.spoutY + (L.hole.y - spout.spoutY) * p - Math.sin(p * Math.PI) * 10;
          rect(ctx, x - 1, y - 1, 3, 4, "#2f6f96"); rect(ctx, x, y, 2, 3, "#9fdcff");
        }
      }
      if (s.phase === "growing") {
        if (since < 0.8) { const p = Math.min(1, since / 0.6); rect(ctx, L.hole.x - 1, L.hole.y - 40 + p * 40 - (p === 1 ? Math.abs(Math.sin(since * 20)) * 2 : 0), 2, 2, "#8a5a32"); }
        const grow = Math.max(0, Math.min(1, (since - 1.2) / 2)), bud = Math.max(0, Math.min(1, (since - 2.8) / 0.5));
        drawPlant(ctx, L, grow * 26, bud, 0);
        if (bud > 0) drawSparkles(ctx, L.hole.x, L.hole.y - 30, t, 5, 10, "#fff6b0");
      } else if (s.phase === "ready" || s.phase === "opening") {
        const wiggle = still ? 0 : Math.sin(t * 9) * 1.5;
        drawPlant(ctx, L, 26, 1 + (still ? 0 : Math.abs(Math.sin(t * 4)) * 0.3), wiggle);
        ctx.globalAlpha = still ? 0.3 : 0.2 + Math.abs(Math.sin(t * 3)) * 0.25; disc(ctx, L.hole.x, L.hole.y - 30, 14, "#fff6b0"); ctx.globalAlpha = 1;
        drawSparkles(ctx, L.hole.x, L.hole.y - 30, t, 7, 14, "#ffffff");
      }
      if ((s.phase === "opening" || s.phase === "revealed") && s.result) {
        const open = s.phase === "revealed" ? 1 : Math.min(1, since / 0.6);
        if (s.result === "moonflower") {
          // The rarest bloom brings on a starlit twilight.
          ctx.globalAlpha = 0.55 * open; rect(ctx, 0, 0, W, L.hy + 20, "#1d2150"); ctx.globalAlpha = 1;
          for (let i = 0; i < 40; i++) { const x = (i * 67) % W, y = (i * 29) % L.hy; if (still || (Math.floor(t * 3) + i) % 4) rect(ctx, x, y, 1, 1, "#fff8d8"); }
          disc(ctx, 60, Math.round(L.hy * 0.3), 7, "#f4f1d8"); disc(ctx, 63, Math.round(L.hy * 0.3) - 2, 6, "#1d2150");
        }
        drawBloom(ctx, L, s.result, t, still, open);
        if (!still && s.phase === "opening") {
          // Petal burst and a white flash as the bud bursts open.
          const burst = Math.min(1, since / 0.9);
          for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2, r = burst * 60;
            rect(ctx, L.hole.x + Math.cos(angle) * r, L.hole.y - 40 + Math.sin(angle) * r * 0.8, 3, 3, i % 2 ? FLOWERS[s.result].color : "#ffffff");
          }
          ctx.globalAlpha = Math.max(0, 0.8 - since * 1.6); rect(ctx, 0, 0, W, H, "#ffffff"); ctx.globalAlpha = 1;
        }
        drawSparkles(ctx, L.hole.x, L.hole.y - 44, t, 8, 22, s.result === "moonflower" ? "#dfe6ff" : "#fff6b0");
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [me, helper]);

  useEffect(() => {
    if (phase !== "growing") return;
    const timer = window.setTimeout(() => { go("ready"); props.sound("anticipation"); }, still ? 0 : 3400);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "ready") return;
    bloomButton.current?.focus();
    // If nobody presses Bloom, the flower opens on its own after a while.
    autoBloom.current = window.setTimeout(() => void bloom(), 20_000);
    return () => window.clearTimeout(autoBloom.current);
  }, [phase]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && (phase === "idle" || phase === "revealed") && !busy) close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [phase, busy]);

  async function plant() {
    if (paused || busy) return;
    go("planting"); props.sound("action-start");
    const id = await props.sow();
    if (id === null) { go("idle"); return; }
    pendingResult.current = props.harvest(id);
    if (Math.random() < 0.45) scene.current.cat = performance.now() + 700;
    go("growing");
  }
  async function bloom() {
    if (scene.current.phase !== "ready") return;
    window.clearTimeout(autoBloom.current);
    props.sound("impact");
    const flower = await pendingResult.current;
    pendingResult.current = null;
    if (!flower) { go("idle"); return; }
    scene.current.result = flower; setResult(flower); go("opening");
    window.setTimeout(() => {
      go("revealed");
      props.sound(flower === "moonflower" ? "reveal-legendary" : flower === "goldensun" || flower === "orchid" ? "reveal-rare" : "reveal-common");
    }, still ? 0 : 900);
  }
  function close() { setLeaving(true); window.setTimeout(props.onClose, still ? 0 : 450); }
  function again() { scene.current.result = null; setResult(null); go("idle"); void plant(); }

  const outcome = result ? definition.outcomes[outcomeOf(result) - 1] : null;
  return <div className={`rt-vista${leaving ? " rt-vista-leaving" : ""}${still ? " rt-vista-still" : ""}`} ref={wrap} role="dialog" aria-modal="true" aria-label="Community garden">
    <canvas ref={canvas} aria-hidden="true" />
    <div className="rt-vista-top">
      <div className="rt-title"><strong>Community garden</strong><span>{packets.toString()} seed packet{packets === 1n ? "" : "s"} · {rf(balance)}</span></div>
      <span className="rt-stamp">Simulated RF</span>
    </div>
    <div className="rt-vista-controls">
      <p className="rt-vista-status" role="status">{
        phase === "planting" ? "Pressing the seed into the soil…"
        : phase === "growing" ? "The farmers are watering. Something is growing…"
        : phase === "ready" ? "The bud is ready. Press Bloom when you feel lucky!"
        : phase === "opening" ? "It's opening…"
        : phase === "revealed" ? ""
        : error || (pendingPlay ? "A seed is already in the ground." : packets > 0n ? "Choose a seed packet to plant." : "No seed packets yet. Buy one here or at the stall.")}</p>
      {phase === "idle" && <div className="rt-row">
        <button type="button" className="rt-primary" disabled={paused || busy || (!pendingPlay && packets === 0n)} onClick={() => void plant()}>{pendingPlay ? "Finish growing" : "Plant a seed packet"}</button>
        <button type="button" disabled={paused || busy || !canBuy} onClick={props.buy}>Buy a packet · {rf(definition.price)}</button>
        <button type="button" disabled={busy} onClick={close}>Back to the village</button>
      </div>}
      {phase === "ready" && <button type="button" ref={bloomButton} className="rt-bloom" disabled={paused} onClick={() => void bloom()}>✿ Bloom!</button>}
      {phase === "revealed" && result && outcome && <div className="rt-vista-card">
        <h2>Something bloomed!</h2>
        <p className="rt-quote">A <strong>{FLOWERS[result].name.toLowerCase()}</strong>! <span className="rt-sim">Simulated</span></p>
        <p className="rt-hint">{outcome.chanceBps / 100}% chance · worth {rf(outcome.reward)}. Keep it for a bouquet (its value goes into the gift) or sell it at the seed stall.</p>
        <div className="rt-row">
          <button type="button" disabled={paused || busy || packets === 0n} onClick={again}>Plant another{packets > 0n ? ` (${packets})` : ""}</button>
          <button type="button" className="rt-primary" disabled={busy} onClick={close}>Lovely!</button>
        </div>
      </div>}
    </div>
  </div>;
}

