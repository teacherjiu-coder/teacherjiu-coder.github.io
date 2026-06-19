#!/usr/bin/env python3
"""Generate Excel-style grid PNGs for 2급 정기 3회 (2gi3) questions."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "img"

# Colors (Excel-like)
HDR_BG = (214, 220, 228)
CORNER_BG = (198, 206, 218)
ROW_HDR_BG = (232, 236, 242)
COL_HDR_BG = (232, 236, 242)
DATA_BG = (255, 255, 255)
GRID = (180, 188, 200)
SELECT_BORDER = (33, 115, 70)
SELECT_FILL = (198, 239, 206)
TITLE_BG = (217, 225, 242)
GREEN_HDR = (198, 224, 180)
TEXT = (30, 30, 30)
HEADER_TEXT = (40, 50, 70)

FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "C:/Windows/Fonts/malgun.ttf",
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


FONT = load_font(13)
FONT_SM = load_font(11)
FONT_LG = load_font(14, bold=True)


def text_size(draw: ImageDraw.ImageDraw, text: str, font=FONT) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def col_widths(rows: list[list[str]], min_w: int = 52, pad: int = 14) -> list[int]:
    tmp = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(tmp)
    if not rows:
        return [min_w]
    cols = len(rows[0])
    widths = [min_w] * cols
    for row in rows:
        for i, cell in enumerate(row):
            w, _ = text_size(draw, str(cell))
            widths[i] = max(widths[i], w + pad)
    return widths


def draw_grid(
    rows: list[list[str]],
    *,
    col_labels: list[str] | None = None,
    row_labels: list[str | int] | None = None,
    start_col: str = "A",
    start_row: int = 1,
    cell_w: list[int] | None = None,
    cell_h: int = 26,
    header_h: int = 22,
    row_hdr_w: int = 28,
    col_hdr_h: int = 22,
    selected: set[tuple[int, int]] | None = None,
    header_rows: set[int] | None = None,
    header_style: str = "grey",
    title: str | None = None,
    merges: list[tuple[int, int, int, int]] | None = None,
) -> Image.Image:
    selected = selected or set()
    header_rows = header_rows or set()
    merges = merges or []

    nrows = len(rows)
    ncols = len(rows[0]) if rows else 0
    if cell_w is None:
        cell_w = col_widths(rows)

    grid_w = row_hdr_w + sum(cell_w)
    title_h = 0
    if title:
        title_h = 24
    grid_h = col_hdr_h + header_h + nrows * cell_h + title_h

    img = Image.new("RGB", (grid_w, grid_h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    y0 = title_h

    if title:
        draw.rectangle([0, 0, grid_w, title_h], fill=TITLE_BG, outline=GRID)
        tw, th = text_size(draw, title, FONT_LG)
        draw.text(((grid_w - tw) // 2, (title_h - th) // 2), title, fill=TEXT, font=FONT_LG)

    # corner
    draw.rectangle([0, y0, row_hdr_w, y0 + col_hdr_h + header_h], fill=CORNER_BG, outline=GRID)

    # column letters
    x = row_hdr_w
    for ci in range(ncols):
        label = col_labels[ci] if col_labels else chr(ord(start_col) + ci)
        draw.rectangle([x, y0, x + cell_w[ci], y0 + col_hdr_h], fill=COL_HDR_BG, outline=GRID)
        tw, th = text_size(draw, label, FONT_SM)
        draw.text((x + (cell_w[ci] - tw) // 2, y0 + (col_hdr_h - th) // 2), label, fill=HEADER_TEXT, font=FONT_SM)
        x += cell_w[ci]

    # row numbers + optional column header row
    y = y0 + col_hdr_h
    if header_h:
        draw.rectangle([0, y, row_hdr_w, y + header_h], fill=ROW_HDR_BG, outline=GRID)
        y += header_h

    for ri, row in enumerate(rows):
        rn = row_labels[ri] if row_labels else start_row + ri
        draw.rectangle([0, y, row_hdr_w, y + cell_h], fill=ROW_HDR_BG, outline=GRID)
        tw, th = text_size(draw, str(rn), FONT_SM)
        draw.text((row_hdr_w - tw - 6, y + (cell_h - th) // 2), str(rn), fill=HEADER_TEXT, font=FONT_SM)

        x = row_hdr_w
        for ci, cell in enumerate(row):
            is_hdr = ri in header_rows
            bg = GREEN_HDR if (header_style == "green" and is_hdr) else (HDR_BG if is_hdr else DATA_BG)
            if (ri, ci) in selected:
                bg = SELECT_FILL
            draw.rectangle([x, y, x + cell_w[ci], y + cell_h], fill=bg, outline=GRID)
            val = str(cell)
            font = FONT_SM if len(val) > 12 else FONT
            tw, th = text_size(draw, val, font)
            if is_hdr:
                tx = x + (cell_w[ci] - tw) // 2
            elif val.replace(",", "").replace(".", "").replace("-", "").isdigit() or val.startswith((">", "<", "=")):
                tx = x + cell_w[ci] - tw - 6
            else:
                tx = x + 6
            draw.text((tx, y + (cell_h - th) // 2), val, fill=TEXT, font=font)
            if (ri, ci) in selected:
                draw.rectangle([x + 1, y + 1, x + cell_w[ci] - 2, y + cell_h - 2], outline=SELECT_BORDER, width=2)
            x += cell_w[ci]
        y += cell_h

    return img


def save(name: str, img: Image.Image) -> None:
    path = OUT / name
    img.save(path, "PNG")
    print("saved", path)


def q21_main() -> None:
    rows = [
        ["성명", "직위", "근속연수", "", "조건", "", ""],
        ["김일민", "부장", "20", "", "성명", "직위", "근속연수"],
        ["김유민", "사원", "4", "", "김*", "", ">10"],
        ["이지연", "과장", "12", "", "", "사원", "<5"],
        ["이민석", "부장", "14", "", "", "", ""],
        ["석명희", "사원", "2", "", "", "", ""],
        ["민호성", "사원", "11", "", "", "", ""],
    ]
    img = draw_grid(rows, start_row=1, header_rows={0, 1}, header_style="green", cell_h=28)
    save("2gi3_q21.png", img)


def q21_option(data: list[list[str]], idx: int) -> None:
    rows = [["성명", "직위", "근속연수"]] + data
    img = draw_grid(rows, start_row=1, header_rows={0}, header_style="green", cell_h=26)
    save(f"2gi3_q21_{idx}.png", img)


def q26_options() -> None:
    specs = [
        (["314826", "#,##0,", "315"], 1),
        (["281476", "#,##0.0", "281,476.0"], 2),
        (["12:00:00 AM", "0", "0"], 3),
        (["2018-03-25", "yyyy-mmmm", "2018-March"], 4),
    ]
    for vals, idx in specs:
        rows = [["원본", "서식", "결과"], vals]
        img = draw_grid(rows, col_labels=["A", "B", "C"], start_row=1, header_rows={0}, header_style="green", cell_h=28)
        save(f"2gi3_q26_{idx}.png", img)


def q28() -> None:
    rows = [
        ["10", "20", "30", "40", "50"],
        ["11", "21", "31", "41", "51"],
        ["12", "22", "32", "42", "52"],
        ["13", "23", "33", "43", "53"],
        ["14", "24", "34", "44", "54"],
        ["15", "25", "35", "45", "55"],
    ]
    img = draw_grid(rows, start_col="A", start_row=1, selected={(3, 3)}, cell_h=28)
    save("2gi3_q28.png", img)


def q30() -> None:
    # Two panels side by side
    fig1 = draw_grid(
        [["", "성적현황"], ["국어", "85"], ["영어", "90"], ["수학", "78"], ["과학", "88"], ["사회", "92"]],
        start_col="A",
        start_row=1,
        selected={(0, 0)},
        header_rows={0},
        cell_h=26,
    )
    fig2 = draw_grid(
        [["", "성적현황"], ["국어", "85"], ["영어", "90"], ["수학", "78"], ["과학", "88"], ["사회", "92"]],
        start_col="C",
        start_row=1,
        selected={(2, 0)},
        header_rows={0},
        cell_h=26,
    )
    label_h = 22
    gap = 24
    total_w = fig1.width + gap + fig2.width
    total_h = label_h + max(fig1.height, fig2.height)
    canvas = Image.new("RGB", (total_w, total_h), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((fig1.width // 2 - 20, 2), "그림1", fill=TEXT, font=FONT_LG)
    draw.text((fig1.width + gap + fig2.width // 2 - 20, 2), "그림2", fill=TEXT, font=FONT_LG)
    canvas.paste(fig1, (0, label_h))
    canvas.paste(fig2, (fig1.width + gap, label_h))
    save("2gi3_q30.png", canvas)


# Q33 sales data — typical 2급 정기 3회 기출 (제품명/판매수량/단가)
Q33_DATA = [
    ["제품명", "판매수량", "단가"],
    ["노트북", "120", "1,500,000"],
    ["프린터", "62", "450,000"],
    ["모니터", "85", "320,000"],
    ["키보드", "45", "89,000"],
    ["마우스", "38", "45,000"],
    ["스피커", "72", "120,000"],
    ["헤드셋", "88", "180,000"],
]

Q33_OPTIONS = [
    ["=B2<=AVERAGE($B$2:$B$8)"],
    ["=B2>=AVERAGE(B2:B8)"],
    ["=B2>AVERAGE($B$2:$B$8)"],
    ["=B2>=AVERAGE($B$2:$B$8)"],
]


def q33_main() -> None:
    img = draw_grid(Q33_DATA, start_row=1, header_rows={0}, header_style="green", cell_h=28)
    save("2gi3_q33.png", img)


def q33_options() -> None:
    for i, formula in enumerate(Q33_OPTIONS, 1):
        rows = [["판매수량"], formula]
        img = draw_grid(rows, start_col="A", start_row=10, header_rows={0}, header_style="green", cell_h=30, cell_w=[220])
        save(f"2gi3_q33_{i}.png", img)


def q40() -> None:
    rows = [
        ["", "1월", "2월", "3월", "4월"],
        ["노트북", "120", "135", "128", "142"],
        ["프린터", "62", "58", "71", "65"],
        ["모니터", "85", "90", "88", "95"],
        ["키보드", "45", "48", "52", "49"],
    ]
    img = draw_grid(rows, start_row=1, header_rows={0}, header_style="green", cell_h=28)
    save("2gi3_q40.png", img)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    q21_main()
    q21_option([["김일민", "부장", "20"], ["김유민", "사원", "4"]], 1)
    q21_option([["김일민", "부장", "20"], ["석명희", "사원", "2"]], 2)
    q21_option([["김일민", "부장", "20"], ["김유민", "사원", "4"], ["석명희", "사원", "2"]], 3)
    q21_option(
        [["김일민", "부장", "20"], ["김유민", "사원", "4"], ["석명희", "사원", "2"], ["민호성", "사원", "11"]],
        4,
    )
    q26_options()
    q28()
    q30()
    q33_main()
    q33_options()
    q40()
    print("done")


if __name__ == "__main__":
    main()
