#!/usr/bin/env python3
"""魔道学者骑扫把帧的武器轨迹修正（切帧之后跑一次；重复跑没有影响）。
切帧工具把占位棍当成法杖：握点在手上、尖端朝前上方。扫把的“尖端”是扫帚毛（weapon/broom 的 tx），骑扫把时要放在身后：
  - brIdle / brDash / brAtk1 / brAtk2 / brFall：扫帚毛放在占位棍靠后（x 小）的那一端，握点往前量 GRIP 像素（= 扫把图握点到毛端的长度，
    这样扫把图上的握把正好落在手上），bk 放大，整根扫把都画出来；
  - faceplant：扫把掉在手边，整根朝前平放。
改的是 art/final/spr/mage/spr.json 和 6 套时装的 spr.json（每套的轨迹各自换算）。
  witch_wpn.py [--dry]
"""
import os, sys, json, math
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ['', '@academy', '@festival', '@sky1', '@sky2', '@spring', '@summer']
RIDE = ['brIdle', 'brDash', 'brAtk1', 'brAtk2', 'brFall']
GRIP, BK = 90.0, 70.0
# 个别时装帧的占位棍识别偏了：握点直接按脚底锚点的相对位置给（和其他套装同一帧对齐）
OVERRIDE = {'@sky2/brIdle': {'dx': -11.0, 'dy': -61.0, 'ang': 2.97}}

def fix(w, ride):
    u = (math.cos(w['ang']), math.sin(w['ang']))
    g = (w['gx'], w['gy']); a = (g[0] - w.get('bk', 0) * u[0], g[1] - w.get('bk', 0) * u[1]); b = (g[0] + w['len'] * u[0], g[1] + w['len'] * u[1])
    if ride:
        tail, head = (a, b) if a[0] <= b[0] else (b, a)          # 扫帚毛在靠后（x 小）的一端
        d = (tail[0] - head[0], tail[1] - head[1]); L = math.hypot(*d) or 1; v = (d[0] / L, d[1] / L)
        w['gx'], w['gy'] = round(tail[0] - GRIP * v[0], 1), round(tail[1] - GRIP * v[1], 1); w['ang'] = round(math.atan2(v[1], v[0]), 3)
    w['len'] = GRIP; w['bk'] = BK; w['wt'] = 1
    return w

def main():
    dry = '--dry' in sys.argv
    for s in SETS:
        p = os.path.join(HERE, 'final', 'spr', 'mage' + s, 'spr.json')
        if not os.path.exists(p): print('缺', p); continue
        J = json.load(open(p)); n = 0
        for f in RIDE + ['faceplant']:
            F = J['frames'].get(f); w = F and F.get('wpn')
            if not w or w.get('wt'): continue
            fix(w, f in RIDE); n += 1
            o = OVERRIDE.get(f'{s}/{f}')
            if o: w['gx'], w['gy'], w['ang'] = round(F['ax'] + o['dx'], 1), round(F['ay'] + o['dy'], 1), o['ang']
            print(f'{s or "base":10s} {f:9s} grip=({w["gx"]},{w["gy"]}) ang={w["ang"]} front={w.get("front")}')
        if n and not dry: json.dump(J, open(p, 'w'), indent=1)
        print(p, n, '帧')

if __name__ == '__main__':
    main()
