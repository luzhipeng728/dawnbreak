#!/usr/bin/env python3
"""外观与换装：同一帧在各套时装之间比大小（各套都摘了帽子 / 披风，比和原装比可靠）。
  avatar_crossscale.py [--apply] [--tol 0.06] [职业...]
对每个职业、每一帧：把 A 套的轮廓缩放后和 B 套对齐（avatar_align.align，IoU 最高），得到 A 相对 B 的大小；
A 相对其他各套的中位数 = A 这一格画大 / 画小了多少。超过 tol 的：
  - --apply：按比例缩回去（以脚底锚点为中心；武器轨迹 / 头部锚点 / 握拳轮廓一起换算）
对齐重合度低（< 0.6）的对照不算（姿势不同的格子另外列出来，需要重新生成）。
"""
import os, sys, json, statistics
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from avatar_align import align, mask
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ['festival', 'spring', 'sky1', 'summer', 'sky2', 'academy']

def rescale(sd, meta, n, k):
    p = os.path.join(sd, n + '.webp'); im = Image.open(p).convert('RGBA')
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS); im.save(p, 'WEBP', quality=76, method=6)
    F = meta['frames'][n]; F['w'], F['h'] = im.width, im.height
    for key in ('ax', 'ay'): F[key] = round(F[key] * k, 1)
    for key in ('wpn', 'wpn2'):
        W = F.get(key)
        if not W: continue
        for f2 in ('gx', 'gy', 'len', 'bk'):
            if f2 in W: W[f2] = round(W[f2] * k, 1)
        if 'hand' in W: W['hand'] = [[round(v * k, 1) for v in P] for P in W['hand']]
    if F.get('head'): F['head'] = {**F['head'], 'x': round(F['head']['x'] * k, 1), 'y': round(F['head']['y'] * k, 1)}

def main():
    args = sys.argv[1:]; apply = '--apply' in args; tol = 0.06
    if '--tol' in args: tol = float(args[args.index('--tol') + 1])
    classes = [a for a in args if a in ('sword', 'gun', 'mage')] or ['sword', 'gun', 'mage']
    total = []
    for cls in classes:
        dirs = {s: os.path.join(HERE, 'final', 'spr', f'{cls}@{s}') for s in SETS if os.path.isdir(os.path.join(HERE, 'final', 'spr', f'{cls}@{s}'))}
        metas = {s: json.load(open(os.path.join(d, 'spr.json'))) for s, d in dirs.items()}
        frames = sorted(set.intersection(*[set(m['frames']) for m in metas.values()]))
        fix, odd = [], []
        for f in frames:
            M = {s: mask(os.path.join(d, f + '.webp')) for s, d in dirs.items()}
            rel = {}
            for a in dirs:
                vals = []
                for b in dirs:
                    if a == b: continue
                    s_, _, _, iou = align(M[b], M[a])   # a ≈ s × b
                    if iou >= 0.6: vals.append(s_)
                if len(vals) >= 3: rel[a] = statistics.median(vals)
                else: odd.append(f'{a}/{f}')
            for a, r in rel.items():
                if abs(r - 1) > tol: fix.append((a, f, r))
        # 轮廓估的大小会被翅膀 / 宽袖子带偏：再用头（各套都是同样的头发、没帽子）的大小核一遍，两边都说偏、方向一致才改
        from avatar_sizecheck import head_tpl, head_scale, load
        tpl = {a: head_tpl(load(d, 'idle')) for a, d in dirs.items()}
        agreed, rejected = [], []
        for a, f, r in fix:
            hs = {}
            for b, d in dirs.items():
                H = metas[b]['frames'][f].get('head')
                if H: hs[b] = head_scale(load(d, f), H, *tpl[b])
            if a not in hs: rejected.append((a, f, r, None)); continue
            med = statistics.median(v for v, e in hs.values()); hr, he = hs[a][0] / med, hs[a][1]
            if he < 75 and abs(hr - 1) > 0.04 and (hr - 1) * (r - 1) > 0: agreed.append((a, f, (r + hr) / 2))
            else: rejected.append((a, f, r, round(hr, 2)))
        print(f'{cls}: 轮廓大小和其他套差 > {tol:.0%} 的格子 {len(fix)} 个；头的大小也对得上（真的画大 / 画小了）{len(agreed)} 个：' + ' '.join(f'{a}/{f}({r:.2f})' for a, f, r in agreed))
        print(f'    头的大小正常（轮廓差是翅膀 / 袖子 / 姿势造成的，不改）：' + ' '.join(f'{a}/{f}(轮廓{r:.2f} 头{h})' for a, f, r, h in rejected))
        fix = agreed
        print(f'    和其他套都对不齐（姿势不同）：{" ".join(odd) or "无"}')
        if apply:
            for a, f, r in fix: rescale(dirs[a], metas[a], f, 1 / r)
            for s, d in dirs.items(): json.dump(metas[s], open(os.path.join(d, 'spr.json'), 'w'), indent=1)
        total += [(cls, a, f, round(r, 3)) for a, f, r in fix]
    print(f'共 {len(total)} 格' + ('，已按比例缩回' if apply else ''))

if __name__ == '__main__':
    main()
