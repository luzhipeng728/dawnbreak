#!/usr/bin/env python3
"""魔道学者新美术的总览（一张图给主线程审）：技能图标 → 觉醒插图 → 各机械 / 召唤物的游戏比例连拍（先跑 witch_strip.py）。
  witch_contact.py <输出名> <strip id...>   → <主仓库>/art/src/witch/<输出名>.png
"""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art'), 'src', 'witch')
ICONS = ['wt_broom', 'wt_affinity', 'wt_book', 'wt_shululu', 'wt_missile', 'wt_cloak', 'wt_powder', 'wt_lucky', 'wt_swatter', 'wt_lava', 'wt_acid', 'wt_swatlock', 'wt_spin', 'wt_tesla', 'wt_bitter', 'wt_furnace',
         'wt_antigrav', 'wt_detonate', 'wt_drill', 'wt_premonition', 'wt_awaken', 'wt_candy', 'q_wt_candle', 'q_wt_ice', 'wt_superswat', 'wt_rabbit', 'wt_stone', 'wt_helper', 'wt_shaved', 'wt_lollipop',
         'wt_awaken2', 'wt_pink', 'wt_trickjack', 'wt_awaken3', 'q_wt_orb', 'q_wt_mask']

def main():
    name, strips = sys.argv[1], sys.argv[2:]; F = os.path.join(HERE, 'final'); rows = []
    ic = Image.new('RGB', (18 * 96, 2 * 96), (40, 40, 46))
    for i, n in enumerate(ICONS):
        p = os.path.join(F, 'icon', n + '.webp')
        if os.path.exists(p): im = Image.open(p).convert('RGBA').resize((92, 92)); ic.paste(im, ((i % 18) * 96 + 2, (i // 18) * 96 + 2), im)
    rows.append(('icons', ic))
    cut = Image.new('RGB', (3 * 576, 384), (40, 40, 46))
    for i, n in enumerate(['witch', 'witch2', 'witch3']):
        p = os.path.join(F, 'cutin', n + '.webp')
        if os.path.exists(p): im = Image.open(p).convert('RGBA').resize((576, 384)); cut.paste(im, (i * 576, 0), im)
    rows.append(('cutins', cut))
    for n in strips:
        im = Image.open(os.path.join(D, f'_{n}_strip.png')).convert('RGB'); rows.append((n, im.crop((0, 110, im.width, 390))))
    W = max(r[1].width for r in rows); H = sum(r[1].height + 4 for r in rows)
    S = Image.new('RGB', (W, H), (20, 20, 20)); y = 0
    for n, im in rows: S.paste(im, (0, y)); ImageDraw.Draw(S).text((6, y + 4), n, fill=(255, 255, 0)); y += im.height + 4
    S.thumbnail((2000, 4000)); out = os.path.join(D, name + '.png'); S.save(out); print(out, S.size)

if __name__ == '__main__':
    main()
