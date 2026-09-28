#!/usr/bin/env python3
"""武器审图总览（一张图发主线程）：每把武器 = 武器图原大（art/final/weapon，3 倍存）+ 城镇 1 倍拿在手里的 之前 / 之后（站立 + 攻击）
  weapon_review.py <key,key,...> <之前目录> <之后目录> <输出.jpg> [每行几把=2]
城镇小图用 node test/weapons.mjs town <keys> <目录> 出（之前：GAME_URL=file://<旧构建>.html 跑同一条命令）；之前目录可以不存在（只看之后）。
"""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(HERE)
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
CN = {'shortsword': '短剑', 'katana': '太刀', 'club': '钝器', 'greatsword': '巨剑', 'lightsaber': '光剑', 'revolver': '左轮枪', 'autopistol': '自动手枪', 'rifle': '步枪',
      'handcannon': '手炮', 'bowgun': '手弩', 'spear': '矛', 'pole': '棍棒', 'rod': '魔杖', 'staff': '法杖', 'broom': '扫把'}

def names():
    """物品名（史诗）+ 品级外观名"""
    import re
    N = {}
    for f in os.listdir(os.path.join(ROOT, 'src', 'content', 'items')):
        for k, n in re.findall(r"'(ep_\w+)',\s*\{[^}]*?name:\s*'([^']+)'", open(os.path.join(ROOT, 'src', 'content', 'items', f)).read()): N[k] = n
    return N

def main():
    keys, bdir, adir, out = sys.argv[1].split(','), sys.argv[2], sys.argv[3], sys.argv[4]
    per = int(sys.argv[5]) if len(sys.argv) > 5 else 2
    N = names(); TIER = {'r2': '稀有', 'r3': '神器', 'r4': '传说'}
    js = open(os.path.join(ROOT, 'src', 'content', 'avatar', 'weapon_art.js')).read(); D = json.loads(js[js.index('{'):js.rindex('}') + 1])
    tw, th = Image.open(os.path.join(adir, f'{keys[0]}_idle.png')).size
    have_b = os.path.isdir(bdir)
    bw = tw * (4 if have_b else 2); art_h = 190; bh = 34 + art_h + 22 + th; gap = 16
    rows = (len(keys) + per - 1) // per
    M = Image.new('RGB', (per * bw + (per + 1) * gap, rows * (bh + gap) + gap + 40), (30, 33, 40)); d = ImageDraw.Draw(M)
    f1, f2, f3 = ImageFont.truetype(FONT, 22), ImageFont.truetype(FONT, 15), ImageFont.truetype(FONT, 17)
    d.text((gap, 10), '武器 v2 样图 · 上：武器图原大（游戏里按 1/3 缩小绘制）· 下：城镇 1 倍 ' + ('之前 | 之后（站立 + 攻击）' if have_b else '（站立 + 攻击）'), fill=(255, 230, 150), font=f3)
    for i, k in enumerate(keys):
        X = gap + (i % per) * (bw + gap); Y = 40 + gap + (i // per) * (bh + gap)
        d.rectangle([X, Y, X + bw - 1, Y + bh - 1], fill=(60, 66, 78))
        t = k.rsplit('_', 1)
        label = N.get(k) or (f'{CN.get(t[0], t[0])} · {TIER[t[1]]}' if len(t) == 2 and t[1] in TIER else f'{CN.get(k, k)} · 普通' if k in CN else k)
        A = D.get(k, {}); d.text((X + 10, Y + 6), f'{label}   ({k}，手里长度 {A.get("size", "?")} 帧像素)', fill=(255, 207, 90), font=f1)
        im = Image.open(os.path.join(HERE, 'final', 'weapon', f'{k}.webp')).convert('RGBA')
        s = min(1.0, (bw - 20) / im.width, art_h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        M.paste(im, (X + (bw - im.width) // 2, Y + 34 + (art_h - im.height) // 2), im)
        ty = Y + 34 + art_h
        cols = ([('之前 站立', bdir, 'idle'), ('之前 攻击', bdir, 'atk')] if have_b else []) + [('之后 站立', adir, 'idle'), ('之后 攻击', adir, 'atk')]
        for j, (lab, dd, m) in enumerate(cols):
            p = os.path.join(dd, f'{k}_{m}.png')
            d.text((X + j * tw + 8, ty + 2), lab, fill=(200, 205, 215) if dd == bdir else (140, 230, 160), font=f2)
            if os.path.exists(p): M.paste(Image.open(p).convert('RGB'), (X + j * tw, ty + 22))
        if have_b: d.line([X + 2 * tw, ty, X + 2 * tw, Y + bh], fill=(255, 207, 90), width=3)
    M.save(out, quality=90); print(out, M.size)

if __name__ == '__main__':
    main()
