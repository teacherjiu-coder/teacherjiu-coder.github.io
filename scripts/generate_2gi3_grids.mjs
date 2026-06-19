#!/usr/bin/env node
/**
 * Generate Excel-style grid PNGs for 2gi3.
 * Requires: npm install @napi-rs/canvas
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "img");

const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const fontPath = "/System/Library/Fonts/Supplemental/AppleGothic.ttf";
if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, "Gothic");
}

function drawGrid(rows, opts = {}) {
  const {
    colLabels = null,
    startCol = "A",
    startRow = 1,
    cellW = 80,
    cellH = 28,
    rowHdrW = 30,
    colHdrH = 22,
    selected = new Set(),
    headerRows = new Set(),
    greenHeader = false,
    title = null,
    offsetX = 0,
    offsetY = 0,
    canvas = null,
  } = opts;

  const ncols = rows[0].length;
  const nrows = rows.length;
  const titleH = title ? 26 : 0;
  const W = rowHdrW + ncols * cellW;
  const H = titleH + colHdrH + nrows * cellH;

  const c = canvas || createCanvas(W, H);
  if (!canvas) c.width = W;
  if (!canvas) c.height = H;
  const ctx = c.getContext("2d");

  if (!canvas) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
  }

  const ox = offsetX;
  const oy = offsetY;

  ctx.font = "13px Gothic, sans-serif";

  if (title) {
    ctx.fillStyle = "#d9e1f2";
    ctx.fillRect(ox, oy, W, titleH);
    ctx.fillStyle = "#1e1e1e";
    ctx.font = "bold 14px Gothic, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, ox + W / 2, oy + titleH - 8);
    ctx.textAlign = "left";
    ctx.font = "13px Gothic, sans-serif";
  }

  let y = oy + titleH;
  ctx.fillStyle = "#e8ecf2";
  ctx.fillRect(ox, y, rowHdrW, colHdrH);
  let x = ox + rowHdrW;
  for (let ci = 0; ci < ncols; ci++) {
    const lab = colLabels ? colLabels[ci] : String.fromCharCode(startCol.charCodeAt(0) + ci);
    ctx.fillStyle = "#e8ecf2";
    ctx.fillRect(x, y, cellW, colHdrH);
    ctx.strokeStyle = "#b4bcc8";
    ctx.strokeRect(x, y, cellW, colHdrH);
    ctx.fillStyle = "#283046";
    ctx.textAlign = "center";
    ctx.fillText(lab, x + cellW / 2, y + 16);
    x += cellW;
  }
  y += colHdrH;

  for (let r = 0; r < nrows; r++) {
    const rn = startRow + r;
    ctx.fillStyle = "#e8ecf2";
    ctx.fillRect(ox, y, rowHdrW, cellH);
    ctx.strokeStyle = "#b4bcc8";
    ctx.strokeRect(ox, y, rowHdrW, cellH);
    ctx.fillStyle = "#283046";
    ctx.textAlign = "right";
    ctx.fillText(String(rn), ox + rowHdrW - 6, y + 18);

    x = ox + rowHdrW;
    for (let ci = 0; ci < ncols; ci++) {
      const isHdr = headerRows.has(r);
      let bg = isHdr ? (greenHeader ? "#c6e0b4" : "#d6dce6") : "#ffffff";
      const key = `${r},${ci}`;
      if (selected.has(key)) bg = "#c6efce";
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = "#b4bcc8";
      ctx.strokeRect(x, y, cellW, cellH);
      if (selected.has(key)) {
        ctx.strokeStyle = "#217346";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
        ctx.lineWidth = 1;
      }
      const val = String(rows[r][ci]);
      ctx.fillStyle = "#1e1e1e";
      const right = /^[\d,.\-><$=(A-Z]/.test(val) && !/^[가-힣]/.test(val);
      ctx.textAlign = right ? "right" : "left";
      ctx.fillText(val, right ? x + cellW - 6 : x + 6, y + 18);
      x += cellW;
    }
    y += cellH;
  }

  return { canvas: c, width: W, height: H };
}

function save(name, canvas) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  console.log("saved", name);
}

// Q21 main
save(
  "2gi3_q21.png",
  drawGrid(
    [
      ["성명", "직위", "근속연수", "", "조건", "", ""],
      ["김일민", "부장", "20", "", "성명", "직위", "근속연수"],
      ["김유민", "사원", "4", "", "김*", "", ">10"],
      ["이지연", "과장", "12", "", "", "사원", "<5"],
      ["이민석", "부장", "14", "", "", "", ""],
      ["석명희", "사원", "2", "", "", "", ""],
      ["민호성", "사원", "11", "", "", "", ""],
    ],
    { startRow: 1, headerRows: new Set([0, 1]), cellW: 72 }
  ).canvas
);

const q21opts = [
  [
    ["김일민", "부장", "20"],
    ["김유민", "사원", "4"],
  ],
  [
    ["김일민", "부장", "20"],
    ["석명희", "사원", "2"],
  ],
  [
    ["김일민", "부장", "20"],
    ["김유민", "사원", "4"],
    ["석명희", "사원", "2"],
  ],
  [
    ["김일민", "부장", "20"],
    ["김유민", "사원", "4"],
    ["석명희", "사원", "2"],
    ["민호성", "사원", "11"],
  ],
];
q21opts.forEach((data, i) => {
  save(
    `2gi3_q21_${i + 1}.png`,
    drawGrid([["성명", "직위", "근속연수"], ...data], {
      headerRows: new Set([0]),
      greenHeader: true,
      cellW: 72,
    }).canvas
  );
});

[
  ["314826", "#,##0,", "315"],
  ["281476", "#,##0.0", "281,476.0"],
  ["12:00:00 AM", "0", "0"],
  ["2018-03-25", "yyyy-mmmm", "2018-March"],
].forEach((row, i) => {
  save(
    `2gi3_q26_${i + 1}.png`,
    drawGrid([["원본", "서식", "결과"], row], {
      colLabels: ["A", "B", "C"],
      headerRows: new Set([0]),
      cellW: 110,
    }).canvas
  );
});

save(
  "2gi3_q28.png",
  drawGrid(
    [
      ["10", "20", "30", "40", "50"],
      ["11", "21", "31", "41", "51"],
      ["12", "22", "32", "42", "52"],
      ["13", "23", "33", "43", "53"],
      ["14", "24", "34", "44", "54"],
      ["15", "25", "35", "45", "55"],
    ],
    { selected: new Set(["3,3"]), headerRows: new Set([0]), cellW: 56 }
  ).canvas
);

// Q30 — two panels on one canvas
{
  const gradeData = [
    ["", "성적현황"],
    ["국어", "85"],
    ["영어", "90"],
    ["수학", "78"],
    ["과학", "88"],
    ["사회", "92"],
  ];
  const g1 = drawGrid(gradeData, { selected: new Set(["0,0"]), cellW: 72 });
  const g2 = drawGrid(gradeData, {
    colLabels: ["C", "D"],
    startCol: "C",
    selected: new Set(["2,0"]),
    cellW: 72,
  });
  const gap = 28;
  const labelH = 26;
  const totalW = g1.width + gap + g2.width;
  const totalH = labelH + Math.max(g1.height, g2.height);
  const combined = createCanvas(totalW, totalH);
  const ctx = combined.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, totalW, totalH);
  ctx.font = "bold 14px Gothic, sans-serif";
  ctx.fillStyle = "#1e1e1e";
  ctx.textAlign = "center";
  ctx.fillText("그림1", g1.width / 2, 18);
  ctx.fillText("그림2", g1.width + gap + g2.width / 2, 18);

  drawGrid(gradeData, {
    selected: new Set(["0,0"]),
    cellW: 72,
    offsetX: 0,
    offsetY: labelH,
    canvas: combined,
  });
  drawGrid(gradeData, {
    colLabels: ["C", "D"],
    startCol: "C",
    selected: new Set(["2,0"]),
    cellW: 72,
    offsetX: g1.width + gap,
    offsetY: labelH,
    canvas: combined,
  });
  save("2gi3_q30.png", combined);
}

// Q33 — NOTE: product data inferred from typical 2gi3 exam; verify against PDF if available
const q33data = [
  ["제품명", "판매수량", "단가"],
  ["노트북", "120", "1,500,000"],
  ["프린터", "62", "450,000"],
  ["모니터", "85", "320,000"],
  ["키보드", "45", "89,000"],
  ["마우스", "38", "45,000"],
  ["스피커", "72", "120,000"],
  ["헤드셋", "88", "180,000"],
];
save("2gi3_q33.png", drawGrid(q33data, { headerRows: new Set([0]), cellW: 90 }).canvas);

[
  "=B2<=AVERAGE($B$2:$B$8)",
  "=B2>=AVERAGE(B2:B8)",
  "=B2>AVERAGE($B$2:$B$8)",
  "=B2>=AVERAGE($B$2:$B$8)",
].forEach((f, i) => {
  save(
    `2gi3_q33_${i + 1}.png`,
    drawGrid([["판매수량"], [f]], {
      startRow: 10,
      headerRows: new Set([0]),
      cellW: 280,
      cellH: 32,
    }).canvas
  );
});

save(
  "2gi3_q40.png",
  drawGrid(
    [
      ["", "1월", "2월", "3월", "4월"],
      ["노트북", "120", "135", "128", "142"],
      ["프린터", "62", "58", "71", "65"],
      ["모니터", "85", "90", "88", "95"],
      ["키보드", "45", "48", "52", "49"],
    ],
    { headerRows: new Set([0]), cellW: 68 }
  ).canvas
);

console.log("done");
