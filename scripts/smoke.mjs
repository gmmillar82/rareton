// Automated check with the SDK's mock wallet: walk to the post office, open menus, capture screenshots.
// Usage: node scripts/smoke.mjs [width]
import { testGame } from "@rarefriends/friendsdk/testing";

const width = Number(process.argv[2] ?? 960);
const hold = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
await testGame("./games/rareton", {
  width,
  screenshot: `./artifacts/smoke-${width}.png`,
  check: async ({ page, game }) => {
    const canvas = game.locator("canvas");
    await canvas.waitFor();
    await game.getByRole("button", { name: "Settings" }).click();
    await game.getByRole("button", { name: "Sound: off" }).click();
    await game.getByRole("button", { name: "Music: off" }).click();
    await game.getByRole("button", { name: "Music: on" }).waitFor();
    await page.waitForTimeout(500);
    await game.getByRole("button", { name: "Music: on" }).click();
    await game.getByRole("button", { name: /close/i }).first().click();
    await canvas.focus();
    await hold(page, "a", 350); await hold(page, "w", 2600); await hold(page, "d", 350);
    const where = await canvas.evaluate(node => [node.dataset.x, node.dataset.y]);
    console.log("player at", where.join(", "));
    await page.keyboard.press("e");
    await game.getByText("Practice post (simulated)").waitFor();
    await game.getByRole("button", { name: "Letter" }).click();
    // Let the recipient lookup reach the real public artwork registry instead of the fixture mock.
    await page.route(/rpc\.mainnet\.chain\.robinhood\.com/, route => route.continue());
    await game.getByLabel("Friend number").fill("42");
    await game.getByText("Ready to send!").waitFor({ timeout: 20_000 });
    await page.screenshot({ path: `./artifacts/post-${width}.png` });
    await game.getByRole("button", { name: /Stamp & send/ }).click();
    await game.getByText("On its way!").waitFor();
    await page.screenshot({ path: `./artifacts/sent-${width}.png` });
    await game.getByRole("button", { name: "Back to the village" }).click();
    await game.getByRole("button", { name: /Satchel/ }).click();
    await game.getByText("Sent gifts").waitFor();
    await game.getByText(/to Friend #42/).waitFor();
    await page.screenshot({ path: `./artifacts/satchel-${width}.png` });
    await game.getByRole("button", { name: /close/i }).first().click();

    // Seed stall: walk east along the road, buy a packet (runtime confirmation), then plant it.
    await canvas.focus();
    await hold(page, "s", 1700); await hold(page, "d", 3400); await hold(page, "w", 900);
    console.log("at stall", (await canvas.evaluate(node => [node.dataset.x, node.dataset.y])).join(", "));
    await page.keyboard.press("e");
    await game.getByRole("columnheader", { name: "Garden flower" }).waitFor();
    await game.getByRole("button", { name: /Buy a seed packet/ }).click();
    await page.getByRole("button", { name: "Confirm preview" }).click();
    await game.getByText(/1 seed packet ready/).waitFor();
    await page.screenshot({ path: `./artifacts/stall-${width}.png` });
    await game.getByRole("button", { name: /close/i }).first().click();
    await canvas.focus();
    await hold(page, "s", 200); await hold(page, "a", 900);
    await page.keyboard.press("e");
    await game.getByRole("dialog", { name: "Community garden" }).waitFor();
    await page.screenshot({ path: `./artifacts/vista-${width}.png` });
    await game.getByRole("button", { name: "Plant a seed packet" }).click();
    await page.getByRole("button", { name: "Confirm preview" }).click();
    await game.getByRole("button", { name: /Bloom!/ }).click({ timeout: 15_000 });
    await game.getByRole("heading", { name: "Something bloomed!" }).waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `./artifacts/bloom-${width}.png` });
    await game.getByRole("button", { name: "Lovely!" }).click();
    await game.getByRole("button", { name: /Satchel/ }).click();
    await game.getByRole("heading", { name: /Garden flowers/ }).waitFor();
    await page.screenshot({ path: `./artifacts/satchel-${width}.png` });
    await game.getByRole("button", { name: /close/i }).first().click();

    // Whispering Woods: follow the road west through the gap in the trees.
    await canvas.focus();
    // Steer to the clear row just below the well, then walk west along it.
    for (let attempt = 0; attempt < 3; attempt++) {
      const y = await canvas.evaluate(node => Number(node.dataset.y)), dy = 724 - y;
      if (Math.abs(dy) < 4) break;
      await hold(page, dy > 0 ? "s" : "w", Math.abs(dy) / 230 * 1000);
    }
    await hold(page, "a", 9000);
    const woods = await canvas.evaluate(node => [Number(node.dataset.x), Number(node.dataset.y)]);
    console.log("woods at", woods.join(", "));
    if (!(woods[0] < 0)) throw new Error(`Expected to reach the woods (x < 0), got ${woods}`);
    await page.screenshot({ path: `./artifacts/woods-${width}.png` });
  },
});
console.log("smoke ok", width);
