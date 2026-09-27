# 任务道具图标：把 AI 生成的 3x3 图标表（art/src/quests/sheet{A,B,C}.png）切成 104x104 的圆角图标，
# 输出到 art/final/icon/q_<key>.webp（沿用物品图标 icon/<物品 key> 的约定，背包“任务”页和任务界面都能直接用）
# 用法：python3 art/tools/quest_icons.py [原图目录]
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'art', 'src', 'quests')
OUT = os.path.join(ROOT, 'art', 'final', 'icon')
SIZE = 104
# 每张表按阅读顺序的 9 个格子 → 物品 key（一个格子可以对应多个 key，比如各职业的“猫妖指甲”）
SHEETS = {
    'sheetA.png': [['q_poison_sac'], ['q_frost_crystal', 'q_glue_frost'], ['q_grey_shard'], ['q_cursed_tooth'], ['q_karua_hammer'], ['q_magic_crystal'], ['q_seria_ring'], ['q_captain_mark'], ['q_wild_grape']],
    'sheetB.png': [['q_herb'], ['q_goblin_fur'], ['q_venom_gland'], ['q_tau_horn', 'q_glue_horn'], ['q_kaino_fur'], ['q_glue'], ['q_glow_powder'], ['q_cat_paw'], ['q_goblin_beard']],
    'sheetC.png': [['q_tau_hair'], ['q_tau_spine'], ['q_rusty_iron'], ['q_rojing'], ['q_cat_nail_sword', 'q_cat_nail_gun', 'q_cat_nail_mage'], [], ['q_magic_stone'], ['q_scroll'], []],
}

def bands(profile, n, thresh):
    """在投影里找 n 段连续的“有内容”区间"""
    runs, start = [], None
    for i, v in enumerate(profile):
        if v > thresh and start is None: start = i
        elif v <= thresh and start is not None: runs.append((start, i)); start = None
    if start is not None: runs.append((start, len(profile)))
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n]
    return sorted(runs)

def slice_sheet(path):
    im = Image.open(path).convert('RGB'); w, h = im.size
    px = im.load()
    solid = lambda x, y: sum(px[x, y]) < 700   # 非白色
    cols = [sum(solid(x, y) for y in range(0, h, 4)) for x in range(w)]
    rows = [sum(solid(x, y) for x in range(0, w, 4)) for y in range(h)]
    cb, rb = bands(cols, 3, h / 4 * 0.3), bands(rows, 3, w / 4 * 0.3)
    tiles = []
    for (y0, y1) in rb:
        for (x0, x1) in cb: tiles.append(im.crop((x0, y0, x1, y1)))
    return tiles

def rounded(tile):
    t = tile.resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((2, 2, SIZE * 4 - 3, SIZE * 4 - 3), radius=int(SIZE * 4 * 0.12), fill=255)
    t.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
    return t

os.makedirs(OUT, exist_ok=True)
for sheet, keys in SHEETS.items():
    p = os.path.join(SRC, sheet)
    if not os.path.exists(p): print('缺少', p); continue
    tiles = slice_sheet(p)
    if len(tiles) != 9: print(sheet, '切出', len(tiles), '格，跳过'); continue
    for tile, ks in zip(tiles, keys):
        if not ks: continue
        icon = rounded(tile)
        for k in ks: icon.save(os.path.join(OUT, k + '.webp'), 'WEBP', quality=90, method=6)
        print(sheet, '→', ', '.join(ks))
