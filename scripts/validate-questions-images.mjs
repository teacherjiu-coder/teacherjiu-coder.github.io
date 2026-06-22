import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ROUND = {
  "1gi": "1급 정기",
  "1ss": "1급 상시",
  "2gi": "2급 정기",
  "2ss": "2급 상시",
};

const files = fs
  .readdirSync(ROOT)
  .filter((f) => /^questions_(1|2)(gi|ss)_\d+\.json$/.test(f))
  .sort();

const BARE = /^[①②③④]\s*$/;

function dr(file) {
  return file.match(/^questions_(1gi|1ss|2gi|2ss)_/)?.[1] ?? "other";
}

function exists(p) {
  try {
    const full = path.join(ROOT, p);
    return fs.existsSync(full) && fs.statSync(full).isFile();
  } catch {
    return false;
  }
}

const issues = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const round = dr(file);
  const tag = file.replace("questions_", "").replace(".json", "");

  for (const q of data) {
    const ctx = { round, file, id: q.id, tag: `${tag}#${q.id}` };

    q.options?.forEach((o, i) => {
      if (!String(o ?? "").trim()) {
        issues.push({ ...ctx, type: "empty_option", detail: `option ${i + 1}` });
      }
    });

    const allBare = q.options?.length === 4 && q.options.every((o) => BARE.test(String(o).trim()));
    const optImgs = (q.option_images ?? []).filter(Boolean);
    const hasFourOpts = q.option_images?.length === 4 && q.option_images.every(Boolean);
    const hasMain = !!q.image;

    if (q.option_images?.length > 0 && q.option_images.length < 4) {
      issues.push({
        ...ctx,
        type: "option_images_partial",
        detail: `length=${q.option_images.length} ${JSON.stringify(q.option_images)}`,
      });
    }

    if (q.image && !exists(q.image)) {
      issues.push({ ...ctx, type: "missing_image", detail: q.image });
    }

    if (q.explanation_image) {
      const arr = Array.isArray(q.explanation_image) ? q.explanation_image : [q.explanation_image];
      arr.filter(Boolean).forEach((p) => {
        if (!exists(p)) issues.push({ ...ctx, type: "missing_explanation_image", detail: p });
      });
    }

    q.option_images?.forEach((p, i) => {
      if (p && !exists(p)) {
        issues.push({ ...ctx, type: "missing_option_image", detail: `[${i}] ${p}` });
      }
    });

    if (allBare && !hasFourOpts && !hasMain) {
      issues.push({ ...ctx, type: "bare_options_no_images", detail: "①②③④ only" });
    }

    if (allBare && hasFourOpts && optImgs.some((p) => !exists(p))) {
      issues.push({ ...ctx, type: "bare_options_broken_images", detail: "shows empty in app" });
    }
  }
}

const byRound = {};
for (const k of Object.keys(ROUND)) byRound[k] = [];
issues.forEach((x) => (byRound[x.round] ??= []).push(x));

let out = `Validated ${files.length} files\nTotal issues: ${issues.length}\n\n`;
for (const [k, label] of Object.entries(ROUND)) {
  const list = byRound[k] ?? [];
  out += `\n## ${label} (${k}) — ${list.length} issues\n`;
  if (!list.length) {
    out += "(none)\n";
    continue;
  }
  for (const x of list) {
    out += `${x.tag}\t${x.type}\t${x.detail}\n`;
  }
}

const outPath = path.join(ROOT, "validation-report-images.txt");
fs.writeFileSync(outPath, out);
console.log(out);
