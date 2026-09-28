#!/usr/bin/env python3
"""按 spr.json 的武器轨迹把扫把合成到魔道学者的帧上（和 models/avatar.js 的长杆画法一致），基础造型 + 6 套时装各一行。
  witch_wpncheck.py [帧名,...] [--wpn broom]   → <主仓库>/art/src/witch/_wpn_check.png
"""
import os, sys, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SETS = ['', '@academy', '@festival', '@sky1', '@sky2', '@spring', '@summer']
FR = ['brIdle', 'brDash', 'brAtk1', 'brAtk2', 'brFall', 'brSpin', 'faceplant', 'sooty']

def weapon_art(key):
    src = open(os.path.join(HERE, '..', 'src', 'content', 'avatar', 'weapon_art.js')).read()
    i = src.index(f'"{key}":'); j = src.index('}', i); return json.loads(src[src.index('{', i):j + 1])

def compose(im, F, A, wim):
    W, H = im.size; pad = 140; C = Image.new('RGBA', (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    def draw_w(w):
        s = A['size'] / (A['tx'] - A['gx']); x0 = max(0.0, A['tx'] - (w['len'] + w.get('bk', 0) + 6) / s)
        crop = wim.crop((int(x0), 0, A['w'], A['h']))
        fy = -1 if math.cos(w['ang']) < -0.05 else 1
        # 局部坐标：尖端在 (len, 0)，图从 (x0 - tx) * s 画到 (w - tx) * s，y 从 -ty*s
        cw, ch = max(1, round(crop.width * s)), max(1, round(crop.height * s)); cr = crop.resize((cw, ch), Image.LANCZOS)
        if fy < 0: cr = cr.transpose(Image.FLIP_TOP_BOTTOM)
        big = Image.new('RGBA', (cw * 4 + 600, cw * 4 + 600), (0, 0, 0, 0)); ox = oy = cw * 2 + 300
        lx = w['len'] + (x0 - A['tx']) * s; ly = -A['ty'] * s * fy if fy > 0 else -(A['h'] - A['ty']) * s
        big.alpha_composite(cr, (round(ox + lx), round(oy + ly)))
        rot = big.rotate(-math.degrees(w['ang']), resample=Image.BICUBIC, center=(ox, oy))
        C.alpha_composite(rot, (round(pad + w['gx'] - ox), round(pad + w['gy'] - oy)))
    w = F.get('wpn')
    if w and not w.get('front'): draw_w(w)
    C.alpha_composite(im, (pad, pad))
    if w and w.get('front'): draw_w(w)
    return C

def main():
    a = sys.argv[1:]; wk = 'broom'
    if '--wpn' in a: i = a.index('--wpn'); wk = a[i + 1]; a = a[:i] + a[i + 2:]
    fr = a[0].split(',') if a else FR
    A = weapon_art(wk); wim = Image.open(os.path.join(HERE, 'final', 'weapon', wk + '.webp')).convert('RGBA')
    rows = []
    for s in SETS:
        d = os.path.join(HERE, 'final', 'spr', 'mage' + s); J = json.load(open(os.path.join(d, 'spr.json')))
        row = []
        for f in fr:
            F = J['frames'].get(f); p = os.path.join(d, f + '.webp')
            if not F or not os.path.exists(p): row.append(None); continue
            row.append(compose(Image.open(p).convert('RGBA'), F, A, wim))
        rows.append((s or 'base', row))
    cw = max((c.width for _, r in rows for c in r if c), default=100); chh = max((c.height for _, r in rows for c in r if c), default=100)
    S = Image.new('RGB', (cw * len(fr), chh * len(rows)), (70, 74, 82)); dr = ImageDraw.Draw(S)
    for ri, (s, r) in enumerate(rows):
        for ci, c in enumerate(r):
            if c: S.paste(c, (ci * cw, ri * chh), c)
            dr.text((ci * cw + 4, ri * chh + 4), f'{s} {fr[ci]}', fill=(255, 230, 80))
    S.thumbnail((2400, 2400)); out = os.path.join(MAIN, 'src', 'witch', '_wpn_check.png'); S.save(out); print(out, S.size)

if __name__ == '__main__':
    main()
