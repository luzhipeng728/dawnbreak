#!/usr/bin/env python3
"""场景图层：远景（1650 宽，截取 22%~92%）/ 地面（按场景缩放后截 470 高的一条）/ 交界带（去背后按宽度缩放）→ art/final/bg/*.webp"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 地面贴图的缩放：源图缩到多宽（越窄 = 纹理越小）；交界带同理
FLOOR_W = {'forest': 2400, 'forestDark': 2000, 'ruins': 1700, 'ruinsPoison': 1800, 'camp': 1700, 'campFire': 1900, 'ruinsDark': 1500, 'town': 1500}
EDGE_W = {'town': 1800}
out = os.path.join(ROOT, 'final', 'bg'); os.makedirs(out, exist_ok=True)
for t, fw in FLOOR_W.items():
    s = lambda k: os.path.join(ROOT, 'src', 'bg', f'{t}_{k}.png')
    if os.path.exists(s('far')):
        im = Image.open(s('far')).convert('RGB'); W = 1650; im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS); H = im.height
        im.crop((0, round(H * 0.22), W, round(H * 0.92))).save(f'{out}/{t}_far.webp', 'WEBP', quality=70, method=6)
    if os.path.exists(s('floor')):
        fl = Image.open(s('floor')).convert('RGB'); fl = fl.resize((fw, round(fl.height * fw / fl.width)), Image.LANCZOS); h = 470; y0 = (fl.height - h) // 2
        fl.crop((0, y0, fw, y0 + h)).save(f'{out}/{t}_floor.webp', 'WEBP', quality=68, method=6)
    if os.path.exists(s('edge')):
        # 交界带：缩到和角色相称的大小，只留上面带轮廓的 75%，底部 35% 渐隐融进地面（运行时镜像平铺）
        e = remove_bg(Image.open(s('edge'))); ew = EDGE_W.get(t, 1400); e = e.resize((ew, round(e.height * ew / e.width)), Image.LANCZOS)
        bb = e.getbbox(); e = e.crop((0, bb[1], ew, bb[3])); e = e.crop((0, 0, ew, round(e.height * 0.75)))
        import numpy as np
        a = np.array(e).astype(np.float32); h = a.shape[0]; f0 = round(h * 0.65)
        ramp = np.ones(h, np.float32); ramp[f0:] = np.linspace(1, 0, h - f0); a[..., 3] *= ramp[:, None]
        Image.fromarray(a.astype(np.uint8), 'RGBA').save(f'{out}/{t}_edge.webp', 'WEBP', quality=72, method=6)
    print(t, *[f'{k}:{os.path.getsize(f"{out}/{t}_{k}.webp") // 1024}K' for k in ('far', 'floor', 'edge') if os.path.exists(f'{out}/{t}_{k}.webp')])
