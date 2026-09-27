#!/usr/bin/env python3
"""城镇美术：建筑 b_* / 地下城门 g_* / NPC npc_* / 道具表 props_*（4×4 切成 p_*）→ 去背、裁边、缩放 → art/final/world/*.webp

用法：worldprep.py [名字前缀 ...]      例：worldprep.py npc_ g_ props_   （不写就处理全部）
AI 原图在 <ART_SRC_ROOT 或 art>/src/world/（在 worktree 里跑时设 ART_SRC_ROOT=<主仓库>/art）
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, fill_holes, components
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('ART_SRC_ROOT') or ROOT
src, out = os.path.join(SRC, 'src', 'world'), os.path.join(ROOT, 'final', 'world'); os.makedirs(out, exist_ok=True)
# 道具表按阅读顺序（左→右、上→下）切出来的名字（与 jobs.py 的 PROPS 一一对应）
PROP_NAMES = {
    'props_town': ['p_lamp', 'p_banner', 'p_crates', 'p_barrels', 'p_bench', 'p_planter', 'p_cart', 'p_cat',
                   'p_chicken', 'p_puppy', 'p_hay', 'p_sacks', 'p_tree', 'p_sign', 'p_logs', 'p_bucket'],
    'props_coast': ['p_anchor', 'p_rope', 'p_net', 'p_gull', 'p_buoy', 'p_fishcrates', 'p_boat', 'p_bollard',
                    'p_crystal', 'p_books', 'p_cauldron', 'p_telescope', 'p_blackcat', 'p_magiclamp', 'p_blueflower', 'p_chest'],
}
PROP_H = 280   # 道具存图的最大高度（显示时一般只有 30~150 像素高）
WHITE_OK = {'b_skystair', 'g_dragon_tower', 'g_lord_palace', 'g_floating_castle'}
only = sys.argv[1:]

def save(im, n):
    im.save(os.path.join(out, n + '.webp'), 'WEBP', quality=80, method=6)
    print(n, im.size, os.path.getsize(os.path.join(out, n + '.webp')) // 1024, 'KB')

def keep_largest_left(im):
    """只留最左边的连通块（b_signpost 多画了一栋房子）"""
    a = np.array(im); lab, comps = components(a[..., 3], min_cells=50)
    best = min(comps, key=lambda c: np.where(lab == c[0])[1].mean()); a[..., 3] = np.where(lab == best[0], a[..., 3], 0)
    return Image.fromarray(a, 'RGBA')

for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    n = f[:-4]
    if only and not any(n.startswith(p) for p in only): continue
    im = Image.open(os.path.join(src, f))
    if n in PROP_NAMES:   # 4×4 道具表：逐格去背、裁到内容
        W, H = im.size; cw, ch = W // 4, H // 4
        for i, pn in enumerate(PROP_NAMES[n]):
            r, c = divmod(i, 4)
            cell = fill_holes(remove_bg(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))), min_area=200, thr=250)
            # 相邻格子伸过来的碎块（贴着格子边缘的小连通块）去掉；道具自己身边的小光点保留
            a = np.array(cell); lab, comps = components(a[..., 3], min_cells=1); big = max(n for _, n in comps)
            for lb, cnt in comps:
                ys, xs = np.where(lab == lb)
                if cnt < big * 0.2 and (ys.min() < 6 or xs.min() < 6 or ys.max() > ch - 7 or xs.max() > cw - 7): a[..., 3][lab == lb] = 0
            cell = Image.fromarray(a, 'RGBA'); cell = cell.crop(cell.getbbox())
            if cell.height > PROP_H: cell = cell.resize((round(cell.width * PROP_H / cell.height), PROP_H), Image.LANCZOS)
            save(cell, pn)
        continue
    # 自带大片白色的图（云朵、白金色传送门）：只去掉和边缘相连的纯白，不补洞，否则云和门芯会被挖空
    if n in WHITE_OK: im = remove_bg(im, tol=6)
    else: im = fill_holes(remove_bg(im), min_area=400, thr=250)
    if n == 'b_signpost': im = keep_largest_left(im)
    im = im.crop(im.getbbox())
    H = 560 if n.startswith(('b_', 'g_')) else 300
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    save(im, n)
