import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, "native.bundle.js");

await esbuild.build({
  entryPoints: [path.join(root, "native", "main.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile,
  target: ["es2020"],
  logLevel: "info",
});

console.log(`[build-native] → ${outfile}`);
