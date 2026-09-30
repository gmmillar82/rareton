"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { createFriendReader, decodeGenerationSprites, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundCue, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import { RF, maximumPrize, type ChanceGameDefinition, type GameSnapshot } from "@rarefriends/friendsdk/game";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";
import {
  BUILDINGS, BOARD, CHIMNEYS, FIREFLIES, INK, LAMPS, MAILBOX, WINDOWS, CAT, DOORS, HUT, PLOT, PLOT_SLOTS, POND, SIGNPOST, SPAWN, STALL, WELL, WORLD, advance, clamp, createFlowerSpots, distance,
  paintFlower, paintGround, paintScenery, walkable, type Box, type FlowerSpot, type Point, type Scenery,
} from "./world";
import {
  EMPTY_INVENTORY, FLOWERS, FLOWER_IDS, GARDEN_IDS, MEADOW_IDS, MESSAGES, giftArt, isGarden, makeGift, outcomeOf, shortCode,
  type FlowerId, type GardenFlower, type Gift, type GiftKind, type Inventory,
} from "./gifts";
import { VILLAGERS } from "./villagers";
import { createMusic, type Music } from "./music";
import { GardenVista } from "./vista";
import { DUCKS, createBirds, paintBird, paintBunting, paintButterflies, paintCat, paintDuck, paintPuddles, paintRain, updateBird } from "./ambient";
import { VILLAGER_ART } from "./villager-art";

const reader = createFriendReader();
/** Villager artwork is baked in (see scripts/bake-villagers.mjs), so the village never waits on it. */
const VILLAGER_SPRITES: Record<number, GenerationSprites> = {};
VILLAGERS.forEach((villager, index) => {
  const art = VILLAGER_ART[villager.tokenId.toString()];
  if (art) VILLAGER_SPRITES[index] = decodeGenerationSprites(villager.tokenId, art.familyId, art.seed, art.frames);
});
const SPEED = 230, NPC_SPEED = 42, REGROW_MS = 25_000, MAX_BUNS = 3;
/** Simulated postage: every gift needs a stamp; half its price is burned, half goes to the village post fund. */
const STAMP = RF / 10n;
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;
const valueOf = (definition: ChanceGameDefinition, flower: GardenFlower) => definition.outcomes[outcomeOf(flower) - 1].reward;
const chanceOf = (definition: ChanceGameDefinition, flower: GardenFlower) => definition.outcomes[outcomeOf(flower) - 1].chanceBps / 100;
/** One village day lasts four minutes: morning, afternoon, evening, night, then dawn. */
const DAY_MS = 240_000, NIGHT_ALPHA = 0.5;
function nightness(phase: number) {
  if (phase < 0.55) return 0;
  if (phase < 0.65) return (phase - 0.55) / 0.1;
  if (phase < 0.9) return 1;
  return 1 - (phase - 0.9) / 0.1;
}
const timeOfDay = (phase: number) => phase < 0.3 ? "Morning" : phase < 0.55 ? "Afternoon" : phase < 0.65 ? "Evening" : phase < 0.9 ? "Night" : "Dawn";
const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"]);

type Target = { id: string; x: number; y: number; reach: number; label: string; lift: number; hit?: Box };
type Menu =
  | { kind: "post" | "mailbox" | "satchel" | "settings" | "board" | "stall" }
  | { kind: "garden" }
  | { kind: "bakery"; gave: boolean }
  | { kind: "well"; note?: string }
  | { kind: "chat"; npc: number; line: number; note?: string; night?: boolean }
  | null;
type Npc = { index: number; sprites: GenerationSprites; x: number; y: number; tx: number; ty: number; wait: number; facing: SpriteFacing; side: "left" | "right"; walking: boolean; alpha: number };

let worldArt: { ground: HTMLCanvasElement; scenery: Scenery[] } | null = null;
const getWorldArt = () => (worldArt ??= { ground: paintGround(), scenery: paintScenery() });

const doorArea = (b: Box): Box => ({ x: b.x - 10, y: b.y - 70, width: b.width + 20, height: b.height + 100 });
const FIXED_TARGETS: Target[] = [
  { id: "post", x: 960, y: 326, reach: 70, label: "Enter the post office", lift: 110, hit: doorArea(BUILDINGS.post) },
  { id: "bakery", x: 380, y: 556, reach: 70, label: "Visit the bakery", lift: 110, hit: doorArea(BUILDINGS.bakery) },
  { id: "mailbox", x: MAILBOX.x, y: MAILBOX.y + 20, reach: 60, label: "Check your mailbox", lift: 105, hit: { x: MAILBOX.x - 30, y: MAILBOX.y - 75, width: 60, height: 95 } },
  { id: "board", x: BOARD.x, y: BOARD.y + 22, reach: 70, label: "Read the notice board", lift: 125, hit: { x: BOARD.x - 50, y: BOARD.y - 95, width: 100, height: 120 } },
  { id: "stall", x: STALL.x, y: STALL.y + 30, reach: 75, label: "Visit the seed stall", lift: 130, hit: { x: STALL.x - 70, y: STALL.y - 120, width: 140, height: 125 } },
  { id: "garden", x: PLOT.x + PLOT.width / 2, y: PLOT.y + PLOT.height + 22, reach: 95, label: "Plant a seed in the garden", lift: 100, hit: { x: PLOT.x - 10, y: PLOT.y - 30, width: PLOT.width + 20, height: PLOT.height + 40 } },
  { id: "sign", x: SIGNPOST.x, y: SIGNPOST.y + 24, reach: 70, label: "Read the signpost", lift: 105, hit: { x: SIGNPOST.x - 85, y: SIGNPOST.y - 102, width: 170, height: 110 } },
  { id: "cat", x: CAT.x, y: CAT.y + 24, reach: 60, label: "Pet the cat", lift: 45, hit: { x: CAT.x - 24, y: CAT.y - 34, width: 50, height: 44 } },
  { id: "well", x: WELL.x, y: WELL.y + 26, reach: 80, label: "Make a wish at the well", lift: 160, hit: { x: WELL.x - 60, y: WELL.y - 130, width: 120, height: 160 } },
];
const inside = (p: Point, b: Box) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
const countOf = (inventory: Inventory) => Object.values(inventory).reduce((total, amount) => total + amount, 0);

function paintFriend(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number) {
  const left = Math.round(x) - 40, top = Math.round(y) - 75;
  ctx.fillStyle = "#fff";
  rows.forEach((row, r) => [...row].forEach((pixel, c) => { if (pixel === "#") ctx.fillRect(left + c * 5 - 5, top + r * 5 - 5, 15, 15); }));
  ctx.fillStyle = "#000";
  rows.forEach((row, r) => [...row].forEach((pixel, c) => { if (pixel === "#") ctx.fillRect(left + c * 5, top + r * 5, 5, 5); }));
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = "bold 13px ui-monospace, monospace";
  const w = Math.ceil(ctx.measureText(text).width) + 14;
  ctx.fillStyle = INK; ctx.fillRect(Math.round(x - w / 2) - 2, y - 2, w + 4, 24);
  ctx.fillStyle = "#f7efd9"; ctx.fillRect(Math.round(x - w / 2), y, w, 20);
  ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 11);
}

/** Crisp one-bit pixel art for menus, optionally with the canonical white halo. */
function PixelArt({ rows, scale = 6, halo = false, color, label }: { rows: readonly string[]; scale?: number; halo?: boolean; color?: string; label: string }) {
  const width = rows[0]?.length ?? 16, height = rows.length;
  let ink = "", glow = "";
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel !== "#") return;
    ink += `M${x} ${y}h1v1h-1z`;
    if (halo || color) glow += `M${x - 1} ${y - 1}h3v3h-3z`;
  }));
  return <svg className="rt-pixels" role="img" aria-label={label} viewBox={`-1 -1 ${width + 2} ${height + 2}`}
    width={(width + 2) * scale} height={(height + 2) * scale} shapeRendering="crispEdges">
    {(halo || color) && <path d={glow} fill={color ? "#1d1b17" : "#fff"} />}<path d={ink} fill={color ?? "#1d1b17"} />
  </svg>;
}

function flowerIcon(flower: FlowerId) {
  const head = FLOWERS[flower].head, pad = Math.floor((7 - head[0].length) / 2);
  return [...Array(Math.floor((7 - head.length) / 2)).fill("......."), ...head.map(row => ".".repeat(pad) + row + ".".repeat(7 - pad - row.length))];
}
const BUN_ICON = ["..###..", ".#####.", "##.#.##", "#######", ".#####.", "#######"];

function GiftCard({ gift }: { gift: Gift }) {
  return <div className="rt-gift">
    <PixelArt rows={gift.rows} scale={3} label={gift.title} />
    <div>
      <strong>{gift.title}</strong>
      <small>From Friend #{gift.from.toString()} to Friend #{gift.to.toString()}{gift.toFamily ? ` (${gift.toFamily})` : ""}</small>
      {gift.carries ? <small>Carries {rf(gift.carries)} of garden flowers</small> : null}
      <small>Gift code <code>{shortCode(gift.code)}</code>{gift.stamp ? ` · ${rf(gift.stamp)} stamp` : ""} · <span className="rt-sim">Simulated</span></small>
    </div>
  </div>;
}

function PostOffice({ friendId, inventory, paused, balance, definition, onSend, onDone }: {
  friendId: bigint; inventory: Inventory; paused: boolean; balance: bigint; definition: ChanceGameDefinition;
  onSend: (gift: Gift, spend: Partial<Record<FlowerId | "bun", number>>) => void; onDone: () => void;
}) {
  const [kind, setKind] = useState<GiftKind>("bouquet"), [picks, setPicks] = useState<FlowerId[]>([]), [message, setMessage] = useState(0);
  const [address, setAddress] = useState(""), [recipient, setRecipient] = useState<GenerationSprites | null>(null);
  const [looking, setLooking] = useState(false), [problem, setProblem] = useState(""), [sentGift, setSentGift] = useState<Gift | null>(null);
  const request = useRef(0);
  const left = (flower: FlowerId) => inventory[flower] - picks.filter(pick => pick === flower).length;
  const ready = kind === "bouquet" ? picks.length > 0 : kind === "bun" ? inventory.bun > 0 : true;
  const canStamp = balance >= STAMP;
  const carries = kind === "bouquet" ? picks.reduce((total, pick) => total + (isGarden(pick) ? valueOf(definition, pick) : 0n), 0n) : 0n;

  // Look the Friend up shortly after typing stops; Find (or Enter) looks up immediately.
  useEffect(() => {
    if (!address.trim()) return;
    const timer = window.setTimeout(() => void find(address), 600);
    return () => window.clearTimeout(timer);
  }, [address]);

  async function find(value: string) {
    const digits = value.trim().replace(/^#/, "");
    const version = ++request.current;
    setRecipient(null); setLooking(false);
    if (!/^\d{1,7}$/.test(digits) || BigInt(digits) < 1n) { setProblem("Enter a Friend number, like 42."); return; }
    const id = BigInt(digits);
    if (id === friendId) { setProblem("That's your own Friend! Choose someone else to surprise."); return; }
    setLooking(true); setProblem("");
    try {
      const sprites = await reader.read(id);
      if (version === request.current) setRecipient(sprites);
    } catch {
      if (version === request.current) setProblem("Couldn't load that Friend's artwork. Check your connection and try again.");
    } finally { if (version === request.current) setLooking(false); }
  }

  const hasFlowers = FLOWER_IDS.some(flower => inventory[flower] > 0);
  const blocker = !ready ? (kind === "bouquet"
      ? hasFlowers ? "Tap a flower on the left to add it to the bouquet." : "No flowers yet. Pick some in the meadow, or send a letter instead."
      : "You need a honey bun from Bramble's bakery first.")
    : looking ? "Finding that Friend…" : !recipient ? "Type the number of the Friend you're sending to."
    : !canStamp ? `Not enough RF for a ${rf(STAMP)} stamp. Sell a garden flower at the seed stall.` : "Ready to send!";

  function send() {
    if (!recipient || !ready || !canStamp || paused) return;
    const gift = makeGift(kind, picks, message, friendId, recipient.tokenId, { toFamily: recipient.familyName, carries: carries || undefined, stamp: STAMP });
    const spend: Partial<Record<FlowerId | "bun", number>> = {};
    if (kind === "bouquet") for (const pick of picks) spend[pick] = (spend[pick] ?? 0) + 1;
    if (kind === "bun") spend.bun = 1;
    onSend(gift, spend); setSentGift(gift); setPicks([]);
  }

  if (sentGift) return <>
    <div className="rt-postcard">
      <PixelArt rows={sentGift.rows} scale={7} label={sentGift.title} />
      <div>
        <h3>On its way! <span className="rt-sim">Simulated</span></h3>
        <p>{sentGift.title}</p>
        <p>From Friend #{friendId.toString()} to Friend #{sentGift.to.toString()} ({sentGift.toFamily})</p>
        {sentGift.carries ? <p>Carries {rf(sentGift.carries)} of garden flowers</p> : null}
        <p>Postage {rf(STAMP)} ({rf(STAMP / 2n)} burned, {rf(STAMP / 2n)} to the village post fund)</p>
        <p>Gift code <code>{shortCode(sentGift.code)}</code></p>
      </div>
    </div>
    <p className="rt-banner"><strong>Practice post:</strong> nothing was minted and nothing left your wallet. There was no transaction,
      no signature and no real fee. The stamp and any garden flowers came out of your simulated balance. In a future version,
      this step could burn the stamp in RF, mint the 16 × 16 gift on Robinhood Chain and deliver it, with any RF-backed flowers,
      to Friend #{sentGift.to.toString()}'s wallet.</p>
    <div className="rt-row">
      <button type="button" disabled={paused} onClick={() => setSentGift(null)}>Send another</button>
      <button type="button" className="rt-primary" disabled={paused} onClick={onDone}>Back to the village</button>
    </div>
  </>;

  const to = recipient?.tokenId ?? 0n;
  return <>
    <p className="rt-banner"><strong>Practice post (simulated):</strong> no NFT is minted, no wallet prompt appears and nothing is sent on-chain.
      Stamps cost {rf(STAMP)} of simulated RF.</p>
    <div className="rt-post">
      <div className="rt-steps">
        <fieldset>
          <legend>1 · Choose a gift</legend>
          <div className="rt-row" role="group" aria-label="Gift type">
            {(["bouquet", "letter", "bun"] as const).map(option => <button key={option} type="button" aria-pressed={kind === option} disabled={paused}
              onClick={() => setKind(option)}>{option === "bouquet" ? "Bouquet" : option === "letter" ? "Letter" : `Honey bun (${inventory.bun})`}</button>)}
          </div>
          {kind === "bouquet" && (FLOWER_IDS.some(flower => inventory[flower] > 0) ? <>
            <p className="rt-hint">Tap up to three flowers from your satchel.</p>
            <div className="rt-row">{FLOWER_IDS.filter(flower => inventory[flower] > 0).map(flower =>
              <button key={flower} type="button" className="rt-chip" disabled={paused || picks.length >= 3 || left(flower) <= 0}
                onClick={() => setPicks([...picks, flower])}>+ {FLOWERS[flower].name} <small>{left(flower)}{isGarden(flower) ? ` · ${rf(valueOf(definition, flower))}` : ""}</small></button>)}</div>
            {picks.length > 0 && <div className="rt-row">{picks.map((pick, index) =>
              <button key={`${pick}-${index}`} type="button" className="rt-chip rt-picked" disabled={paused} aria-label={`Remove ${FLOWERS[pick].name}`}
                onClick={() => setPicks(picks.filter((_, i) => i !== index))}>{FLOWERS[pick].name} ×</button>)}</div>}
            {carries > 0n && <p className="rt-hint">Garden flowers carry their value: {rf(carries)} travels with this bouquet.</p>}
          </> : <p className="rt-hint">No flowers yet. Pick some in the east meadow or by the pond, or grow them from seed.</p>)}
          {kind === "letter" && <label className="rt-field">Message
            <select value={message} disabled={paused} onChange={event => setMessage(Number(event.target.value))}>
              {MESSAGES.map((text, index) => <option key={text} value={index}>{text}</option>)}
            </select></label>}
          {kind === "bun" && <p className="rt-hint">{inventory.bun > 0 ? "One warm honey bun, wrapped in paper." : "No buns yet. Bramble's bakery gives them away."}</p>}
        </fieldset>
        <fieldset>
          <legend>2 · Address it</legend>
          <form className="rt-row" onSubmit={event => { event.preventDefault(); void find(address); }}>
            <label className="rt-field rt-grow">Friend number
              <input value={address} inputMode="numeric" autoComplete="off" placeholder="e.g. 42" maxLength={8} disabled={paused}
                onChange={event => { setAddress(event.target.value); setRecipient(null); setProblem(""); }} /></label>
            <button type="submit" disabled={paused || looking || !address.trim()}>{looking ? "Finding…" : "Find"}</button>
          </form>
          <p className="rt-hint" role={problem ? "alert" : "status"}>{problem || (recipient
            ? `Addressed to Friend #${recipient.tokenId} · ${recipient.familyName}`
            : "Any Rare Friends Generations number. Not verified in this preview.")}</p>
        </fieldset>
      </div>
      <div className="rt-envelope" aria-label="Gift preview">
        <PixelArt rows={giftArt(kind, picks, message, to)} scale={7} label="Your gift, as 16 by 16 pixel art" />
        <div className="rt-to">
          {recipient ? <PixelArt rows={spriteFrame(recipient, "down", false, 0).frame.rows} scale={2} halo label={`Friend #${recipient.tokenId}`} />
            : <span className="rt-to-empty" aria-hidden="true">?</span>}
          <span>To: {recipient ? `Friend #${recipient.tokenId}` : "…"}</span>
        </div>
        <button type="button" className="rt-primary" disabled={paused || !ready || !recipient || !canStamp} onClick={send}>Stamp &amp; send · {rf(STAMP)} (simulated)</button>
        <p className="rt-hint rt-blocker" role="status">{blocker}</p>
      </div>
    </div>
  </>;
}

/** Rareton: a cosy walkable village. The SDK runtime supplies the verified Friend; gifts are simulated. */
export default function Rareton({ friendId, client, paused }: GameComponentProps) {
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Opening the village gates…"), [failed, setFailed] = useState(false), [revision, setRevision] = useState(0);
  const [me, setMe] = useState<GenerationSprites | null>(null);
  const villagerArt = VILLAGER_SPRITES;
  const [menu, setMenu] = useState<Menu>(null), [near, setNear] = useState<Target | null>(null);
  const [inventory, setInventory] = useState<Inventory>(EMPTY_INVENTORY);
  const [received, setReceived] = useState<Gift[]>([]), [sent, setSent] = useState<Gift[]>([]), [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(""), [muted, setMuted] = useState(true), [reducedMotion, setReducedMotion] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const [gifted, setGifted] = useState<Record<GardenFlower, number>>({ clover: 0, rose: 0, lily: 0, orchid: 0, goldensun: 0, moonflower: 0 });
  const [stamps, setStamps] = useState(0), [dayNight, setDayNight] = useState(true), [weather, setWeather] = useState(true), [musicOn, setMusicOn] = useState(false), [isNight, setIsNight] = useState(false), [clock, setClock] = useState("Morning");
  const locked = useRef(false), epoch = useRef(0), garden = useRef<{ blooms: FlowerId[]; sprouts: number }>({ blooms: [], sprouts: 0 });

  const sound = useRef<FriendSoundKit | null>(null), toastTimer = useRef(0), music = useRef<Music | null>(null);
  const position = useRef<Point>({ ...SPAWN }), keys = useRef(new Set<string>()), destination = useRef<Point | null>(null);
  const pending = useRef<string | null>(null), camera = useRef<Point>({ x: 0, y: 0 }), view = useRef({ width: 960, height: 640, zoom: 1, dpr: 1 });
  const targets = useRef<Target[]>([]), nearRef = useRef<Target | null>(null), flowers = useRef<FlowerSpot[]>(createFlowerSpots());
  const talked = useRef(new Set<number>()), wished = useRef(false);
  const live = useRef({ paused, menu, reducedMotion, dayNight, weather, ready: false });
  live.current = { paused, menu, reducedMotion, dayNight, weather, ready: !status };

  const stop = () => { keys.current.clear(); destination.current = null; pending.current = null; };
  const play = (cue: FriendSoundCue) => { sound.current?.play(cue); };
  const say = (text: string) => {
    setToast(text); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };
  const add = (item: FlowerId | "bun", amount = 1) => setInventory(current => ({ ...current, [item]: current[item] + amount }));

  // Garden flowers live in the SDK's simulated ledger; gifted ones are set aside locally.
  const definition = client.definition;
  const bag: Record<FlowerId | "bun", number> = { ...inventory };
  GARDEN_IDS.forEach((flower, index) => { bag[flower] = Number(snapshot?.inventory[index] ?? 0n) - gifted[flower]; });
  const balance = (snapshot?.rfBalance ?? 0n) - BigInt(stamps) * STAMP;
  const pendingPlay = snapshot?.plays.find(play => play.outcomeId === null);
  const canBuy = Boolean(snapshot) && balance >= definition.price && (snapshot?.freeStake ?? 0n) >= maximumPrize(definition);
  garden.current = {
    blooms: GARDEN_IDS.flatMap(flower => Array<FlowerId>(Math.max(0, bag[flower])).fill(flower)).slice(0, PLOT_SLOTS.length),
    sprouts: (pendingPlay ? 1 : 0),
  };

  /** Run one SDK action (the runtime shows its own confirmation), then refresh the ledger. */
  async function act(work: () => Promise<void>) {
    if (locked.current || paused) return;
    const version = epoch.current;
    locked.current = true; setBusy(true); setActionError("");
    try {
      await work();
      const next = await client.read();
      if (version === epoch.current) setSnapshot(next);
    } catch (cause) {
      if (version === epoch.current) {
        setActionError(cause instanceof Error ? cause.message : "That didn't work. Please try again.");
        void client.read().then(next => { if (version === epoch.current) setSnapshot(next); }).catch(() => {});
      }
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  /** Plant one packet (the runtime confirms it); returns the play to settle, or null if it didn't happen. */
  async function sow() {
    const out = { id: null as bigint | null };
    await act(async () => { out.id = (pendingPlay ?? (await client.play(1n))[0]).id; });
    return out.id;
  }
  /** Settle a planted packet. The SDK decides the flower; the vista chooses when to show it. */
  async function harvest(id: bigint) {
    const out = { bloom: null as GardenFlower | null };
    await act(async () => {
      const settled = await client.settle(id);
      if (settled.outcomeId !== null) out.bloom = GARDEN_IDS[settled.outcomeId - 1];
    });
    return out.bloom;
  }

  function interact(target: Target) {
    if (paused || live.current.menu) return;
    const [type, index] = target.id.split(":");
    if (type === "cat") { play("select"); say("Purrrr… The cat stretches, blinks at you and goes back to sleep."); return; }
    if (type === "sign") { play("select"); say("West to the Whispering Woods. Starbells open in the stone circle after dark."); return; }
    if (type === "flower") {
      const spot = flowers.current[Number(index)];
      if (!spot || spot.bloomAt > performance.now()) return;
      spot.bloomAt = performance.now() + REGROW_MS;
      add(spot.flower); play("select"); say(`You picked a ${FLOWERS[spot.flower].name.toLowerCase()}.`);
      return;
    }
    stop();
    if (type === "npc" || type === "door") {
      const npc = Number(index), villager = VILLAGERS[npc], night = type === "door";
      let note: string | undefined;
      if (!talked.current.has(npc)) {
        talked.current.add(npc);
        if (villager.gift?.flower) add(villager.gift.flower);
        if (villager.gift?.bouquet) {
          setReceived(list => [makeGift("bouquet", villager.gift!.bouquet!, 0, villager.tokenId, friendId, { village: true }), ...list]);
          setUnread(count => count + 1);
        }
        note = villager.giftNote;
      }
      if (night && villager.house === "bakery" && inventory.bun < MAX_BUNS) {
        add("bun"); note = [note, "Bramble passes a warm bun through the door."].filter(Boolean).join(" ");
      }
      play("action-start"); setMenu({ kind: "chat", npc, line: 0, note, night });
    } else if (type === "bakery") {
      const gave = inventory.bun < MAX_BUNS;
      if (gave) { add("bun"); play("reward"); }
      setMenu({ kind: "bakery", gave });
    } else if (type === "well") {
      let note: string | undefined;
      if (!wished.current) { wished.current = true; add("daisy"); note = "A daisy floats up from the water. You tuck it into your satchel."; }
      play("reveal-common"); setMenu({ kind: "well", note });
    } else {
      if (type === "mailbox") setUnread(0);
      setActionError("");
      play("select"); setMenu(type === "garden" ? { kind: "garden" } : { kind: type as "post" | "mailbox" | "board" | "stall" });
    }
  }
  const actions = useRef(interact); actions.current = interact;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(preference.matches); change();
    preference.addEventListener("change", change);
    sound.current = createFriendSoundKit({ muted: true });
    music.current = createMusic();
    const hidden = () => music.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      preference.removeEventListener("change", change); document.removeEventListener("visibilitychange", hidden);
      sound.current?.dispose(); sound.current = null; music.current?.dispose(); music.current = null; window.clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => { if (paused || menu) stop(); }, [paused, menu]);
  // Music keeps playing through runtime dialogs (like purchase confirmations); it only pauses with a hidden tab.

  // Keep the canvas backing store matched to its on-screen size.
  useEffect(() => {
    const node = wrap.current, surface = canvas.current;
    if (!node || !surface) return;
    const resize = () => {
      const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight), dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.current = { width, height, dpr, zoom: clamp(Math.max(width / 960, height / 640), 0.55, 1.6) };
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Keyboard input lives on the child window so players need not focus the canvas first.
  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest("input, select, textarea"));
    const down = (event: KeyboardEvent) => {
      const state = live.current;
      if (state.paused || state.menu || !state.ready || editable(event.target)) return;
      const key = event.key.toLowerCase();
      if (MOVE_KEYS.has(key)) { event.preventDefault(); keys.current.add(key); destination.current = null; pending.current = null; }
      else if (key === "e" && !event.repeat && nearRef.current) { event.preventDefault(); actions.current(nearRef.current); }
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.key.toLowerCase()); };
    const hidden = () => stop();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("blur", hidden); document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", hidden); document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  useEffect(() => {
    const surface = canvas.current, ctx = surface?.getContext("2d");
    if (!surface || !ctx) { setFailed(true); setStatus("This browser can't draw the village."); return; }
    let cancelled = false, frame = 0, previous = 0, lastNear = "", lastClock = "", lastNight = false, dayTime = DAY_MS * 0.05;
    // Weather: an occasional 45-second shower, the first about a minute and a half in.
    let elapsed = 0, rainStart = -1, rainEnd = 0, nextRain = 90_000, rainLevel = 0, wetness = 0;
    const birds = createBirds();
    let facing: SpriteFacing = "down", side: "left" | "right" = "right";
    const npcs: Npc[] = [];
    position.current = { ...SPAWN }; stop(); flowers.current = createFlowerSpots(); talked.current = new Set(); wished.current = false;
    setMenu(null); setNear(null); nearRef.current = null; setFailed(false); setStatus("Opening the village gates…");
    setInventory(EMPTY_INVENTORY); setSent([]); setUnread(1);
    epoch.current++; locked.current = false; setBusy(false); setActionError(""); setSnapshot(null); setStamps(0);
    setGifted({ clover: 0, rose: 0, lily: 0, orchid: 0, goldensun: 0, moonflower: 0 });
    setReceived([makeGift("letter", [], 2, VILLAGERS[1].tokenId, friendId, { village: true })]);

    for (const [key, sprites] of Object.entries(VILLAGER_SPRITES)) {
      const index = Number(key), home = VILLAGERS[index].home;
      npcs.push({ index, sprites, x: home.x, y: home.y, tx: home.x, ty: home.y, wait: 1 + index, facing: "down", side: "right", walking: false, alpha: 1 });
    }

    void Promise.all([reader.read(friendId), client.read()]).then(([sprites, snapshot]) => {
      if (cancelled) return;
      if (snapshot.friendId !== friendId) throw new Error("Game session does not match the selected Friend.");
      const { ground, scenery } = getWorldArt();
      setSnapshot(snapshot); setMe(sprites); setStatus("");

      const render = (now: number) => {
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0; previous = now;
        const state = live.current, active = !state.paused && !state.menu && !document.hidden;
        // Village time only passes while the village is visible and not paused by the runtime.
        if (!state.paused && !document.hidden) dayTime += dt * 1000;
        const phase = (dayTime % DAY_MS) / DAY_MS, dark = state.dayNight ? nightness(phase) : 0;
        if (!state.paused && !document.hidden) elapsed += dt * 1000;
        if (state.weather && elapsed >= nextRain && elapsed > rainEnd) {
          rainStart = elapsed; rainEnd = elapsed + 45_000; nextRain = rainEnd + 120_000 + Math.random() * 120_000;
        }
        const raining = state.weather && elapsed >= rainStart && elapsed < rainEnd && rainStart >= 0;
        rainLevel = clamp(rainLevel + (raining ? dt : -dt) / 5, 0, 1);
        wetness = clamp(wetness + (raining ? dt / 8 : -dt / (state.weather ? 40 : 3)), 0, 1);
        const still = state.reducedMotion, t = now / 1000, daylife = dark < 0.4 && rainLevel < 0.5;
        const label = [state.dayNight ? timeOfDay(phase) : "", rainLevel > 0.5 ? "Rain" : ""].filter(Boolean).join(" · ");
        if (label !== lastClock) { lastClock = label; setClock(label); }
        const nightNow = dark > 0.6;
        if (nightNow !== lastNight) { lastNight = nightNow; setIsNight(nightNow); }
        music.current?.setNight(dark > 0.5);
        const p = position.current, before = { ...p };
        const { width, height, zoom, dpr } = view.current, vw = width / zoom, vh = height / zoom;

        if (active) {
          const held = (a: string, b: string) => keys.current.has(a) || keys.current.has(b);
          let dx = Number(held("d", "arrowright")) - Number(held("a", "arrowleft"));
          let dy = Number(held("s", "arrowdown")) - Number(held("w", "arrowup"));
          let travel = SPEED * dt;
          if (!dx && !dy && destination.current) {
            dx = destination.current.x - p.x; dy = destination.current.y - p.y;
            travel = Math.min(travel, Math.hypot(dx, dy));
            if (Math.hypot(dx, dy) < 2) { destination.current = null; dx = 0; dy = 0; }
          }
          if (dx || dy) {
            const length = Math.hypot(dx, dy);
            advance(p, (dx / length) * travel, (dy / length) * travel);
            facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
            if (facing === "left" || facing === "right") side = facing;
            if (destination.current && distance(before, p) < 0.05) destination.current = null;
          }
        }

        for (const npc of npcs) {
          const toPlayer = distance(npc, p);
          npc.walking = false;
          // Villagers head indoors at dusk and come back out at dawn.
          if (!state.paused) {
            if (dark > 0.6) npc.alpha = Math.max(0, npc.alpha - dt / 1.5);
            else if (npc.alpha < 1) {
              if (npc.alpha === 0) { const home = VILLAGERS[npc.index].home; Object.assign(npc, { x: home.x, y: home.y, tx: home.x, ty: home.y, wait: 2 }); }
              npc.alpha = Math.min(1, npc.alpha + dt / 1.5);
            }
          }
          if (!active || npc.alpha < 1) continue;
          if (toPlayer < 120) {
            const dx = p.x - npc.x, dy = p.y - npc.y;
            npc.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
            if (npc.facing === "left" || npc.facing === "right") npc.side = npc.facing;
            continue;
          }
          if (npc.wait > 0) { npc.wait -= dt; continue; }
          const dx = npc.tx - npc.x, dy = npc.ty - npc.y, length = Math.hypot(dx, dy);
          if (length < 3) {
            npc.wait = 2 + Math.random() * 4;
            const home = VILLAGERS[npc.index].home;
            for (let attempt = 0; attempt < 8; attempt++) {
              const next = { x: home.x + (Math.random() - 0.5) * 150, y: home.y + (Math.random() - 0.5) * 110 };
              if (walkable(next, 16)) { npc.tx = next.x; npc.ty = next.y; break; }
            }
            continue;
          }
          const was = { x: npc.x, y: npc.y }, step = Math.min(length, NPC_SPEED * dt);
          advance(npc, (dx / length) * step, (dy / length) * step, 16);
          if (distance(was, npc) < 0.01) { npc.tx = npc.x; npc.ty = npc.y; }
          npc.walking = true;
          npc.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
          if (npc.facing === "left" || npc.facing === "right") npc.side = npc.facing;
        }

        const clock = performance.now();
        // Starbells only open at night; everything else is open once it has regrown.
        const open = (spot: FlowerSpot) => spot.bloomAt <= clock && (spot.flower !== "starbell" || dark > 0.5);
        const indoors = npcs.filter(npc => npc.alpha === 0);
        const list: Target[] = FIXED_TARGETS.filter(target => !(target.id === "bakery" && indoors.some(npc => VILLAGERS[npc.index].house === "bakery")));
        for (const npc of indoors) {
          const villager = VILLAGERS[npc.index];
          if (villager.house === "post") continue; // the post office stays open all night
          const door = DOORS[villager.house], building = villager.house === "hut" ? HUT : BUILDINGS[villager.house];
          list.push({ id: `door:${npc.index}`, x: door.x, y: door.y, reach: 70, label: `Knock on ${villager.name}'s door`, lift: 110, hit: doorArea(building) });
        }
        flowers.current.forEach((spot, index) => {
          if (open(spot)) list.push({ id: `flower:${index}`, x: spot.x, y: spot.y, reach: 55, label: `Pick the ${FLOWERS[spot.flower].name.toLowerCase()}`, lift: 45 });
        });
        for (const npc of npcs) if (npc.alpha === 1) list.push({ id: `npc:${npc.index}`, x: npc.x, y: npc.y, reach: 90, label: `Talk to ${VILLAGERS[npc.index].name}`, lift: 100 });
        targets.current = list;

        if (active && pending.current) {
          const goal = list.find(target => target.id === pending.current);
          if (!goal) pending.current = null;
          else if (distance(p, goal) <= goal.reach) { pending.current = null; destination.current = null; actions.current(goal); }
          else if (!destination.current) pending.current = null;
        }
        if (active) {
          let best: Target | null = null, score = Infinity;
          for (const target of list) {
            const d = distance(p, target) / target.reach;
            if (d <= 1 && d < score) { best = target; score = d; }
          }
          const key = best ? `${best.id}|${best.label}` : "";
          if (key !== lastNear) { lastNear = key; nearRef.current = best; setNear(best); }
        }

        camera.current = {
          x: Math.round(vw >= WORLD.width ? WORLD.x + (WORLD.width - vw) / 2 : clamp(p.x - vw / 2, WORLD.x, WORLD.x + WORLD.width - vw)),
          y: Math.round(vh >= WORLD.height ? (WORLD.height - vh) / 2 : clamp(p.y - vh / 2, 0, WORLD.height - vh)),
        };
        const cam = camera.current, scale = zoom * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#b9c48f"; ctx.fillRect(0, 0, surface.width, surface.height);
        ctx.setTransform(scale, 0, 0, scale, -cam.x * scale, -cam.y * scale);
        ctx.imageSmoothingEnabled = false;
        const visible = (x: number, y: number, w: number, h: number) => x < cam.x + vw && x + w > cam.x && y < cam.y + vh && y + h > cam.y;
        const sx = Math.max(WORLD.x, cam.x), sy = Math.max(0, cam.y);
        const sw = Math.min(WORLD.x + WORLD.width - sx, vw + 2), sh = Math.min(WORLD.height - sy, vh + 2);
        ctx.drawImage(ground, sx - WORLD.x, sy, sw, sh, sx, sy, sw, sh);
        paintPuddles(ctx, wetness, t, raining, still);
        if (visible(POND.x - POND.rx, POND.y - POND.ry, POND.rx * 2, POND.ry * 2)) DUCKS.forEach((_, i) => paintDuck(ctx, i, t, still, dark > 0.6));

        if (destination.current) {
          ctx.strokeStyle = INK; ctx.lineWidth = 3;
          ctx.strokeRect(Math.round(destination.current.x) - 8, Math.round(destination.current.y) - 5, 16, 10);
        }
        const layers: { depth: number; draw: () => void }[] = [];
        for (const item of scenery) {
          if (visible(item.x, item.y, item.canvas.width, item.canvas.height)) layers.push({ depth: item.depth, draw: () => ctx.drawImage(item.canvas, item.x, item.y) });
        }
        for (const spot of flowers.current) {
          if (visible(spot.x - 20, spot.y - 50, 40, 55)) layers.push({ depth: spot.y, draw: () => paintFlower(ctx, spot, open(spot)) });
        }
        const plot = garden.current;
        PLOT_SLOTS.forEach((slot, index) => {
          if (index < plot.blooms.length) layers.push({ depth: slot.y, draw: () => paintFlower(ctx, { ...slot, flower: plot.blooms[index], bloomAt: 0 }, true) });
          else if (index < plot.blooms.length + plot.sprouts) layers.push({ depth: slot.y, draw: () => paintFlower(ctx, { ...slot, flower: "clover", bloomAt: 0 }, false) });
        });
        layers.push({ depth: CAT.y, draw: () => paintCat(ctx, now, still) });
        for (const bird of birds) {
          if (active && daylife) updateBird(bird, p, now, dt, still);
          if (daylife && visible(bird.x - 20, bird.y - 30, 40, 40)) layers.push({ depth: bird.y, draw: () => paintBird(ctx, bird, now) });
        }
        const pose = (walking: boolean) => state.reducedMotion ? 0 : Math.floor(now / (walking ? 110 : 190)) % 8;
        for (const npc of npcs) {
          if (npc.alpha === 0 || !visible(npc.x - 45, npc.y - 80, 90, 90)) continue;
          const rows = spriteFrame(npc.sprites, npc.facing, npc.walking, pose(npc.walking), npc.side).frame.rows;
          const alpha = npc.alpha;
          layers.push({ depth: npc.y, draw: () => { ctx.globalAlpha = alpha; paintFriend(ctx, rows, npc.x, npc.y); ctx.globalAlpha = 1; } });
        }
        const moving = distance(before, p) > 0.05;
        const mine = spriteFrame(sprites, facing, moving, pose(moving), side).frame.rows;
        layers.push({ depth: p.y + 0.5, draw: () => paintFriend(ctx, mine, p.x, p.y) });
        layers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.draw());
        if (visible(760, 440, 400, 280)) paintBunting(ctx, t, still);
        if (daylife) paintButterflies(ctx, t, still, (x, y) => visible(x - 10, y - 10, 20, 20));

        ctx.fillStyle = "#fbf7eecc";
        for (const chimney of CHIMNEYS) {
          if (!visible(chimney.x - 30, chimney.y - 80, 60, 90)) continue;
          for (let puff = 0; puff < 3; puff++) {
            const t = state.reducedMotion ? puff * 0.7 : ((now / 1000 + puff * 0.8) % 2.4);
            const size = Math.round(12 - t * 3);
            ctx.fillRect(Math.round(chimney.x + Math.sin(t * 2) * 6 - size / 2), Math.round(chimney.y - 10 - t * 26), size, size);
          }
        }
        paintRain(ctx, rainLevel, t, still, cam, vw, vh);
        if (dark > 0) {
          ctx.fillStyle = `rgba(24, 28, 72, ${(dark * NIGHT_ALPHA).toFixed(3)})`;
          ctx.fillRect(cam.x, cam.y, vw, vh);
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          for (const lamp of LAMPS) {
            if (!visible(lamp.x - 90, lamp.y - 180, 180, 200)) continue;
            const glow = ctx.createRadialGradient(lamp.x, lamp.y - 88, 4, lamp.x, lamp.y - 88, 90);
            glow.addColorStop(0, `rgba(255, 205, 120, ${(0.45 * dark).toFixed(3)})`); glow.addColorStop(1, "rgba(255, 205, 120, 0)");
            ctx.fillStyle = glow; ctx.fillRect(lamp.x - 90, lamp.y - 178, 180, 180);
          }
          ctx.restore();
          for (const w of WINDOWS) {
            if (!visible(w.x, w.y, w.width, w.height)) continue;
            ctx.fillStyle = `rgba(255, 214, 120, ${(0.9 * dark).toFixed(3)})`; ctx.fillRect(w.x, w.y, w.width, w.height);
            ctx.fillStyle = INK; ctx.fillRect(w.x + 15, w.y, 4, w.height); ctx.fillRect(w.x, w.y + 12, w.width, 4);
          }
          ctx.save(); ctx.globalCompositeOperation = "lighter";
          for (const spot of flowers.current) {
            if (spot.flower !== "starbell" || !open(spot) || !visible(spot.x - 40, spot.y - 70, 80, 80)) continue;
            const glow = ctx.createRadialGradient(spot.x, spot.y - 26, 2, spot.x, spot.y - 26, 34);
            glow.addColorStop(0, `rgba(255, 240, 150, ${(0.5 * dark).toFixed(3)})`); glow.addColorStop(1, "rgba(255, 240, 150, 0)");
            ctx.fillStyle = glow; ctx.fillRect(spot.x - 34, spot.y - 60, 68, 68);
          }
          ctx.restore();
          if (dark > 0.3) FIREFLIES.forEach((fly, index) => {
            const t = now / 1000;
            const x = state.reducedMotion ? fly.x : fly.x + Math.sin(t * 0.6 + index) * 18;
            const y = state.reducedMotion ? fly.y : fly.y + Math.cos(t * 0.45 + index * 1.7) * 12;
            if (!visible(x - 8, y - 8, 16, 16)) return;
            const blink = state.reducedMotion ? 0.8 : (Math.sin(t * 2.2 + index * 1.3) + 1) / 2;
            const alpha = ((dark - 0.3) / 0.7) * blink;
            ctx.fillStyle = `rgba(230, 255, 140, ${(alpha * 0.3).toFixed(3)})`; ctx.fillRect(Math.round(x) - 5, Math.round(y) - 5, 10, 10);
            ctx.fillStyle = `rgba(240, 255, 170, ${alpha.toFixed(3)})`; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
          });
        }
        for (const npc of npcs) if (npc.alpha === 1 && distance(npc, p) < 170) tag(ctx, VILLAGERS[npc.index].name, npc.x, npc.y - 112);
        const focus = nearRef.current;
        if (focus && active) {
          const bob = state.reducedMotion ? 0 : Math.round(Math.sin(now / 220) * 3);
          const x = Math.round(focus.x), y = Math.round(focus.y - focus.lift + bob);
          ctx.fillStyle = INK; ctx.fillRect(x - 11, y - 14, 22, 12); ctx.fillRect(x - 7, y - 2, 14, 4); ctx.fillRect(x - 3, y + 2, 6, 4);
          ctx.fillStyle = "#f0c24a"; ctx.fillRect(x - 8, y - 11, 16, 7); ctx.fillRect(x - 4, y - 4, 8, 4);
        }
        surface.dataset.x = p.x.toFixed(1); surface.dataset.y = p.y.toFixed(1);
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
    }).catch(() => {
      if (!cancelled) { setFailed(true); setStatus("The village or your Friend's artwork couldn't load. Check your connection and try again."); }
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); stop(); };
  }, [friendId, client, revision]);

  const blocked = paused || Boolean(menu) || Boolean(status);
  const title = !menu ? "" : menu.kind === "post" ? "Rareton Post Office" : menu.kind === "bakery" ? "Bramble's Bakery"
    : menu.kind === "well" ? "The wishing well" : menu.kind === "board" ? "Village notice board" : menu.kind === "mailbox" ? "Your mailbox"
    : menu.kind === "chat" ? VILLAGERS[menu.npc].name : menu.kind === "satchel" ? "Your satchel"
    : menu.kind === "stall" ? "The seed stall" : menu.kind === "garden" ? "Community garden" : "Settings";
  const feedback = <p className="rt-hint" role={actionError ? "alert" : "status"}>{actionError || (busy ? "Waiting for the preview confirmation…" : "")}</p>;
  const close = () => setMenu(null);

  return <section className="rt-game" aria-label="Rareton village">
    <div className="rt-world" ref={wrap} inert={blocked || undefined}>
      <canvas ref={canvas} tabIndex={blocked ? -1 : 0}
        aria-label="Rareton village. Walk with WASD or arrow keys, or tap where to go. Press E, or tap a place or villager, to interact."
        onPointerDown={event => {
          if (blocked) return;
          event.preventDefault(); event.currentTarget.focus(); keys.current.clear();
          const rect = event.currentTarget.getBoundingClientRect(), { zoom } = view.current;
          const point = { x: camera.current.x + (event.clientX - rect.left) / zoom, y: camera.current.y + (event.clientY - rect.top) / zoom };
          const hit = targets.current
            .filter(target => target.hit ? inside(point, target.hit) : distance(point, { x: target.x, y: target.y - target.lift / 2 }) < target.lift / 2 + 12)
            .sort((a, b) => distance(point, a) - distance(point, b))[0];
          if (!hit) { destination.current = point; pending.current = null; return; }
          if (distance(position.current, hit) <= hit.reach) { destination.current = null; interact(hit); return; }
          destination.current = { x: hit.x, y: hit.y }; pending.current = hit.id;
        }} />
    </div>
    {!status && me && <>
      <header className="rt-hud" inert={paused || undefined}>
        <div className="rt-title"><strong>Rareton</strong><span>Friend #{friendId.toString()} · {me.familyName}</span></div>
        <span className="rt-stamp" title="Simulated RF balance. Nothing is spent on-chain.">Simulated · {rf(balance)}</span>
        <button type="button" disabled={blocked} onClick={() => setMenu({ kind: "satchel" })}>Satchel<span className="rt-count">{countOf(bag)}</span></button>
        <button type="button" disabled={blocked} onClick={() => setMenu({ kind: "settings" })} aria-label="Settings">⚙</button>
      </header>
      <p className="rt-toast" role="status" aria-live="polite">{toast}</p>
      <div className="rt-guide" inert={blocked || undefined}>
        <p>{clock ? `${clock} · ` : ""}<span className="rt-desktop">WASD / arrows · E · </span>Tap to walk{unread > 0 ? ` · ${unread} letter${unread > 1 ? "s" : ""} in your mailbox` : ""}</p>
        {near && <button type="button" className="rt-action" onClick={() => interact(near)}>{near.label}<span className="rt-desktop"> · E</span></button>}
      </div>
    </>}
    {status && <div className="rt-status" role={failed ? "alert" : "status"}>
      <p>{status}</p>
      {failed && <button type="button" disabled={paused} onClick={() => setRevision(value => value + 1)}>Try again</button>}
    </div>}
    {menu?.kind === "garden" && me && <GardenVista me={me} helper={villagerArt[2]} definition={definition}
      packets={snapshot?.consumables ?? 0n} balance={balance} canBuy={canBuy} pendingPlay={pendingPlay} busy={busy} paused={paused}
      reducedMotion={reducedMotion} error={actionError} sow={sow} harvest={harvest} sound={play} onClose={close}
      buy={() => void act(async () => { await client.buy(1n); play("purchase"); })} />}
    {menu && menu.kind !== "garden" && <GameMenu title={title} onClose={close}>
      {menu.kind === "post" ? <>{isNight && <p className="rt-note">Postmaster Quill is sorting letters by lamplight. “Night post is the best post.”</p>}<PostOffice friendId={friendId} inventory={bag} paused={paused || busy} balance={balance} definition={definition} onDone={close}
        onSend={(gift, spend) => {
          const entries = Object.entries(spend) as [FlowerId | "bun", number][];
          setInventory(current => {
            const next = { ...current };
            for (const [item, amount] of entries) if (item === "bun" || !isGarden(item)) next[item] = Math.max(0, next[item] - amount);
            return next;
          });
          setGifted(current => {
            const next = { ...current };
            for (const [item, amount] of entries) if (item !== "bun" && isGarden(item)) next[item] += amount;
            return next;
          });
          setStamps(count => count + 1); setSent(list => [gift, ...list]); play("reward");
        }} /></>
      : menu.kind === "stall" ? <>
        <p className="rt-banner"><strong>Simulated RF:</strong> packets, prices and sales use the SDK's preview ledger. No real RF is spent and no wallet prompt appears.</p>
        <p>Balance <strong>{rf(balance)}</strong> · {snapshot?.consumables.toString() ?? "0"} seed packet{snapshot?.consumables === 1n ? "" : "s"} ready to plant</p>
        <table className="rt-odds"><thead><tr><th>Garden flower</th><th>Chance</th><th>Sell value</th></tr></thead>
          <tbody>{GARDEN_IDS.map(flower => <tr key={flower}><td>{FLOWERS[flower].name}</td><td>{chanceOf(definition, flower)}%</td><td>{rf(valueOf(definition, flower))}</td></tr>)}</tbody></table>
        <p className="rt-hint">One packet grows exactly one flower. On average a packet grows {rf(definition.outcomes.reduce((total, outcome) => total + outcome.reward * BigInt(outcome.chanceBps), 0n) / 10_000n)} of flowers.</p>
        <button type="button" className="rt-primary" disabled={!canBuy || busy || paused}
          onClick={() => void act(async () => { await client.buy(1n); play("purchase"); say("A seed packet! Plant it in the garden plot."); })}>Buy a seed packet · {rf(definition.price)}</button>
        {!canBuy && snapshot && <p className="rt-hint" role="alert">{balance < definition.price ? "Not enough simulated RF for a packet."
          // Nothing reserved yet but still short of backing: the page loaded files from two different versions.
          : snapshot.reservedPlays === 0n && snapshot.rewardLiability === 0n ? "Rareton was just updated. Please reload the page to use the seed stall."
          : "Every packet reserves the top prize. Plant or sell what you have before buying more."}</p>}
        <h3>Sell garden flowers</h3>
        {GARDEN_IDS.some(flower => bag[flower] > 0) ? GARDEN_IDS.filter(flower => bag[flower] > 0).map(flower =>
          <div key={flower} className="rt-sell"><PixelArt rows={flowerIcon(flower)} scale={3} color={FLOWERS[flower].color} label={FLOWERS[flower].name} />
            <span>{FLOWERS[flower].name} ×{bag[flower]}</span>
            <button type="button" disabled={busy || paused} onClick={() => void act(async () => { await client.redeem(outcomeOf(flower), 1n); play("reward"); })}>Sell one · {rf(valueOf(definition, flower))}</button>
          </div>) : <p className="rt-hint">You have no garden flowers to sell. Meadow flowers are free and have no RF value.</p>}
        {feedback}
      </>
      : menu.kind === "chat" ? <div className="rt-chat">
        {villagerArt[menu.npc] && <PixelArt rows={spriteFrame(villagerArt[menu.npc], "down", false, 0).frame.rows} scale={5} halo label={VILLAGERS[menu.npc].name} />}
        <div>
          <small>Friend #{VILLAGERS[menu.npc].tokenId.toString()}{villagerArt[menu.npc] ? ` · ${villagerArt[menu.npc].familyName}` : ""}{menu.night ? " · talking through the door" : ""}</small>
          <p className="rt-quote">“{(menu.night ? VILLAGERS[menu.npc].night : VILLAGERS[menu.npc].lines)[menu.line]}”</p>
          {menu.note && <p className="rt-note">{menu.note}</p>}
          <div className="rt-row">
            <button type="button" disabled={paused} onClick={() => { play("select"); setMenu({ kind: "chat", npc: menu.npc, night: menu.night, line: (menu.line + 1) % (menu.night ? VILLAGERS[menu.npc].night : VILLAGERS[menu.npc].lines).length }); }}>Keep chatting</button>
            <button type="button" className="rt-primary" disabled={paused} onClick={close}>Goodbye</button>
          </div>
        </div>
      </div>
      : menu.kind === "bakery" ? <div className="rt-chat">
        <PixelArt rows={giftArt("bun", [], 0, 0n)} scale={5} label="Honey bun" />
        <div>
          <p className="rt-quote">{menu.gave ? "“Fresh from the oven! Take it, take it.”" : "“Your satchel's already full of buns. Why not post one to a friend?”"}</p>
          <p className="rt-note">{menu.gave ? `You now have ${inventory.bun} honey bun${inventory.bun === 1 ? "" : "s"}.` : `You're carrying ${inventory.bun} buns, the most your satchel holds.`}</p>
          <button type="button" className="rt-primary" disabled={paused} onClick={close}>Thank you, Bramble</button>
        </div>
      </div>
      : menu.kind === "well" ? <>
        <p>You close your eyes and make a wish. The water ripples, and somewhere a bell rings softly.</p>
        {menu.note && <p className="rt-note">{menu.note}</p>}
        <button type="button" className="rt-primary" disabled={paused} onClick={close}>Back to the square</button>
      </>
      : menu.kind === "board" ? <ul className="rt-notices">
        <li><strong>Post office open all day.</strong> Send a bouquet, letter or honey bun to any Rare Friend by number.</li>
        <li><strong>Meadow news.</strong> Flowers in the east meadow and by the pond grow back soon after picking.</li>
        <li><strong>Practice post.</strong> Every gift in Rareton is simulated. Nothing is minted or sent, and there are no transactions or fees.
          Each gift is a real 16 × 16 one-bit picture, the same format as Friend sprites, ready for a future on-chain version.</li>
        <li><strong>Seed stall.</strong> Seed packets cost {rf(definition.price)} of simulated RF and grow rare garden flowers. The odds are posted at the stall.</li>
        <li><strong>Post fund.</strong> Every stamp costs {rf(STAMP)}: half is burned, half goes to the village post fund.
          This visit: <strong>{rf(BigInt(stamps) * STAMP / 2n)} burned</strong>, {rf(BigInt(stamps) * STAMP / 2n)} to the fund (simulated).</li>
        <li><strong>This visit:</strong> {sent.length} gift{sent.length === 1 ? "" : "s"} sent, {received.length} received. The village forgets when you reload.</li>
      </ul>
      : menu.kind === "mailbox" ? <>
        {received.length ? received.map(gift => <GiftCard key={gift.id} gift={gift} />) : <p>Your mailbox is empty.</p>}
        <p className="rt-hint">Letters from villagers are part of Rareton's story, and simulated too.</p>
      </>
      : menu.kind === "satchel" ? <>
        <p>Balance <strong>{rf(balance)}</strong> <span className="rt-sim">Simulated</span> · {snapshot?.consumables.toString() ?? "0"} seed packets · {stamps} stamp{stamps === 1 ? "" : "s"} used</p>
        <h3>Meadow & bakery</h3>
        <div className="rt-items">
          {MEADOW_IDS.map(flower => <div key={flower} className="rt-item"><PixelArt rows={flowerIcon(flower)} scale={4} color={FLOWERS[flower].color} label={FLOWERS[flower].name} />
            <span>{FLOWERS[flower].name}<strong>{bag[flower]}</strong></span></div>)}
          <div className="rt-item"><PixelArt rows={BUN_ICON} scale={4} label="Honey bun" /><span>Honey bun<strong>{bag.bun}</strong></span></div>
        </div>
        <h3>Garden flowers <span className="rt-sim">RF value · simulated</span></h3>
        <div className="rt-items">
          {GARDEN_IDS.map(flower => <div key={flower} className="rt-item"><PixelArt rows={flowerIcon(flower)} scale={4} color={FLOWERS[flower].color} label={FLOWERS[flower].name} />
            <span>{FLOWERS[flower].name}<strong>{bag[flower]}</strong><small>{rf(valueOf(definition, flower))} each</small></span></div>)}
        </div>
        <h3>Sent gifts <span className="rt-sim">Simulated</span></h3>
        {sent.length ? sent.map(gift => <GiftCard key={gift.id} gift={gift} />) : <p className="rt-hint">Nothing sent yet. Visit the post office north of the square.</p>}
      </>
      : <>
        <button type="button" aria-pressed={!muted} onClick={() => {
          const next = !muted; setMuted(next); sound.current?.setMuted(next);
          if (!next) { void sound.current?.unlock(); sound.current?.play("select"); }
        }}>{muted ? "Sound: off" : "Sound: on"}</button>{" "}
        <button type="button" aria-pressed={musicOn} onClick={() => {
          const next = !musicOn; setMusicOn(next);
          if (next) void music.current?.start(); else music.current?.stop();
        }}>{musicOn ? "Music: on" : "Music: off"}</button>
        <label className="rt-check"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /> Reduce motion</label>
        <label className="rt-check"><input type="checkbox" checked={dayNight} onChange={event => setDayNight(event.target.checked)} /> Day and night (a village day lasts four minutes)</label>
        <label className="rt-check"><input type="checkbox" checked={weather} onChange={event => setWeather(event.target.checked)} /> Weather (occasional rain showers)</label>
        <p>Walk with WASD or arrow keys, or tap where to go. Press E, or tap a building, flower or villager, to interact.</p>
        <p>Rareton's 8-bit music was composed for the game and is synthesised live in your browser: a wistful waltz by day and a music-box lullaby at night.</p>
        <p>Reduced motion keeps Friends and animals on still frames, and stops smoke, marker bobbing, firefly blinking, bunting sway and falling rain.</p>
        <p>Your wallet is only used to confirm you own your Friend. Rareton never asks for a signature or transaction. RF balances, seed packets, stamps and gifts are all simulated.</p>
      </>}
    </GameMenu>}
  </section>;
}
