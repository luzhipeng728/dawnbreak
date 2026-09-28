#!/usr/bin/env python3
"""外观与换装：每帧的副手（不拿武器的那只手，鬼剑士的鬼手）锚点，写进原装 spr.json 的 F.oh = [x, y]（帧像素）。
职业外观（src/content/avatar/job_looks.js 的 arm）按它画鬼手的鬼火 / 血气；时装帧和原装帧按脚底锚点对齐，直接借用原装帧的 oh。
做法：按手套颜色（HSV 区间）找色块 → 去掉武器握点附近、大腿以下（靴子和手套同色）、腰带、头附近的像素 → 取最大的连通块的中心。
没有分割线（F.cut）的帧按头部锚点估一条腰线。找不到（手被身体挡住）就不写 oh，这一帧鬼手特效画在武器手上。
手工修正写在 HAND_FIX（帧名: [x, y] 或 None = 不画）。
用法：avatar_hands.py sword [--sheet 预览.jpg]
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 手套颜色：h 色相（度），s 饱和度，v 明度（0~1）
GLOVE = {'sword': dict(h=(4, 36), s=(0.2, 0.62), v=(0.18, 0.5))}
HAND_FIX = {'sword': {}}
MIN_PX, MAX_BOX = 24, 44


def hsv(a):
    rgb = a[..., :3].astype(np.float32) / 255; mx = rgb.max(-1); mn = rgb.min(-1); d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def blobs(mask):
    H, W = mask.shape; lab = np.zeros((H, W), np.int32); out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n = len(out) + 1; st = [(y0, x0)]; lab[y0, x0] = n; pts = []
        while st:
            y, x = st.pop(); pts.append((y, x))
            for yy in (y - 1, y, y + 1):
                for xx in (x - 1, x, x + 1):
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
        out.append(np.array(pts))
    return out


def find(cls, F, im):
    a = np.array(im.convert('RGBA')); h, s, v = hsv(a); G = GLOVE[cls]
    m = (a[..., 3] > 200) & (h >= G['h'][0]) & (h <= G['h'][1]) & (s >= G['s'][0]) & (s <= G['s'][1]) & (v >= G['v'][0]) & (v <= G['v'][1])
    Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    for k in ('wpn', 'wpn2'):
        w = F.get(k)
        if w: m &= (X - w['gx']) ** 2 + (Y - w['gy']) ** 2 > 16 ** 2
    H0 = F.get('head'); c = F.get('cut')
    if not c and H0:   # 没有分割线：按站姿比例估腰线（站姿帧：腰在头心到脚底的 52% 处，脚踝在 90%）
        L = F['ay'] - H0['y']; c = {'a': 0.0, 'wx': H0['x'], 'wy': H0['y'] + L * 0.48, 'kd': L * 0.38}
    if c:
        ux, uy = np.sin(c['a']), np.cos(c['a']); d = (X - c['wx']) * ux + (Y - c['wy']) * uy
        m &= d < c['kd'] * 0.35          # 大腿中段以下（靴子和手套同色）
        m &= np.abs(d) > 5               # 腰带
    if H0: m &= (X - H0['x']) ** 2 + (Y - H0['y']) ** 2 > 28 ** 2   # 头发 / 脸
    best = None
    for P in blobs(m):
        if len(P) < MIN_PX: continue
        hgt, wid = np.ptp(P[:, 0]) + 1, np.ptp(P[:, 1]) + 1
        if hgt > MAX_BOX or wid > MAX_BOX: continue          # 太长的是皮带 / 衣摆，不是手
        if best is None or len(P) > len(best): best = P
    if best is None: return None
    return [round(float(best[:, 1].mean()), 1), round(float(best[:, 0].mean()), 1)]


def main():
    cls = sys.argv[1]; d = os.path.join(HERE, 'final', 'spr', cls); meta = json.load(open(os.path.join(d, 'spr.json')))
    sheet = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
    tiles = []; miss = []
    for name, F in sorted(meta['frames'].items()):
        im = Image.open(os.path.join(d, name + '.webp'))
        p = HAND_FIX[cls][name] if name in HAND_FIX[cls] else find(cls, F, im)
        if p: F['oh'] = p
        else: F.pop('oh', None); miss.append(name)
        if sheet:
            im = im.convert('RGBA'); t = Image.new('RGBA', (230, 280), (205, 205, 205, 255)); ox, oy = 115 - int(F['ax']), 270 - int(F['ay'])
            t.paste(im, (ox, oy), im); dr = ImageDraw.Draw(t)
            if p: dr.ellipse((p[0] + ox - 8, p[1] + oy - 8, p[0] + ox + 8, p[1] + oy + 8), outline=(255, 0, 255, 255), width=3)
            dr.text((3, 3), name, fill=(0, 0, 0, 255)); tiles.append(t)
    json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'), indent=1)
    print(cls, len(meta['frames']) - len(miss), 'frames with oh; missing:', ' '.join(miss))
    if sheet:
        cols = 12; rows = (len(tiles) + cols - 1) // cols; S = Image.new('RGB', (cols * 230, rows * 280), (255, 255, 255))
        for i, t in enumerate(tiles): S.paste(t.convert('RGB'), ((i % cols) * 230, (i // cols) * 280))
        S.resize((S.width // 2, S.height // 2)).save(sheet, quality=80)


if __name__ == '__main__':
    main()
