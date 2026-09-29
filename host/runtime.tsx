/**
 * Trusted runtime page for the hosted build. Same as the FriendSDK CLI's generated host,
 * plus a documented `publicClient` override for Friend discovery.
 *
 * Why: in September 2026 the public Robinhood RPC started rejecting eth_getLogs ranges over
 * 10,000,000 blocks. FriendSDK v0.1.2 asks for an account's Generations transfers from block 0
 * to the head in one call, so every game failed with "Could not load this account's Friend
 * transfers". This client splits those owner-filtered queries into allowed windows. It still
 * filters by the connected account only (no collection scan), and ownership is still verified
 * by the runtime's fresh eligibility check.
 */
import { createRoot } from "react-dom/client";
import { parseChanceGame } from "@rarefriends/friendsdk/game";
import { GameHost } from "@rarefriends/friendsdk/runtime";
import { createFriendPublicClient } from "@rarefriends/friendsdk/wallet";
import gameJson from "../games/rareton/game.json";
import "@rarefriends/friendsdk/frame.css";
import "@rarefriends/friendsdk/runtime.css";
import "../games/rareton/host.css";

const MAX_SPAN = 9_000_000n, PARALLEL = 4;
const base = createFriendPublicClient();
type GetLogs = typeof base.getLogs;

const getLogs = (async (args: Parameters<GetLogs>[0]) => {
  const from = args && "fromBlock" in args ? args.fromBlock : undefined, to = args && "toBlock" in args ? args.toBlock : undefined;
  if (typeof from !== "bigint" || typeof to !== "bigint" || to - from < MAX_SPAN) return base.getLogs(args);
  const windows: [bigint, bigint][] = [];
  for (let start = from; start <= to; start += MAX_SPAN) windows.push([start, start + MAX_SPAN - 1n < to ? start + MAX_SPAN - 1n : to]);
  const results: unknown[][] = new Array(windows.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, windows.length) }, async () => {
    while (next < windows.length) {
      const index = next++, [fromBlock, toBlock] = windows[index];
      results[index] = await base.getLogs({ ...args, fromBlock, toBlock } as Parameters<GetLogs>[0]);
    }
  }));
  return results.flat();
}) as GetLogs;

const publicClient = { ...base, getLogs };
const definition = parseChanceGame(gameJson);
createRoot(document.getElementById("root")!).render(<GameHost definition={definition} frameUrl="./game.html" publicClient={publicClient} />);
