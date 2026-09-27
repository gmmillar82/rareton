/**
 * Rareton gifts are 16 × 16 one-bit pictures, the same format as Rare Friends
 * walking sprites: 256 pixels that pack into one uint256 ("gift code").
 * Everything here is local and simulated; nothing is minted or sent.
 */

export type FlowerId = "daisy" | "tulip" | "bluebell" | "poppy" | "sunflower";
export type GiftKind = "bouquet" | "letter" | "bun";
export type Inventory = Readonly<Record<FlowerId | "bun", number>>;

export type Gift = Readonly<{
  id: number;
  kind: GiftKind;
  title: string;
  message?: string;
  from: bigint;
  to: bigint;
  toFamily?: string;
  rows: readonly string[];
  code: string;
  /** Village story gifts from NPC villagers, as opposed to player sends. */
  village?: boolean;
}>;

export const FLOWERS: Readonly<Record<FlowerId, Readonly<{ name: string; color: string; head: readonly string[] }>>> = {
  daisy: { name: "Daisy", color: "#fbf7ee", head: [".#.", "#.#", ".#."] },
  tulip: { name: "Tulip", color: "#e0707a", head: ["#.#.#", "#####", ".###."] },
  bluebell: { name: "Bluebell", color: "#8aa2de", head: [".##.", "####", "#..#"] },
  poppy: { name: "Poppy", color: "#d9573f", head: [".##.", "####", "####", ".##."] },
  sunflower: { name: "Sunflower", color: "#f0c24a", head: [".###.", "#...#", "#.#.#", "#...#", ".###."] },
};
export const FLOWER_IDS = Object.keys(FLOWERS) as FlowerId[];
export const EMPTY_INVENTORY: Inventory = { daisy: 0, tulip: 0, bluebell: 0, poppy: 0, sunflower: 0, bun: 0 };

export const MESSAGES = [
  "Thinking of you, friend.",
  "Thank you for being you.",
  "Come for tea in Rareton!",
  "Happy wandering day!",
  "You make the village brighter.",
  "Save me a honey bun.",
] as const;

type Grid = boolean[][];
const blank = (): Grid => Array.from({ length: 16 }, () => Array<boolean>(16).fill(false));
const set = (grid: Grid, x: number, y: number) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) grid[y][x] = true; };
const stamp = (grid: Grid, rows: readonly string[], left: number, top: number) =>
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") set(grid, left + x, top + y); }));
const toRows = (grid: Grid) => grid.map(row => row.map(on => (on ? "#" : ".")).join(""));
export const fromRows = (rows: readonly string[]) => rows.map(row => [...row].map(pixel => pixel === "#"));

function line(grid: Grid, x0: number, y0: number, x1: number, y1: number) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    set(grid, x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
}

const WRAP = [
  "....########....",
  "...##.####.##...",
  "......####......",
  "......####......",
  ".......##.......",
];
/** Head centres for one, two or three flowers. */
const LAYOUTS = [[[8, 3]], [[4, 4], [11, 4]], [[3, 5], [8, 2], [12, 5]]] as const;

function bouquet(flowers: readonly FlowerId[]) {
  const grid = blank(), layout = LAYOUTS[Math.min(flowers.length, 3) - 1] ?? LAYOUTS[0];
  flowers.slice(0, 3).forEach((flower, index) => {
    const head = FLOWERS[flower].head, [cx, cy] = layout[index];
    const left = cx - Math.floor(head[0].length / 2), top = cy - Math.floor(head.length / 2);
    stamp(grid, head, left, top);
    line(grid, cx, top + head.length, cx < 8 ? 7 : 8, 10);
  });
  stamp(grid, WRAP, 0, 11);
  return grid;
}

const ENVELOPE = [
  "................",
  "................",
  "................",
  ".##############.",
  ".##..........##.",
  ".#.#........#.#.",
  ".#..#......#..#.",
  ".#...#....#...#.",
  ".#....#..#....#.",
  ".#.....##.....#.",
  ".#............#.",
  ".#............#.",
  ".##############.",
  "................",
  "................",
  "................",
];
const SEALS = [
  ["#.#", "###", ".#."], // heart
  [".#.", "###", ".#."], // star
  ["###", "#.#", "###"], // ring
  ["#.#", ".#.", "#.#"], // kiss
];

function letter(messageIndex: number, to: bigint) {
  const grid = fromRows(ENVELOPE);
  stamp(grid, SEALS[messageIndex % SEALS.length], 7, 9);
  // A tiny postage stamp whose pattern comes from the recipient's number.
  for (let bit = 0; bit < 6; bit++) if ((to >> BigInt(bit)) & 1n) set(grid, 11 + (bit % 3), 10 + Math.floor(bit / 3));
  return grid;
}

const BUN = [
  "................",
  "................",
  "................",
  "................",
  "......####......",
  "....########....",
  "...##########...",
  "..###.####.###..",
  "..############..",
  "..#####.######..",
  "..############..",
  "...##########...",
  ".##############.",
  "................",
  "................",
  "................",
];

export function giftArt(kind: GiftKind, flowers: readonly FlowerId[], messageIndex: number, to: bigint) {
  if (kind === "bouquet") return toRows(bouquet(flowers.length ? flowers : ["daisy"]));
  if (kind === "letter") return toRows(letter(messageIndex, to));
  return [...BUN];
}

/** Bit 0 is the top-left pixel and bit 255 the bottom-right, matching Friend sprites. */
export function giftCode(rows: readonly string[]) {
  let code = 0n;
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") code |= 1n << BigInt(y * 16 + x); }));
  return `0x${code.toString(16).padStart(64, "0")}`;
}
export const shortCode = (code: string) => `${code.slice(0, 6)}…${code.slice(-4)}`;

export function giftTitle(kind: GiftKind, flowers: readonly FlowerId[], messageIndex: number) {
  if (kind === "letter") return `Letter · “${MESSAGES[messageIndex]}”`;
  if (kind === "bun") return "Honey bun parcel";
  const names = flowers.map(flower => FLOWERS[flower].name.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0] ?? "daisy";
  return `Bouquet of ${list}`;
}

let nextGiftId = 1;
export function makeGift(kind: GiftKind, flowers: readonly FlowerId[], messageIndex: number, from: bigint, to: bigint, extra: { toFamily?: string; village?: boolean } = {}): Gift {
  const rows = giftArt(kind, flowers, messageIndex, to);
  return Object.freeze({
    id: nextGiftId++, kind, from, to, rows, code: giftCode(rows),
    title: giftTitle(kind, flowers, messageIndex),
    message: kind === "letter" ? MESSAGES[messageIndex] : undefined, ...extra,
  });
}
