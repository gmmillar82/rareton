// Serves the stamped Pages build as-is and plays it with the SDK's read-only test fixture:
// connect, pick the sample Friend, walk to the seed stall and buy a packet.
// Usage: npm run build:pages && node scripts/check-pages-build.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import { installFixture, createArtworkFixture } from "../node_modules/@rarefriends/friendsdk/scripts/browser-fixture.mjs";

const root = "games/rareton/.friendsdk";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://x").pathname.replace(/\/$/, "/index.html");
  try { response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(await readFile(join(root, path))); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 800 } })).newPage();
  page.on("pageerror", error => errors.push(error.message));
  const fixture = await installFixture(page, origin, { artworkCall: await createArtworkFixture() });
  const game = page.frameLocator("iframe");
  await page.goto(origin);
  await page.getByRole("button", { name: /^Connect (wallet|Browser wallet)$/ }).click();
  await page.getByRole("button", { name: /^Friend #7730\b/ }).click();
  const canvas = game.locator("canvas");
  await game.getByText(/Simulated · 20 RF/).waitFor({ timeout: 20_000 });
  console.log("frame src:", await page.locator("iframe").getAttribute("src"));
  await canvas.focus();
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  // Steer by the reported position: to the clear row below the well, east to the stall, then north to it.
  const at = () => canvas.evaluate(node => [Number(node.dataset.x), Number(node.dataset.y)]);
  const steer = async (axis, target, less, more) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delta = target - (await at())[axis];
      if (Math.abs(delta) < 6) return;
      await hold(delta > 0 ? more : less, Math.abs(delta) / 230 * 1000);
    }
  };
  await steer(1, 724, "w", "s"); await steer(0, 1730, "a", "d"); await hold("w", 900);
  console.log("near stall at", (await canvas.evaluate(node => [node.dataset.x, node.dataset.y])).join(", "));
  await page.keyboard.press("e");
  await game.getByRole("button", { name: /Buy a seed packet/ }).click();
  await page.getByRole("button", { name: "Confirm preview" }).click();
  await game.getByText(/1 seed packet ready/).waitFor();
  errors.push(...fixture.errors);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("pages build ok");
} finally { await browser.close(); server.close(); }
