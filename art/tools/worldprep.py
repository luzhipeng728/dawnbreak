#!/usr/bin/env python3
"""城镇美术：建筑 / 地下城门 / NPC → 去背、裁边、缩放 → art/final/world/*.webp"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, fill_holes, components
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, out = os.path.join(ROOT, 'src', 'world'), os.path.join(ROOT, 'final', 'world'); os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(src)):
    n = f[:-4]; im = fill_holes(remove_bg(Image.open(os.path.join(src, f))), min_area=400, thr=250)
    if n == 'b_signpost':   # 这张多画了一栋房子：只留最左边的连通块（路牌）
        a = np.array(im); lab, comps = components(a[..., 3], min_cells=50)
        best = min(comps, key=lambda c: np.where(lab == c[0])[1].mean()); a[..., 3] = np.where(lab == best[0], a[..., 3], 0); im = Image.fromarray(a, 'RGBA')
    im = im.crop(im.getbbox())
    H = 560 if n.startswith('b_') else 300
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    im.save(os.path.join(out, n + '.webp'), 'WEBP', quality=80, method=6)
    print(n, im.size, os.path.getsize(os.path.join(out, n + '.webp')) // 1024, 'KB')
