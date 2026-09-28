#!/usr/bin/env python3
"""召唤兽 / 怪物：三张动作表之间的大小是否一致（切帧按每张表自己的站姿参考格定比例，个别表会整体画大 / 画小）。
  summon_scale.py [--apply] [--tol 0.06] <id...>
以 walk 表（idle + 走路 8 帧）为基准，给 act / more 两张表各估一次整体比例，两种估法都偏、方向一致才改：
  估法 1（轮廓）：表里每一帧的轮廓和 walk 表每一帧做缩放对齐（avatar_align.align，IoU 最高），取重合度 ≥ 0.6 的对照的缩放中位数。
  估法 2（站姿高度）：表里的直立帧（more: idle2 / taunt / cast1 / cast2；act: atk1 / hit1）的帧高和 idle 帧高之比的中位数。
--apply：把这张表的全部帧按 1 / 比例缩回去（脚底锚点一起换算），写回 art/final/spr/<id>/。
"""
import os, sys, json, statistics
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from avatar_align import align, mask
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = {'walk': ['idle'] + [f'walk{i}' for i in range(1, 9)],
          'act': ['atk1', 'atk2', 'atk3', 'atk4', 'hit1', 'hit2', 'air', 'down'],
          'more': ['cast1', 'cast2', 'low1', 'low2', 'getup', 'jump', 'idle2', 'taunt']}
UPRIGHT = {'act': ['atk1', 'hit1'], 'more': ['idle2', 'taunt', 'cast1', 'cast2']}

def rescale(d, meta, n, k):
    p = os.path.join(d, n + '.webp'); im = Image.open(p).convert('RGBA')
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS); im.save(p, 'WEBP', quality=76, method=6)
    F = meta['frames'][n]; F['w'], F['h'] = im.width, im.height; F['ax'] = round(F['ax'] * k, 1); F['ay'] = round(F['ay'] * k, 1)

def check(name, apply, tol):
    d = os.path.join(HERE, 'final', 'spr', name); meta = json.load(open(os.path.join(d, 'spr.json'))); fr = meta['frames']
    base = [n for n in SHEETS['walk'] if n in fr]; BM = {n: mask(os.path.join(d, n + '.webp')) for n in base}
    out = []
    import summon_art; C = summon_art.A.M.get(name, {})   # 自定义帧名的召唤兽（卡西利亚斯）：帧名和直立帧按 summon_art 里的定义
    for sh in ('act', 'more'):
        names = [n for n in ([x for x, _ in C['custom'][sh]] if sh in C.get('custom', {}) else SHEETS[sh]) if n in fr]
        if not names: continue
        e1 = []
        for n in names:
            m = mask(os.path.join(d, n + '.webp')); best = None
            for b in base:
                s, _, _, iou = align(BM[b], m, np.arange(0.7, 1.41, 0.03))
                if best is None or iou > best[1]: best = (s, iou)
            if best[1] >= 0.6: e1.append(best[0])
        r1 = statistics.median(e1) if len(e1) >= 2 else None
        hs = [fr[n]['h'] / fr['idle']['h'] for n in C.get('upright', UPRIGHT)[sh] if n in fr]
        r2 = statistics.median(hs) if hs else None
        agree = r1 is not None and r2 is not None and abs(r1 - 1) > tol and abs(r2 - 1) > tol and (r1 - 1) * (r2 - 1) > 0
        k = 1 / ((r1 * r2) ** 0.5) if agree else 1
        out.append((sh, r1, r2, agree, k))
        print(f'{name}/{sh}: 轮廓 {r1 and round(r1, 3)}（{len(e1)} 帧）  站姿高度 {r2 and round(r2, 3)}  → {"缩放 %.3f" % k if agree else "不改"}')
        if agree and apply:
            for n in names: rescale(d, meta, n, k)
    if apply: json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'), indent=1)
    return out

if __name__ == '__main__':
    a = sys.argv[1:]; tol = 0.06
    if '--tol' in a: tol = float(a[a.index('--tol') + 1]); a = [x for i, x in enumerate(a) if x != '--tol' and (i == 0 or a[i - 1] != '--tol')]
    apply = '--apply' in a; ids = [x for x in a if not x.startswith('--')]
    for n in ids: check(n, apply, tol)
