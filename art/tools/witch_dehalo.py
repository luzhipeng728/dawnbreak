#!/usr/bin/env python3
"""去掉逐帧精灵外圈“烤进去”的光晕（浅色半透明的一圈）：从图边出发，穿过透明和浅色像素做洪水填充，碰到深色描边就停；
填到的浅色像素都算光晕，抠掉。角色内部被描边围住的浅色不受影响。也能只保留最大的一块（去掉脱离主体的碎块）。
  witch_dehalo.py <帧.webp...> [--dark 150 光晕的最低亮度] [--alpha 235 光晕的最高不透明度] [--noflood] [--main] [--dry 输出目录]
"""
import sys, os
from collections import deque
import numpy as np
from PIL import Image

def dilate(m, n):
    for _ in range(n):
        o = m.copy(); o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]; m = o
    return m

def flood(passable):
    H, W = passable.shape; seen = np.zeros_like(passable); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if passable[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if passable[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and passable[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    return seen

def largest(a):
    H, W = a.shape; lab = np.zeros((H, W), np.int32); best, bn, cur = 0, 0, 0
    for y in range(H):
        for x in range(W):
            if a[y, x] and not lab[y, x]:
                cur += 1; n = 0; q = deque([(y, x)]); lab[y, x] = cur
                while q:
                    cy, cx = q.popleft(); n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not lab[ny, nx]: lab[ny, nx] = cur; q.append((ny, nx))
                if n > bn: bn, best = n, cur
    return lab == best

def main():
    a = sys.argv[1:]; opt = lambda k, d: (a[a.index(k) + 1] if k in a else d)
    dark, alpha, keep_main, dry, no_flood = float(opt('--dark', 150)), int(opt('--alpha', 235)), '--main' in a, opt('--dry', None), '--noflood' in a
    files = [f for i, f in enumerate(a) if f.endswith('.webp') and (i == 0 or a[i - 1] not in ('--dry',))]
    for f in files:
        im = np.array(Image.open(f).convert('RGBA')).astype(np.int32); A = im[..., 3] > 20
        lum = im[..., 0] * 0.3 + im[..., 1] * 0.59 + im[..., 2] * 0.11
        if not no_flood:   # 可穿过：透明，或者“半透明的浅色”（光晕）；实心的角色本体挡住
            halo = (im[..., 3] < alpha) & (lum > dark)
            out = flood(~A | halo)
            im[..., 3] = np.where(out, 0, im[..., 3])
        else: out = np.zeros(A.shape, bool)
        if keep_main: m = largest(dilate(im[..., 3] > 20, 1)); im[..., 3] = np.where(m, im[..., 3], 0)
        res = Image.fromarray(im.astype(np.uint8), 'RGBA')
        dst = os.path.join(dry, os.path.basename(f).replace('.webp', '.png')) if dry else f
        res.save(dst, 'PNG') if dry else res.save(dst, 'WEBP', quality=76, method=6)
        print(f, '→', dst, int(out.sum()))

if __name__ == '__main__':
    main()
