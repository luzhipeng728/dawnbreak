#!/usr/bin/env python3
"""把若干部件图加 0.1 网格拼成一张，方便人工标注关节点。用法：gridsheet.py OUT.png rig:idx[:label] ..."""
import sys
from PIL import Image, ImageDraw
out, items = sys.argv[1], sys.argv[2:]
tiles = []
for it in items:
    rig, idx, *lab = it.split(':')
    im = Image.open(f'cut/{rig}/part_{int(idx):02d}.png').convert('RGBA'); H = 420; im = im.resize((max(1, round(im.width * H / im.height)), H))
    if im.width > 420: im = im.resize((420, round(im.height * 420 / im.width)))
    W, H = im.size; t = Image.new('RGB', (W + 50, H + 60), (70, 74, 84)); t.paste(im, (40, 40), im); d = ImageDraw.Draw(t)
    for i in range(11):
        x = 40 + W * i / 10; y = 40 + H * i / 10
        col = (255, 230, 0) if i == 5 else (110, 190, 255)
        d.line([(x, 40), (x, 40 + H)], fill=col, width=1); d.line([(40, y), (40 + W, y)], fill=col, width=1)
        if i % 2 == 0: d.text((x - 6, 26), f'{i/10:.1f}', fill=(255, 255, 255)); d.text((4, y - 5), f'{i/10:.1f}', fill=(255, 255, 255))
    d.text((40, 6), f'{rig} #{idx} {lab[0] if lab else ""}', fill=(255, 120, 120))
    tiles.append(t)
Wt = sum(t.width for t in tiles[:4]); rows = [tiles[i:i + 4] for i in range(0, len(tiles), 4)]
Ht = sum(max(t.height for t in r) for r in rows); Wt = max(sum(t.width for t in r) for r in rows)
sheet = Image.new('RGB', (Wt, Ht), (30, 30, 34)); y = 0
for r in rows:
    x = 0
    for t in r: sheet.paste(t, (x, y)); x += t.width
    y += max(t.height for t in r)
sheet.save(out)
