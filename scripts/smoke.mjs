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
    await game.getByRole("button", { name: /close/i }).first().click();
    await canvas.focus();
    await hold(page, "a", 350); await hold(page, "w", 2600); await hold(page, "d", 350);
    const where = await canvas.evaluate(node => [node.dataset.x, node.dataset.y]);
    console.log("player at", where.join(", "));
    await page.keyboard.press("e");
    await game.getByText("Practice post (simulated)").waitFor();
    await game.getByRole("button", { name: "Letter" }).click();
    await page.screenshot({ path: `./artifacts/post-${width}.png` });
    await game.getByRole("button", { name: /close/i }).first().click();
    await game.getByRole("button", { name: /Satchel/ }).click();
    await game.getByText("Sent gifts").waitFor();
    await page.screenshot({ path: `./artifacts/satchel-${width}.png` });
    await game.getByRole("button", { name: /close/i }).first().click();
  },
});
console.log("smoke ok", width);
