#!/usr/bin/env python3
"""职业外观（docs/JOB_VISUALS.md）的特效素材：只做覆盖层画不出来的东西（火焰舌、鬼火精灵等小动画条）。
每张原图是一行 N 个同一特效的变体（当动画帧 / 随机变体用），黑底发光 → 亮度转透明度 → 按空隙切成 N 块 →
等大格子横排成一条（FLAME：底边对齐；其他：居中）→ art/final/fx/<名字>.webp。运行时第 i 帧 = 图宽 / N 的第 i 格（job_looks.js 的 JL_STRIP）。
  jobvis_art.py gen  [--only 名字]   生图 → 主仓库 art/src/jobvis/<名字>.png（已存在跳过；同时最多 2 个请求）
  jobvis_art.py prep [--only 名字]   切条 → art/final/fx/<名字>.webp
"""
import os, sys, argparse
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from combatgen import run, GLOW, MAIN, HERE
from fxprep import glow_to_rgba

OUT = os.path.join(MAIN, 'src', 'jobvis')
# 名字: (提示词, 尺寸, 格数, 每格最长边像素, 底边对齐)
FX = {
    'jv_flame': ('A horizontal row of exactly 4 separate upright flame tongues, the same flickering flame in 4 different moments, each a tall narrow flame '
                 'with a wide rounded base at the bottom and a wavy forked pointed tip at the top, bright yellow-white hot core, crimson and scarlet outer flames, '
                 'evenly spaced with wide black gaps between them, all the same height', '1536x1024', 4, 160, True),
    'jv_wisp': ('A horizontal row of exactly 3 separate small ghost-flame spirits (will-o-wisps), each a floating violet and lavender ghost flame with a round glowing head, '
                'two tiny hollow dark eyes and a long curling wispy tail trailing downward, translucent eerie glow, evenly spaced with wide black gaps between them',
                '1536x1024', 3, 128, False),
}


def split(im, n):
    a = np.array(im); al = a[..., 3] > 10; cols = al.any(0)
    runs = []; x = 0; W = len(cols)
    while x < W:
        if cols[x]:
            x0 = x
            while x < W and cols[x]: x += 1
            runs.append([x0, x])
        else: x += 1
    while len(runs) > n:   # 合并最窄的空隙（同一团火里的小缝）
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]; i = int(np.argmin(gaps))
        runs[i] = [runs[i][0], runs[i + 1][1]]; del runs[i + 1]
    if len(runs) != n: raise SystemExit(f'切出 {len(runs)} 块，要 {n} 块')
    out = []
    for x0, x1 in runs:
        sub = im.crop((x0, 0, x1, im.height)); bb = sub.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox(); out.append(sub.crop(bb))
    return out


def prep(name):
    _, _, n, m, bottom = FX[name]
    im = glow_to_rgba(Image.open(os.path.join(OUT, name + '.png')))
    parts = split(im, n); s = m / max(max(p.size) for p in parts)
    parts = [p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS) for p in parts]
    cw, ch = max(p.width for p in parts), max(p.height for p in parts)
    S = Image.new('RGBA', (cw * n, ch), (0, 0, 0, 0))
    for i, p in enumerate(parts): S.alpha_composite(p, (i * cw + (cw - p.width) // 2, ch - p.height if bottom else (ch - p.height) // 2))
    f = os.path.join(HERE, 'final', 'fx', name + '.webp'); S.save(f, 'WEBP', quality=82, method=6)
    print(name, S.size, f'{n} 格 {cw}x{ch}', os.path.getsize(f) // 1024, 'KB')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default=''); a = ap.parse_args()
    names = [k for k in FX if not a.only or k in a.only.split(',')]
    if a.phase == 'gen':
        os.makedirs(OUT, exist_ok=True)
        L = [{'out': os.path.join(OUT, k + '.png'), 'prompt': f'{FX[k][0]}. {GLOW}', 'size': FX[k][1]} for k in names]
        with ThreadPoolExecutor(2) as ex:
            for f in as_completed([ex.submit(run, j) for j in L]): print(f.result(), flush=True)
    elif a.phase == 'prep':
        for k in names: prep(k)
    else: raise SystemExit('phase: gen | prep')


if __name__ == '__main__':
    main()
