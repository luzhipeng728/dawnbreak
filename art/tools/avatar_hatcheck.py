#!/usr/bin/env python3
"""原装帽子检查：神枪手 / 魔法师的原装帧都应该戴着报童帽 / 巫师帽（运行时 AVATAR_HAT_CLS：默认造型自带帽子，
缺帽子的帧在放技能时帽子会一闪一闪）。改图重画（换占位棍、单格返修）偶尔会把帽子画丢。
  avatar_hatcheck.py [职业...] [--frames a,b,...]     退出码 1 = 有疑似丢帽子的帧
做法：站姿帧的头部模板（avatar_head.head_template，头部锚点 = 模板中心）上半截 = “帽子区”。
帽子色 = 原装站姿帽子区里常见、而各套时装站姿（摘了帽子，只有头发）同一区域里少见的颜色（RGB 各 8 档）——
神枪手的报童帽和头发都是棕色，整体直方图分不开，要按细分颜色挑出“帽子特有”的那几档。
每帧按自己的头部锚点（位置 + 转角）把帽子区映射过去取像素，算帽子色占比 s。
阈值用两组帧定：原装帧（戴帽子）是正例，同名时装帧（全都摘了帽子）是反例，取正例第 5 百分位和反例第 95 百分位的中点；
原装帧 s 低于阈值 = 疑似丢帽子。没有头部锚点的帧跳过（先跑 avatar_head.py）。
"""
import os, sys, json, math, statistics
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from avatar_head import head_template, HEAD_FRAC
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAT_CLS = ('gun', 'mage')
# 人工看过、确实戴着帽子的帧（头部大角度：抬头 / 低头 / 俯冲，帽子区按头部锚点映射过去会偏，颜色判断不准）；新增前先放大看原装帧
HAT_OK = {'gun': {'sfBomb', 'sfDashAtk', 'sfFlare', 'sfLand', 'sfHover', 'sfSoar', 'sfEmp1', 'sfCross'}}   # 弹药专家组确认
SETS = ['academy', 'festival', 'sky1', 'sky2', 'spring', 'summer']

def load(d, f):
    return np.array(Image.open(os.path.join(HERE, 'final', 'spr', d, f + '.webp')).convert('RGBA'))

def bins(px):
    """px：N×3（0~255）→ RGB 各 8 档的格子编号"""
    q = (px.astype(np.int32) >> 5); return q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]

def hist(px):
    h = np.bincount(bins(px), minlength=512).astype(np.float64); return h / max(1, h.sum())

def cap_zone(idle):
    """站姿帧：帽子区在模板坐标里的点（相对模板中心的偏移），以及站姿帧里这些点的颜色直方图"""
    tpl, (cx, cy) = head_template(idle)
    th, tw = tpl.shape[:2]
    ys, xs = np.where(tpl[..., 3] > 128)
    top = ys < th / 2   # 模板上半截
    off = np.stack([xs[top] - tw / 2, ys[top] - th / 2], 1).astype(np.float32)
    return off

def sample(fr, H, off):
    a = H.get('a', 0); c, s = math.cos(a), math.sin(a)
    x = H['x'] + off[:, 0] * c - off[:, 1] * s; y = H['y'] + off[:, 0] * s + off[:, 1] * c
    xi, yi = np.round(x).astype(int), np.round(y).astype(int)
    ok = (xi >= 0) & (xi < fr.shape[1]) & (yi >= 0) & (yi < fr.shape[0])
    p = fr[yi[ok], xi[ok]]; p = p[p[:, 3] > 128]
    return p[:, :3]

def check(cls, only=None):
    meta = json.load(open(os.path.join(HERE, 'final', 'spr', cls, 'spr.json')))['frames']
    idle = load(cls, 'idle'); off = cap_zone(idle)
    # 站姿帧的模板中心 = 它自己的头部锚点（avatar_head 就是这么定义的），直接按锚点取
    ref = hist(sample(idle, meta['idle']['head'], off))
    nh = []
    for sid in SETS:
        d = f'{cls}@{sid}'; p = os.path.join(HERE, 'final', 'spr', d, 'spr.json')
        if os.path.exists(p) and os.path.exists(os.path.join(HERE, 'final', 'spr', d, 'idle.webp')):
            H = json.load(open(p))['frames'].get('idle', {}).get('head')
            if H: nh.append(hist(sample(load(d, 'idle'), H, off)))
    neg_ref = np.mean(nh, 0) if nh else np.zeros(512)
    cap = (ref > 0.004) & (ref > 3 * neg_ref)   # 帽子特有的颜色档
    def score(fr, H):
        px = sample(fr, H, off)
        return float(cap[bins(px)].mean()) if len(px) > 20 else 0.0
    pos = {f: score(load(cls, f), F['head']) for f, F in meta.items() if F.get('head')}
    neg = []
    for sid in SETS:
        d = f'{cls}@{sid}'; p = os.path.join(HERE, 'final', 'spr', d, 'spr.json')
        if not os.path.exists(p): continue
        for f, F in json.load(open(p))['frames'].items():
            if F.get('head') and f in meta: neg.append(score(load(d, f), F['head']))
    mp, mn = statistics.median(pos.values()), statistics.median(neg) if neg else 0.0
    p5, n95 = float(np.percentile(list(pos.values()), 5)), float(np.percentile(neg, 95)) if neg else 0.0
    thr = (p5 + n95) / 2   # 正例最低的 5% 和反例最高的 5% 之间（实测：神枪手 0.32 / 0.19，魔法师 0.42 / 0.09）
    names = [f for f in pos if not only or f in only]
    bad = sorted((pos[f], f) for f in names if pos[f] < thr and f not in HAT_OK.get(cls, ()))
    lo = sorted(pos[f] for f in pos)
    print(f'{cls}: 帽子色 {int(cap.sum())} 档；原装帽子区帽子色占比 中位数 {mp:.2f}（最低 {lo[0]:.2f}），时装（摘帽）中位数 {mn:.2f}（95% {n95:.2f}），阈值 {thr:.2f}；'
          f'检查 {len(names)} 帧，疑似丢帽子 {len(bad)} 帧 {" ".join(f"{f}({s:.2f})" for s, f in bad) or ""}')
    if only: print('   ' + ' '.join(f'{f} {pos[f]:.2f}' for f in names))
    return bad

def main():
    args = sys.argv[1:]; only = None
    if '--frames' in args: i = args.index('--frames'); only = set(args[i + 1].split(',')); del args[i:i + 2]
    bad = []
    for cls in (args or HAT_CLS): bad += check(cls, only)
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
