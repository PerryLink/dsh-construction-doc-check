#!/usr/bin/env python3
"""README visuals for dsh-construction-doc-check — read off the shipped scan.

Outputs (docs/assets/, idempotent overwrite):

  dsh-construction-doc-check-hero-{zh,en}-{light,dark}.webp   1440x576
  dsh-construction-doc-check-flow-v5-{light,dark}.svg         1100x660

Both figures are derived from what this package actually ships, not from a
generic checker template:

  * `samples/quickstart/expected/result.json` — the receipt drawn in the hero is
    that file, line for line: tool / packVersion / summary{present 12, missing 0,
    errors 0, warnings 0, infos 0, dirsScanned 7, filesScanned 12} /
    missingCategories []. Not one number is invented; the sample archive holds
    twelve files under six category folders plus the root = seven directories.
  * `src/engine.ts` `scan()` / `check()` — the tree in the flow figure is the one
    the walk sees (`files[{ path, name, bytes }]`), and the two side cards are the
    two rules that cannot be answered by one path: CD-040 groups the whole
    `files[]` by `baseNameOf()`, CD-041 reads `stat().size` against
    `emptyFileBytes`.
  * `rules/construction-doc-check.yaml` — twelve path rules (CD-001 … CD-030) and
    the two set-level rules (CD-040 / CD-041), pack `2026.1`, `as_of 2026-10-23`,
    `scan.maxDepth 6`, six `skipDirs`, `emptyFileBytes 0`; severity split is
    error 8 / warn 2 / info 4.
  * The twelve matches below are the real ones: each path rule finds exactly one
    of the twelve sample files, so the run is 12 present / 0 missing, and both
    set-level rules find nothing.

Hero: left column is the copy block (kicker / two-line wordmark / two value
lines / one subtitle / one meta line / footer). The right side is this plugin's
own artifact: the `result.json` receipt on a stacked-sheet card, with the rule
pack's composition and the three claims the tool refuses to make beside it.

Flow: grammar = a TREE, not a row of nodes. The scanned archive is drawn as the
tree it is — root, six category folders, twelve file leaves — and each folder
carries the rule ids that matched on that branch. The two set-level rules sit in
their own rail (they read the same `files[]` as a set, which no single path can
answer), and one run's counts close the figure as a receipt.

Old single-skin assets (`…-flow.svg`, `…-hero.png`, `…-demo.gif`, `quickstart.*`)
are deliberately left on disk so existing external links keep resolving; the
READMEs reference only the new hero and flow-v5 pair.

Every label is measured before it is drawn; a label that would overflow aborts
the run instead of shipping clipped text.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow + Windows fonts msyh.ttc / msyhbd.ttc / consola.ttf.
"""
from __future__ import annotations

import os
import re
import sys
import xml.etree.ElementTree as ET
from html import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")
NAME = "dsh-construction-doc-check"

FONT_FILES = {
    "cjk": r"C:\Windows\Fonts\msyh.ttc",
    "cjk_bold": r"C:\Windows\Fonts\msyhbd.ttc",
    "mono": r"C:\Windows\Fonts\consola.ttf",
    "mono_bold": r"C:\Windows\Fonts\consolab.ttf",
}
for _kind, _path in FONT_FILES.items():
    if not os.path.exists(_path):
        raise SystemExit(f"FATAL: font missing: {_path}")

RADIUS = 20
os.makedirs(OUT, exist_ok=True)

SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        card="#ffffff", edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", ok="#15803d", warn="#b45309", danger="#b3261e",
        pill="#ece7f9", band="#f5f2fb", grid="#e7e4f0",
        shadow=(43, 35, 80), shadow_alpha=54, glow=34,
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        card="#1b2231", edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", ok="#3fb950", warn="#d9a441", danger="#f0776a",
        pill="#242d42", band="#202839", grid="#2b3348",
        shadow=(0, 0, 0), shadow_alpha=150, glow=46,
    ),
}

FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        panel="#ffffff", card="#ffffff", edge="#e6e2ef",
        band="#f5f2fb", pill="#ece7f9",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", ok="#15803d", warn="#b45309",
        rule="#e7e4f0", shadow="#2b2440", shadow_op="0.14",
        dot="#cfc8e2", dot_op="0.55",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        panel="#1b2231", card="#1b2231", edge="#2e374b",
        band="#202839", pill="#242d42",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", ok="#3fb950", warn="#d9a441",
        rule="#2b3348", shadow="#000000", shadow_op="0.52",
        dot="#2a3346", dot_op="0.55",
    ),
}

FONT_CSS_SANS = ("'Microsoft YaHei','Segoe UI','PingFang SC',"
                 "'Noto Sans CJK SC',sans-serif")
FONT_CSS_MONO = "Consolas,'Microsoft YaHei',ui-monospace,monospace"

# ---------------------------------------------------------------------------
# fonts + measuring
# ---------------------------------------------------------------------------
_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}
_MEASURE = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def font(size: int, kind: str = "cjk") -> ImageFont.FreeTypeFont:
    key = (kind, int(size))
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_FILES[kind], int(size))
    return _font_cache[key]


def measure(text: str, size: float, kind: str = "cjk") -> float:
    return _MEASURE.textlength(text, font=font(round(size), kind))


def require_w(text: str, size: float, kind: str, max_w: float, what: str) -> None:
    got = measure(text, size, kind)
    if got > max_w + 0.4:
        raise SystemExit(f"FATAL: {what} overflows: {text!r} needs "
                         f"{got:.1f}px > {max_w:.0f}px")


def fit(text: str, kind: str, max_w: float, start: int, minimum: int) -> int:
    size = start
    while size > minimum:
        if measure(text, size, kind) <= max_w:
            return size
        size -= 1
    raise SystemExit(f"FATAL: text does not fit {max_w:.0f}px at >= {minimum}px: "
                     f"{text!r}")


def fit_lines(lines: list[str], kind: str, max_w: float, start: int,
              minimum: int) -> int:
    return min(fit(line, kind, max_w, start, minimum) for line in lines)


def hx(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# raster primitives
# ---------------------------------------------------------------------------
def gradient(w: int, h: int, top: str, bottom: str) -> Image.Image:
    base = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(base)
    a, b = hx(top), hx(bottom)
    for y in range(h):
        t = 0.12 * (y / h) + 0.88 * (y / h) ** 1.3
        draw.line([(0, y), (w, y)],
                  fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return base


def glow(img: Image.Image, cx: int, cy: int, r: int, color: str,
         alpha: int) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rgb = hx(color)
    for i in range(10, 0, -1):
        rr = r * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=rgb + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"),
                                 layer.filter(ImageFilter.GaussianBlur(26))
                                 ).convert("RGB")


def card(img: Image.Image, box: tuple[int, int, int, int], s: dict,
         radius: int = RADIUS, shadow: int = 22,
         fill: str | None = None, edge: str | None = None) -> Image.Image:
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([x0 + 2, y0 + max(4, shadow // 2), x1 + 2,
                         y1 + max(5, shadow // 2)],
                        radius=radius, fill=s["shadow"] + (s["shadow_alpha"],))
    base = Image.alpha_composite(img.convert("RGBA"),
                                 layer.filter(ImageFilter.GaussianBlur(shadow / 2)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(fill or s["card"]),
                        outline=hx(edge or s["edge"]), width=2)
    return base.convert("RGB")


def pill(img: Image.Image, xy: tuple[int, int], text: str, s: dict,
         size: int = 16, fg: str | None = None, bg: str | None = None,
         kind: str = "cjk_bold") -> int:
    d = ImageDraw.Draw(img)
    f = font(size, kind)
    w = d.textlength(text, font=f)
    x, y = xy
    h = size + 20
    d.rounded_rectangle([x, y, x + w + 30, y + h], radius=h // 2,
                        fill=hx(bg or s["pill"]))
    d.text((x + 15, y + h / 2), text, font=f, fill=hx(fg or s["accent"]),
           anchor="lm")
    return int(x + w + 30)


def chip_right(img: Image.Image, right: int, y: int, text: str, fg: str,
               bg: str, size: int = 11, height: int = 24,
               kind: str = "mono_bold") -> int:
    d = ImageDraw.Draw(img)
    w = d.textlength(text, font=font(size, kind)) + 18
    x = right - w
    d.rounded_rectangle([x, y, right, y + height], radius=height / 2,
                        fill=hx(bg))
    d.text((x + 9, y + height / 2), text, font=font(size, kind),
           fill=hx(fg), anchor="lm")
    return int(x)


def rich_line(img: Image.Image, x: int, y: int, runs: list[tuple[str, str, str]],
              size: float) -> float:
    """Draw runs of (text, colour, kind) left to right; return the end x."""
    d = ImageDraw.Draw(img)
    cursor = float(x)
    for text, color, kind in runs:
        d.text((cursor, y), text, font=font(round(size), kind),
               fill=hx(color), anchor="ls")
        cursor += measure(text, size, kind)
    return cursor


# ---------------------------------------------------------------------------
# hero
# ---------------------------------------------------------------------------
JSON_RECEIPT = [
    "{",
    '  "tool": "construction_doc_check",',
    '  "packVersion": "2026.1",',
    '  "summary": {',
    '    "present": 12,',
    '    "missing": 0,',
    '    "errors": 0,',
    '    "warnings": 0,',
    '    "infos": 0,',
    '    "dirsScanned": 7,',
    '    "filesScanned": 12',
    "  },",
    '  "missingCategories": []',
    "}",
]

HERO = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · 目录核查",
        title=("dsh-construction-", "doc-check"),
        value=("扫一遍资料目录，缺哪一类、", "依据哪一条，一次列清。"),
        sub="只按相对路径与文件名核对，不打开文件、不判合规。",
        meta=[("construction_doc_check", "mono"),
              (" · 14 条规则 · 7 类 · ", "cjk"),
              ("CD-001..CD-041", "mono")],
        foot="Apache-2.0 · 只读 · 不联网 · 不调用模型 · 不写文件",
        pack_label="规则库",
        pack_big="14 条 · 7 类",
        pack_version="v2026.1 · as_of 2026-10-23",
        pack_ids="CD-001 .. CD-041",
        pack_foot="每条规则带条款依据",
        boundary_label="边界",
        boundary=["不打开文件", "不判份数", "不下结论", "不认定责任"],
        boundary_foot="只读 · 无网络 · 不调用模型",
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · directory checker",
        title=("dsh-construction-", "doc-check"),
        value=("Sweep the archive, see which kind is", "missing — and the clause behind it."),
        sub="Path and name only — no file opened, no verdict.",
        meta=[("construction_doc_check", "mono"),
              (" · 14 rules · 7 categories · ", "cjk"),
              ("CD-001..CD-041", "mono")],
        foot="Apache-2.0 · read-only · no network · no model call · no file written",
        pack_label="RULE PACK",
        pack_big="14 rules · 7 categories",
        pack_version="v2026.1 · as_of 2026-10-23",
        pack_ids="CD-001 .. CD-041",
        pack_foot="every rule cites a clause",
        boundary_label="BOUNDARY",
        boundary=["no document opened", "counts not judged",
                  "verdict stays human", "no liability assigned"],
        boundary_foot="read-only · no network",
    ),
}

SEVERITIES = [("error", 8, "danger"), ("warn", 2, "warn"), ("info", 4, "accent")]


def _json_tokens(line: str) -> list[tuple[str, str]]:
    tokens = re.findall(r'"[^"]*"|\d+|\s+|[{}[\]:,]', line)
    out: list[tuple[str, str]] = []
    for i, token in enumerate(tokens):
        if token.startswith('"'):
            rest = "".join(tokens[i + 1:]).lstrip()
            out.append((token, "accent" if rest.startswith(":") else "sub"))
        elif token.isdigit():
            out.append((token, "warn"))
        elif token.isspace():
            out.append((token, "faint"))
        else:
            out.append((token, "faint"))
    return out


def draw_receipt(img: Image.Image, s: dict) -> Image.Image:
    d = ImageDraw.Draw(img)
    size, leading = 19, 25
    x0, y0 = 706, 146
    for index, line in enumerate(JSON_RECEIPT):
        y = y0 + index * leading
        d.text((676, y), f"{index + 1:>2}", font=font(11, "mono"),
               fill=hx(s["faint"]), anchor="ls")
        cursor = float(x0)
        for token, color in _json_tokens(line):
            d.text((cursor, y), token, font=font(size, "mono"),
                   fill=hx(s[color]), anchor="ls")
            cursor += measure(token, size, "mono")
        if cursor > 1094:
            raise SystemExit(f"FATAL: JSON line {index + 1} overflows: "
                             f"{cursor:.0f}px > 1094px")
    return img


def hero(lang: str, skin: str) -> None:
    s = SKIN[skin]
    h = HERO[lang]
    W, H = 1440, 576
    img = gradient(W, H, s["bg_from"], s["bg_to"])
    img = glow(img, 1150, 80, 400, s["accent"], s["glow"])
    img = glow(img, 200, 545, 310, s["accent"], max(8, s["glow"] // 3))

    m, col_w = 56, 556
    d = ImageDraw.Draw(img)

    # ---- left copy column ---------------------------------------------------
    pill(img, (m, 44), h["kicker"], s, size=16)
    d = ImageDraw.Draw(img)

    title_size = fit_lines(list(h["title"]), "mono_bold", col_w, 58, 50)
    for line in h["title"]:
        require_w(line, title_size, "mono_bold", col_w, "hero title")
    d.text((m - 1, 136), h["title"][0], font=font(title_size, "mono_bold"),
           fill=hx(s["text"]), anchor="ls")
    # the second half of the wordmark carries the family accent
    d.text((m - 1, 200), h["title"][1], font=font(title_size, "mono_bold"),
           fill=hx(s["accent"]), anchor="ls")

    value_size = fit_lines(list(h["value"]), "cjk_bold", col_w,
                           34 if lang == "zh" else 33, 28)
    for index, line in enumerate(h["value"]):
        require_w(line, value_size, "cjk_bold", col_w, "hero value line")
        d.text((m, 266 + index * 48), line, font=font(value_size, "cjk_bold"),
               fill=hx(s["text"]), anchor="ls")

    sub_size = fit(h["sub"], "cjk", col_w, 21, 16)
    require_w(h["sub"], sub_size, "cjk", col_w, "hero subtitle")
    d.text((m, 368), h["sub"], font=font(sub_size, "cjk"),
           fill=hx(s["sub"]), anchor="ls")

    meta_runs = [(text, s["faint"], kind) for text, kind in h["meta"]]
    meta_end = m
    for text, color, kind in meta_runs:
        meta_end += measure(text, 14, kind)
    if meta_end > m + col_w:
        raise SystemExit("FATAL: hero meta overflows")
    rich_line(img, m + 1, 418, meta_runs, 14)

    d = ImageDraw.Draw(img)
    d.line([m + 1, 456, m + col_w - 4, 456], fill=hx(s["grid"]), width=2)
    require_w(h["foot"], 14, "cjk", col_w, "hero footer")
    d.text((m + 1, 480), h["foot"], font=font(14, "cjk"),
           fill=hx(s["faint"]), anchor="ls")

    # ---- right: the result.json receipt on a stacked sheet ------------------
    img = card(img, (676, 44, 1136, 500), s, radius=20, shadow=24,
               fill=s["band"])
    img = card(img, (656, 64, 1118, 516), s, radius=20, shadow=30)
    d = ImageDraw.Draw(img)
    # title bar
    d.rounded_rectangle([656, 64, 1118, 108], radius=20, fill=hx(s["band"]))
    d.rectangle([656, 86, 1118, 108], fill=hx(s["band"]))
    d.line([656, 108, 1118, 108], fill=hx(s["edge"]), width=1)
    for i, color in enumerate(("warn", "ok", "accent")):
        d.ellipse([680 + i * 16, 80, 690 + i * 16, 90], fill=hx(s[color]))
    d.text((734, 94), "result.json", font=font(13, "mono_bold"),
           fill=hx(s["text"]), anchor="ls")
    chip_right(img, 1098, 76, "construction_doc_check", s["accent"], s["pill"],
               size=12, height=24)

    require_w("samples/quickstart/expected/result.json", 11, "mono", 390,
              "receipt source")
    img = draw_receipt(img, s)
    d = ImageDraw.Draw(img)
    d.text((706, 492), "samples/quickstart/expected/result.json",
           font=font(12, "mono"), fill=hx(s["faint"]), anchor="ls")

    # ---- right rail: rule pack + boundary ----------------------------------
    img = card(img, (1152, 64, 1384, 320), s, radius=18, shadow=20)
    d = ImageDraw.Draw(img)
    require_w(h["pack_label"], 12, "cjk_bold", 196, "pack label")
    d.text((1170, 96), h["pack_label"], font=font(12, "cjk_bold"),
           fill=hx(s["faint"]), anchor="ls")
    require_w(h["pack_big"], 17, "cjk_bold", 196, "pack big")
    d.text((1170, 130), h["pack_big"], font=font(17, "cjk_bold"),
           fill=hx(s["text"]), anchor="ls")
    require_w(h["pack_version"], 12, "mono", 196, "pack version")
    d.text((1170, 162), h["pack_version"], font=font(12, "mono"),
           fill=hx(s["sub"]), anchor="ls")
    d.line([1170, 182, 1366, 182], fill=hx(s["grid"]), width=1)
    for index, (label, count, color) in enumerate(SEVERITIES):
        y = 208 + index * 24
        d.ellipse([1170, y - 10, 1180, y], fill=hx(s[color]))
        d.text((1190, y), label, font=font(12, "mono"), fill=hx(s["sub"]),
               anchor="ls")
        d.text((1366, y), str(count), font=font(13, "mono_bold"),
               fill=hx(s[color]), anchor="rs")
    require_w(h["pack_ids"], 12, "mono_bold", 196, "pack ids")
    d.text((1170, 284), h["pack_ids"], font=font(12, "mono_bold"),
           fill=hx(s["accent"]), anchor="ls")
    require_w(h["pack_foot"], 12, "cjk", 196, "pack foot")
    d.text((1170, 306), h["pack_foot"], font=font(12, "cjk"),
           fill=hx(s["faint"]), anchor="ls")

    img = card(img, (1152, 332, 1384, 556), s, radius=18, shadow=20)
    d = ImageDraw.Draw(img)
    require_w(h["boundary_label"], 12, "cjk_bold", 196, "boundary label")
    d.text((1170, 364), h["boundary_label"], font=font(12, "cjk_bold"),
           fill=hx(s["faint"]), anchor="ls")
    for index, line in enumerate(h["boundary"]):
        y = 398 + index * 27
        require_w(line, 12.5, "cjk", 196, "boundary line")
        d.line([1170, y - 5, 1182, y - 5], fill=hx(s["ok"]), width=2)
        d.text((1192, y), line, font=font(12.5, "cjk"), fill=hx(s["text"]),
               anchor="ls")
    require_w(h["boundary_foot"], 11, "cjk", 196, "boundary foot")
    d.text((1170, 500), h["boundary_foot"], font=font(12, "cjk"),
           fill=hx(s["faint"]), anchor="ls")
    d.text((1170, 524), "Apache-2.0", font=font(12, "mono_bold"),
           fill=hx(s["accent"]), anchor="ls")

    name = f"{NAME}-hero-{lang}-{skin}.webp"
    img.save(os.path.join(OUT, name), "WEBP", quality=92, method=6)
    print(f"wrote {name} ({W}x{H})")


# ---------------------------------------------------------------------------
# flow: the scanned tree + the two set-level rules + one run's receipt
# ---------------------------------------------------------------------------
# The twelve matches below were read off the sample archive with the pack's own
# patterns; each path rule finds exactly one file, which is why the run is
# 12 present / 0 missing.
TREE = [
    ("竣工验收", ["CD-001", "CD-002", "CD-003"],
     ["单位工程质量竣工验收记录.docx", "工程质量保修书.docx", "竣工报告.docx"]),
    ("施工记录", ["CD-010", "CD-011", "CD-012", "CD-015"],
     ["主体结构分部工程验收记录.docx", "施工日志.docx", "检验批质量验收记录.xlsx",
      "隐蔽工程验收记录.docx"]),
    ("施工试验", ["CD-013"], ["钢筋复试报告.pdf"]),
    ("监理资料", ["CD-014"], ["监理日志.pdf"]),
    ("危大工程", ["CD-020", "CD-021"],
     ["模板工程专项施工方案.docx", "模板工程验收记录.docx"]),
    ("安全管理", ["CD-030"], ["生产安全事故应急预案.docx"]),
]

SET_RULES = [
    dict(
        id="CD-040", title="version leftovers", cap="≤ info",
        lines=[
            ("READS", [("files[] -> group by baseNameOf(name)", "sub", "mono")]),
            ("STRIP", [("(1) 副本 最终 最新 修订 修改 旧版 V2", "sub", "cjk")]),
            ("HIT", [(">= 2 files share one base name", "sub", "mono")]),
            ("RUN", [("0 groups over 12 base names", "sub", "mono")]),
            ("CAP", [("institutional-configuration ", "faint", "mono"),
                     ("≤ info", "accent", "mono")]),
        ],
    ),
    dict(
        id="CD-041", title="zero-byte files", cap="≤ info",
        lines=[
            ("READS", [("stat().size for every file", "sub", "mono")]),
            ("HIT", [("bytes ", "sub", "mono"), ("≤ emptyFileBytes", "accent", "mono"),
                     (" (0)", "sub", "mono")]),
            ("RUN", [("0 of 12 files are zero-byte", "sub", "mono")]),
            ("NOTE", [("a zero-byte file still counts as present", "sub", "mono")]),
            ("CAP", [("institutional-configuration ", "faint", "mono"),
                     ("≤ info", "accent", "mono")]),
        ],
    ),
]

RECEIPT = [("12", "present"), ("0", "missing"), ("0", "errors"), ("0", "warnings"),
           ("0", "infos"), ("14", "rules"), ("7", "dirs"), ("12", "files")]


class Svg:
    """Tiny SVG writer that measures every label before it is emitted."""

    def __init__(self, s: dict) -> None:
        self.s = s
        self.parts: list[str] = []
        self.bad: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def _w(self, content: str, size: float, kind: str,
           tracking: float | None = None) -> float:
        got = measure(content, size, kind)
        if tracking:
            got += tracking * max(len(content) - 1, 0)
        return got

    def text(self, x: float, y: float, content: str, size: float, fill: str, *,
             anchor: str = "start", weight: int | None = None,
             mono: bool = False, max_w: float | None = None,
             opacity: float | None = None, tracking: float | None = None) -> None:
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        if max_w is not None and self._w(content, size, kind, tracking) > max_w + 0.4:
            self.bad.append(f"{content!r} needs "
                            f"{self._w(content, size, kind):.1f}px > {max_w:.0f}px")
        attrs = [f'x="{x}"', f'y="{y}"', f'fill="{fill}"',
                 f'font-family="{FONT_CSS_MONO if mono else FONT_CSS_SANS}"',
                 f'font-size="{size}"']
        if anchor != "start":
            attrs.append(f'text-anchor="{anchor}"')
        if weight:
            attrs.append(f'font-weight="{weight}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if tracking:
            attrs.append(f'letter-spacing="{tracking}"')
        self.add(f'<text {" ".join(attrs)}>{escape(content)}</text>')

    def rich(self, x: float, y: float, runs: list[tuple[str, str, str]],
             size: float, *, anchor: str = "start",
             max_w: float | None = None) -> float:
        """Draw runs of (text, fill, kind[mono|cjk + optional bold])."""
        widths = [self._w(text, size, kind) for text, _, kind in runs]
        total = sum(widths)
        if max_w is not None and total > max_w + 0.4:
            self.bad.append(f"{''.join(r[0] for r in runs)!r} needs "
                            f"{total:.1f}px > {max_w:.0f}px")
        cursor = x - total if anchor == "end" else x
        for (text, fill, kind), width in zip(runs, widths):
            mono = kind.startswith("mono")
            attrs = [f'x="{cursor}"', f'y="{y}"', f'fill="{fill}"',
                     f'font-family="{FONT_CSS_MONO if mono else FONT_CSS_SANS}"',
                     f'font-size="{size}"']
            if kind.endswith("_bold"):
                attrs.append('font-weight="700"')
            self.add(f'<text {" ".join(attrs)}>{escape(text)}</text>')
            cursor += width
        return cursor

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str,
             rx: float = 0, stroke: str | None = None, sw: float = 1.5,
             shadow: bool = False, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"']
        if rx:
            attrs.append(f'rx="{rx}"')
        attrs.append(f'fill="{fill}"')
        if stroke:
            attrs += [f'stroke="{stroke}"', f'stroke-width="{sw}"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if shadow:
            attrs.append('filter="url(#soft)"')
        self.add(f'<rect {" ".join(attrs)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str,
             sw: float = 1.5, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"',
                 f'stroke="{stroke}"', f'stroke-width="{sw}"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<line {" ".join(attrs)}/>')

    def path(self, d: str, *, stroke: str, sw: float = 1.5,
             fill: str = "none", dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"',
                 f'stroke-width="{sw}"', 'stroke-linejoin="round"',
                 'stroke-linecap="round"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<path {" ".join(attrs)}/>')

    def circle(self, cx: float, cy: float, r: float, *, fill: str,
               stroke: str | None = None, sw: float = 1.5) -> None:
        attrs = [f'cx="{cx}"', f'cy="{cy}"', f'r="{r}"', f'fill="{fill}"']
        if stroke:
            attrs += [f'stroke="{stroke}"', f'stroke-width="{sw}"']
        self.add(f'<circle {" ".join(attrs)}/>')

    def chip_right(self, right: float, y: float, label: str, fg: str, bg: str,
                   *, size: float = 11, pad: float = 9, height: float = 22,
                   mono: bool = False, weight: int | None = None) -> float:
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        w = self._w(label, size, kind) + pad * 2
        x = right - w
        self.rect(x, y, w, height, fill=bg, rx=height / 2)
        self.text(x + pad, y + height / 2 + size * 0.35, label, size, fg,
                  mono=mono, weight=weight)
        return x

    def svg(self, w: int, h: int, title: str, desc: str) -> str:
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" '
                f'height="{h}" viewBox="0 0 {w} {h}" role="img" '
                f'aria-labelledby="title desc">')
        return "\n".join([head, f'<title id="title">{escape(title)}</title>',
                          f'<desc id="desc">{escape(desc)}</desc>',
                          *self.parts, "</svg>"]) + "\n"


def flow_svg(skin: str) -> str:
    f = FLOW[skin]
    W, H = 1100, 660
    v = Svg(f)

    v.add("<defs>")
    v.add(f'<linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">'
          f'<stop offset="0" stop-color="{f["bg_from"]}"/>'
          f'<stop offset="1" stop-color="{f["bg_to"]}"/></linearGradient>')
    v.add(f'<filter id="soft" x="-30%" y="-30%" width="160%" height="180%">'
          f'<feDropShadow dx="0" dy="7" stdDeviation="9" '
          f'flood-color="{f["shadow"]}" flood-opacity="{f["shadow_op"]}"/>'
          f'</filter>')
    v.add(f'<pattern id="dots" width="24" height="24" '
          f'patternUnits="userSpaceOnUse">'
          f'<circle cx="1.2" cy="1.2" r="1.2" fill="{f["dot"]}"/></pattern>')
    v.add("</defs>")

    v.rect(0, 0, W, H, fill="url(#bg)")
    v.rect(0, 0, W, H, fill="url(#dots)", opacity=f["dot_op"])

    # ---- header -------------------------------------------------------------
    v.text(44, 58, NAME, 30, f["text"], weight=700, mono=True, max_w=700)
    v.text(44, 86, "One archive tree, fourteen rules: twelve read a relative "
                   "path, two read the set.", 14.5, f["sub"], max_w=760)
    v.chip_right(1056, 30, "rules/construction-doc-check.yaml · v2026.1",
                 f["accent"], f["pill"], size=11.5, pad=12, height=28,
                 mono=True)
    v.text(44, 112, "IN  ·  dir -> 7 dirs · 12 files  ·  path + name + bytes",
           11, f["faint"], mono=True, max_w=520)
    v.text(1056, 112, "OUT  ·  summary + findings[] + warnings[]", 11,
           f["faint"], mono=True, anchor="end", max_w=260)
    v.line(44, 126, 1056, 126, stroke=f["rule"], sw=1, opacity=0.75)

    # ---- left: the tree -----------------------------------------------------
    v.text(44, 145, "ARCHIVE TREE · FILENAME-ONLY · ALL 12 PATHS MATCHED", 11,
           f["faint"], weight=700, tracking=1.0, max_w=560)
    v.rect(44, 152, 592, 452, fill=f["panel"], rx=18, stroke=f["edge"],
           sw=1.5, shadow=True)

    # root
    v.rect(60, 166, 560, 28, fill=f["band"], rx=9)
    v.rect(60, 166, 3, 28, fill=f["accent"], rx=1.5)
    v.text(76, 185, "archive/", 14, f["text"], weight=700, mono=True,
           max_w=200)
    v.text(606, 184, "7 dirs · 12 files", 11, f["faint"], mono=True,
           anchor="end", max_w=200)
    v.text(76, 212, "walk() -> files[{ path, name, bytes }]", 11, f["faint"],
           mono=True, max_w=420)

    trunk_x = 68
    folder_x = 82
    spine_x = 112
    leaf_glyph_x = 120
    leaf_text_x = 138
    folder_h, leaf_h = 22, 19
    groups = []
    y = 222
    for name, rule_ids, files in TREE:
        groups.append((y, name, rule_ids, files))
        y += folder_h + len(files) * leaf_h
    v.path(f"M{trunk_x} 194 V{groups[-1][0] + folder_h // 2}", stroke=f["rule"],
           sw=1.2)
    for y, name, rule_ids, files in groups:
        cy = y + folder_h // 2
        v.path(f"M{trunk_x} {cy} H{folder_x}", stroke=f["rule"], sw=1.2)
        # folder glyph
        v.rect(folder_x, cy - 5, 15, 11, fill=f["accent"], rx=2,
               opacity=0.92)
        v.rect(folder_x, cy - 8, 7, 4, fill=f["accent"], rx=1.5,
               opacity=0.92)
        v.text(folder_x + 22, cy + 4.5, name, 13, f["text"], weight=700,
               max_w=160)
        name_w = measure(name, 13, "cjk_bold")
        v.text(folder_x + 22 + name_w + 12, cy + 4.5,
               f"{len(files)} files", 11, f["faint"], mono=True, max_w=80)
        # capsule of the rule ids that matched on this branch
        label = " · ".join(rule_ids)
        chip_w = measure(label, 11, "mono") + 30
        chip_x = 620 - chip_w
        v.rect(chip_x, cy - 9, chip_w, 18, fill=f["pill"], rx=9)
        v.circle(chip_x + 9, cy, 2.6, fill=f["ok"])
        v.text(chip_x + 16, cy + 4, label, 11, f["accent"], mono=True,
               max_w=230)
        # leaves
        centers = [y + folder_h + leaf_h * index + leaf_h / 2
                   for index in range(len(files))]
        if centers:
            v.path(f"M{spine_x} {cy} V{centers[-1]}", stroke=f["rule"], sw=1.2)
        for center, leaf in zip(centers, files):
            v.path(f"M{spine_x} {center} H{leaf_glyph_x}", stroke=f["rule"],
                   sw=1.2)
            v.rect(leaf_glyph_x, center - 8, 9, 11, fill=f["panel"],
                   stroke=f["sub"], sw=1.1, rx=1.5)
            v.path(f"M{leaf_glyph_x + 6} {center - 8} V{center - 5} "
                   f"H{leaf_glyph_x + 9}", stroke=f["sub"], sw=1.1)
            v.text(leaf_text_x, center + 4.5, leaf, 13, f["sub"], max_w=250)

    v.text(60, 596, "capsule = rule ids that found a file on this branch · "
                    "all 12 fired · 0 missing", 11, f["faint"], max_w=540)

    # ---- right: the two set-level rules ------------------------------------
    v.text(656, 145, "SET-LEVEL · THE SAME files[] READ AS A SET", 11,
           f["faint"], weight=700, tracking=1.0, max_w=400)

    for index, rule in enumerate(SET_RULES):
        top = 152 + index * 156
        v.rect(656, top, 400, 148, fill=f["card"], rx=18, stroke=f["edge"],
               sw=1.5, shadow=True)
        v.rect(656, top, 4, 148, fill=f["accent"], rx=2, opacity=0.9)
        v.text(678, top + 28, rule["id"], 12, f["text"], weight=700, mono=True,
               max_w=64)
        v.text(742, top + 28, rule["title"], 13.5, f["text"], weight=700,
               max_w=200)
        v.chip_right(1036, top + 16, rule["cap"], f["accent"], f["pill"],
                     size=11, height=22, mono=True)
        for line_index, (tag, runs) in enumerate(rule["lines"]):
            ly = top + 58 + line_index * 21
            v.text(678, ly, tag, 11, f["faint"], weight=700, mono=True,
                   max_w=54)
            v.rich(742, ly, [(text, f[color], kind) for text, color, kind in runs],
                   11, max_w=300)

    # ---- one run's receipt --------------------------------------------------
    v.rect(656, 464, 400, 140, fill=f["panel"], rx=18, stroke=f["edge"],
           sw=1.5, shadow=True)
    v.text(678, 490, "ONE RUN", 11, f["faint"], weight=700, tracking=1.0,
           max_w=120, mono=True)
    v.chip_right(1036, 476, "quickstart sample", f["accent"], f["pill"],
                 size=11, height=22)
    for index, (value, label) in enumerate(RECEIPT):
        col = index % 4
        row = index // 4
        x = 678 + col * 94
        y = 528 + row * 30
        v.text(x, y, value, 18, f["text"], weight=700, mono=True, max_w=36)
        v.text(x + measure(value, 18, "mono_bold") + 7, y, label, 11,
               f["faint"], mono=True, max_w=66)
    v.text(678, 590, "warnings[] 0 · unreadable dir · depth > maxDepth · "
                     "empty tree", 11, f["faint"], max_w=360)

    # ---- footer -------------------------------------------------------------
    v.line(44, 610, 1056, 610, stroke=f["rule"], sw=1)
    v.text(44, 630,
           "twelve path rules read file.path · two set-level rules read the "
           "whole files[] · no document is opened · missing ≠ not done · "
           "counts are not judged", 11, f["sub"], max_w=1012)
    v.rich(44, 648, [
        ("scan  ", f["faint"], "mono"),
        ("maxDepth 6 · skipDirs [.git node_modules __MACOSX 临时 废稿 旧版备份] "
         "· emptyFileBytes 0 · pack v2026.1 (as_of 2026-10-23)", f["faint"],
         "cjk"),
    ], 11, max_w=1012)

    if v.bad:
        raise SystemExit("FATAL: SVG label overflow:\n  " + "\n  ".join(v.bad))
    return v.svg(
        W, H,
        "dsh-construction-doc-check tree and set-level checks",
        "The sample archive as the walk sees it: root, six category folders and "
        "twelve file leaves, each folder carrying the rule ids that matched a "
        "relative path there (CD-001..CD-030, all twelve present). Two set-level "
        "rules read the same files[] array as a set: CD-040 groups base names "
        "after stripping copy markers, CD-041 compares every file size with "
        "emptyFileBytes; both land at info. The run receipt closes the figure: "
        "12 present, 0 missing, 0 errors, 0 warnings, 0 infos, 14 rules, 7 dirs, "
        "12 files, 0 warnings; the scan is depth-capped at 6 and skips six "
        "directory names, and every skipped check says why.",
    )


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin)
        name = f"{NAME}-flow-v5-{skin}.svg"
        text = flow_svg(skin)
        ET.fromstring(text)  # never ship malformed XML
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(text)
        print(f"wrote {name} (1100x660)")


if __name__ == "__main__":
    main()
