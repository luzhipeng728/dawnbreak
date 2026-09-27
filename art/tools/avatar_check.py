#!/usr/bin/env python3
"""外观与换装：时装帧集和原装帧逐帧对照（切帧后自查）。
  avatar_check.py <套装id>
检查：帧是否齐全；每帧有没有武器、双持、身前身后、武器方向是否和原装一致；帧高差太多（人被放大 / 缩小）。
不一致的帧多半是改图时把武器画丢了 / 画反了，回头看 art/src/avatar/cut/<套装>/ 的预览，用 avatar_gen.py touch 单格返修或写 avatar_fix.json。
"""
import os, sys, json, math
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    sid = sys.argv[1]; bad_all = 0
    for c in ('sword', 'gun', 'mage'):
        pa, pb = os.path.join(HERE, 'final', 'spr', c, 'spr.json'), os.path.join(HERE, 'final', 'spr', f'{c}@{sid}', 'spr.json')
        if not os.path.exists(pb): print(c, '没有帧集'); continue
        A = json.load(open(pa))['frames']; B = json.load(open(pb))['frames']
        miss = [f for f in A if f not in B]; bad = []
        for f in A:
            if f not in B: continue
            a, b = A[f].get('wpn'), B[f].get('wpn')
            if bool(a) != bool(b): bad.append(f'{f}:武器有无({bool(a)}/{bool(b)})'); continue
            if a:
                d = abs((a['ang'] - b['ang'] + math.pi) % (2 * math.pi) - math.pi)
                if d > 0.45: bad.append(f'{f}:方向{math.degrees(a["ang"]):.0f}/{math.degrees(b["ang"]):.0f}')
                if a['front'] != b['front']: bad.append(f'{f}:身前身后')
            if bool(A[f].get('wpn2')) != bool(B[f].get('wpn2')): bad.append(f'{f}:双持')
            if abs(A[f]['h'] - B[f]['h']) / A[f]['h'] > 0.15: bad.append(f'{f}:帧高{A[f]["h"]}/{B[f]["h"]}')
        bad_all += len(miss) + len(bad)
        print(f'{c}@{sid}: 缺帧 {miss or "无"}；不一致 {bad or "无"}')
    sys.exit(1 if bad_all else 0)

if __name__ == '__main__':
    main()
