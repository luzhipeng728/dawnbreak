#!/usr/bin/env python3
"""外观与换装：某个提交（改动前）和现在的时装帧并排对比，按脚底锚点对齐画成一条（人工看闪烁 / 大小 / 位置）。
  avatar_beforeafter.py <提交> <输出png> <职业@套装:帧,帧,...> [...]
每组两行：上面是改动前，下面是现在；每格下方的白线 = 脚底锚点。
"""
import os, sys, json, io, subprocess
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ROOT = os.path.dirname(HERE)

def load_old(rev, key, f):
    b = subprocess.run(['git', 'show', f'{rev}:art/final/spr/{key}/{f}.webp'], cwd=ROOT, capture_output=True).stdout
    return Image.open(io.BytesIO(b)).convert('RGBA') if b else None

def meta_old(rev, key):
    b = subprocess.run(['git', 'show', f'{rev}:art/final/spr/{key}/spr.json'], cwd=ROOT, capture_output=True).stdout
    return json.loads(b)['frames']

def main():
    rev, outp = sys.argv[1], sys.argv[2]; groups = []
    for g in sys.argv[3:]:
        key, fr = g.split(':'); groups.append((key, fr.split(',')))
    S = 1.2; cw, ch = int(150 * S), int(150 * S); cols = max(len(f) for _, f in groups)
    M = Image.new('RGBA', (cw * cols + 120, ch * 2 * len(groups)), (60, 64, 74, 255)); d = ImageDraw.Draw(M)
    for gi, (key, frames) in enumerate(groups):
        mo = meta_old(rev, key); mn = json.load(open(os.path.join(HERE, 'final', 'spr', key, 'spr.json')))['frames']
        for row, (lab, meta, get) in enumerate([('before', mo, lambda f: load_old(rev, key, f)), ('after', mn, lambda f: Image.open(os.path.join(HERE, 'final', 'spr', key, f + '.webp')).convert('RGBA'))]):
            y0 = (gi * 2 + row) * ch; d.text((6, y0 + 6), f'{key}\n{lab}', fill=(255, 226, 138))
            for j, f in enumerate(frames):
                im = get(f); F = meta.get(f)
                if im is None or not F: continue
                k = S * 0.62; im2 = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
                cx, cy = 120 + j * cw + cw // 2, y0 + ch - 12
                M.alpha_composite(im2, (int(cx - F['ax'] * k), int(cy - F['ay'] * k)))
                d.line([cx - 30, cy, cx + 30, cy], fill=(255, 255, 255), width=1)
                if gi == 0 and row == 0: d.text((cx - 20, 2), f, fill=(200, 200, 200))
    M.save(outp); print(outp, M.size)

if __name__ == '__main__':
    main()
