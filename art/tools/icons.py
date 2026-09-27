#!/usr/bin/env python3
"""把图标表切成单个图标：去背 → 连通块 → 按行列排序 → 依次命名 → 128×128 WebP（art/final/icon/<名字>.webp）。"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = {
    'skills_a': ['upslash', 'triple', 'wave', 'slam', 'focus', 'iai', 'spin', 'awaken', 'flurry', 'rise', 'g_kick', 'g_spin'],
    'skills_b': ['g_slide', 'g_rapid', 'g_grenade', 'g_buff', 'g_hawk', 'g_head', 'g_gatling', 'g_awaken', 'mg_orb', 'mg_ice', 'mg_fire', 'mg_chain'],
    'skills_c': ['mg_nova', 'mg_buff', 'mg_meteor', 'mg_tornado', 'mg_hole', 'mg_awaken', 'x_hp', 'x_mp', 'x_chest', 'x_shield', 'x_bag', 'x_scroll'],
    'items_a': ['w_sword', 'w_gun', 'w_mage', 'head', 'top', 'bottom', 'belt', 'shoes', 'neck', 'bracelet', 'ring', 'hpS', 'hpM', 'hpL', 'mpS', 'mpM'],
    'items_b': ['elixir', 'crystal', 'guard', 'coin', 'gold', 'x_enh', 'x_trophy', 'x_card', 'x_skull', 'x_map', 'x_key', 'x_bomb'],
}

def main():
    """icons.py            切 art/src/icons 下的图标表
       icons.py --combat   切战斗组的技能图标表（主仓库 art/src/combat/icons，名字见 combatgen.ICON_SHEETS）"""
    out = os.path.join(ROOT, 'final', 'icon'); os.makedirs(out, exist_ok=True)
    sheets, src = SHEETS, os.path.join(ROOT, 'src', 'icons')
    if '--combat' in sys.argv:
        from combatgen import ICON_SHEETS, OUT
        sheets, src = {k: [n for n, _ in v] for k, v in ICON_SHEETS.items()}, os.path.join(OUT, 'icons')
    for sheet, names in sheets.items():
        p = os.path.join(src, f'{sheet}.png')
        if not os.path.exists(p): print('missing', sheet); continue
        im = remove_bg(Image.open(p)); arr = np.array(im)
        lab, comps = components(arr[..., 3], min_cells=200)
        boxes = []
        for n, cells in comps:
            ys, xs = np.where(lab == n); boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, n))
        boxes = [b for b in boxes if (b[1] - b[0]) > 80 and (b[3] - b[2]) > 80]   # 丢掉碎屑
        boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
        rows, cur = [], []
        for b in boxes:   # 按纵向中心聚成行
            if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
            cur.append(b)
        if cur: rows.append(cur)
        order = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
        print(sheet, 'found', len(order), 'expected', len(names))
        for b, name in zip(order, names):
            y0, y1, x0, x1, n = b
            crop = arr[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(lab[y0:y1, x0:x1] == n, crop[..., 3], 0)
            ic = Image.fromarray(crop, 'RGBA'); s = max(ic.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(ic, ((s - ic.width) // 2, (s - ic.height) // 2))
            sq.resize((104, 104), Image.LANCZOS).save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=84, method=6)

if __name__ == '__main__':
    main()
