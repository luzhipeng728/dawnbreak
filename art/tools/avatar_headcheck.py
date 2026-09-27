#!/usr/bin/env python3
"""外观与换装：时装帧的头部锚点和原装同帧对照（姿势一样，按脚底锚点平移后头应该在差不多的位置）。
  avatar_headcheck.py <套装id> [--fix]    差太多的帧列出来；--fix 时改用原装的头部位置（平移过来），写回 spr.json
原装的头部锚点是在原装站姿上找的（职业自带帽子的也一样找得准），时装帧摘了帽子后个别大动作帧会找错，用这个兜底。
"""
import os, sys, json, math
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOL = 22.0   # 帧像素

def main():
    sid = sys.argv[1]; fix = '--fix' in sys.argv
    for c in ('sword', 'gun', 'mage'):
        pa, pb = os.path.join(HERE, 'final', 'spr', c, 'spr.json'), os.path.join(HERE, 'final', 'spr', f'{c}@{sid}', 'spr.json')
        if not os.path.exists(pb): continue
        A = json.load(open(pa)); B = json.load(open(pb)); bad = []
        for f, F in B['frames'].items():
            G = A['frames'].get(f); hb, ha = F.get('head'), G and G.get('head')
            if not hb or not ha: continue
            px, py = ha['x'] - G['ax'] + F['ax'], ha['y'] - G['ay'] + F['ay']
            d = math.hypot(hb['x'] - px, hb['y'] - py)
            if d > TOL:
                bad.append(f'{f}:{d:.0f}')
                if fix:
                    H = {'x': round(px, 1), 'y': round(py, 1), 'a': ha['a']}
                    if 'f' in hb: H['f'] = hb['f']
                    F['head'] = H
        if fix and bad: json.dump(B, open(pb, 'w'), indent=1)
        print(f'{c}@{sid}: 头部位置和原装差 > {TOL:.0f}px 的帧 {bad or "无"}{"（已改用原装位置）" if fix and bad else ""}')

if __name__ == '__main__':
    main()
