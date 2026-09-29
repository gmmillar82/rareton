// Hosted build: the FriendSDK CLI build, with runtime.js/runtime.css rebuilt from host/runtime.tsx
// (adds the chunked Friend-discovery client), then ?v=<commit> cache-busting.
// Usage: node scripts/build-pages.mjs
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const outdir = "games/rareton/.friendsdk";
const run = (command, args) => execFileSync(command, args, { stdio: "inherit" });
run("npx", ["friendsdk", "build", "games/rareton"]);
await build({
  entryPoints: ["host/runtime.tsx"], outfile: `${outdir}/runtime.js`,
  bundle: true, format: "iife", platform: "browser", target: "es2022", jsx: "automatic", minify: true,
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
console.log("Rebuilt runtime.js with chunked Friend discovery");
const version = execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
run("node", ["scripts/stamp-version.mjs", outdir, version]);
