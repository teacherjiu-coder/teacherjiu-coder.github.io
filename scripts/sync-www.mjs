import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const www = path.join(root, "www");

const COPY_FILES = [
  "index.html",
  "app.js",
  "style.css",
  "links.js",
  "pro-access.js",
  "storage-bridge.js",
  "native.bundle.js",
];

const COPY_GLOBS = ["questions_*.json"];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

rmrf(www);
fs.mkdirSync(www, { recursive: true });

for (const file of COPY_FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`[sync-www] skip missing: ${file}`);
    continue;
  }
  const dest = path.join(www, file);
  if (file === "index.html") {
    let html = fs.readFileSync(src, "utf8");
    html = html.replace('src="native.stub.js"', 'src="native.bundle.js"');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
  } else {
    copyFile(src, dest);
  }
}

for (const name of fs.readdirSync(root)) {
  if (COPY_GLOBS.some((g) => g.replace("*", "") && name.startsWith("questions_") && name.endsWith(".json"))) {
    copyFile(path.join(root, name), path.join(www, name));
  }
}

const imgSrc = path.join(root, "img");
if (fs.existsSync(imgSrc)) {
  copyDir(imgSrc, path.join(www, "img"));
}

console.log(`[sync-www] → ${www}`);
