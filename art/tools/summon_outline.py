#!/usr/bin/env python3
"""给发光系召唤兽的精灵帧加一圈深色描边（亮背景上也看得清；画风本来就是粗描边）。
  summon_outline.py <id> [--col #6a4a10] [--px 3] [--alpha 0.85]
每帧四周各扩 px 像素（spr.json 的锚点 ax / ay 同步 +px），在原图下面垫一层 alpha 外扩 px 像素的纯色轮廓。重复运行会叠加，所以只跑一次。
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    a = sys.argv[1:]; name = a[0]
    col = a[a.index('--col') + 1] if '--col' in a else '#6a4a10'; px = int(a[a.index('--px') + 1]) if '--px' in a else 3; al = float(a[a.index('--alpha') + 1]) if '--alpha' in a else 0.85
    d = os.path.join(HERE, 'final', 'spr', name); meta = json.load(open(os.path.join(d, 'spr.json')))
    if meta.get('outline'): sys.exit(f'{name} 已经描过边了（spr.json outline）')
    rgb = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
    for n, F in meta['frames'].items():
        p = os.path.join(d, n + '.webp'); im = Image.open(p).convert('RGBA')
        big = Image.new('RGBA', (im.width + px * 2, im.height + px * 2), (0, 0, 0, 0)); big.paste(im, (px, px))
        A = big.split()[3].point(lambda v: 255 if v > 90 else 0).filter(ImageFilter.MaxFilter(px * 2 + 1))
        ol = Image.new('RGBA', big.size, rgb + (0,)); ol.putalpha(A.point(lambda v: int(v * al)))
        out = Image.alpha_composite(ol, big); out.save(p, 'WEBP', quality=76, method=6)
        F['w'], F['h'] = out.width, out.height; F['ax'] = round(F['ax'] + px, 1); F['ay'] = round(F['ay'] + px, 1)
    meta['outline'] = {'col': col, 'px': px}
    json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'), indent=1); print(name, len(meta['frames']), 'frames outlined')

if __name__ == '__main__':
    main()
