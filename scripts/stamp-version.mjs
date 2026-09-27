// Adds ?v=<version> to every asset reference in a FriendSDK build so browsers never
// mix cached files from different deploys (GitHub Pages caches for 10 minutes).
// Usage: node scripts/stamp-version.mjs <build-dir> <version>
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [dir, version] = process.argv.slice(2);
if (!dir || !/^[\w.-]+$/.test(version ?? "")) throw new Error("Usage: stamp-version.mjs <build-dir> <version>");
const stamp = async (file, pattern) => {
  const path = join(dir, file), before = await readFile(path, "utf8");
  const after = before.replace(pattern, (_, name) => `./${name}?v=${version}`);
  if (after === before) throw new Error(`No asset references found in ${file}`);
  await writeFile(path, after);
};
await stamp("index.html", /\.\/(runtime\.css|layout\.css|runtime\.js)(?=")/g);
await stamp("game.html", /\.\/(game\.css|game-layout\.css|game\.js)(?=")/g);
await stamp("runtime.js", /\.\/(game\.html)(?=")/g);
console.log(`Stamped ${dir} with v=${version}`);
