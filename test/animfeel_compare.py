#!/usr/bin/env python3
"""动作手感体检的改前 / 改后对比图（docs/ANIMATION.md）：test/animfeel.mjs 先各跑一次（输出名 B-<名> / A-<名>），
  python3 test/animfeel_compare.py <名> [段:起:止 ...]      默认 run:30:60 combo:0:42
输出 test/shots/animfeel/compare_<名>.png（每段两行：改前 / 改后，每格一个 60Hz 逻辑步）和 curves_<名>.png（头部轨迹曲线）"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
D = 'test/shots/animfeel/'
name = sys.argv[1] if len(sys.argv) > 1 else 'sword'
segs = [a.split(':') for a in sys.argv[2:]] or [['run', '30', '60'], ['combo', '0', '42']]
FONT = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 22)
CW, CH, SC, LW = 150, 160, 0.75, 120
rows = []
for seg, a, b in segs:
    for tag, lab in (('B', '改前'), ('A', '改后')):
        p = f'{D}{tag}-{name}_{seg}.png'
        if not os.path.exists(p): continue
        im = Image.open(p); cols = im.width // CW
        cells = [im.crop(((i % cols) * CW, (i // cols) * CH, (i % cols) * CW + CW, (i // cols) * CH + CH)) for i in range(int(a), int(b)) if (i // cols) * CH < im.height]
        rows.append((f'{seg}\n{lab}', cells))
w, h = int(CW * SC), int(CH * SC)
out = Image.new('RGB', (LW + w * max(len(c) for _, c in rows), h * len(rows)), (24, 24, 30))
d = ImageDraw.Draw(out)
for r, (lab, cells) in enumerate(rows):
    d.multiline_text((8, r * h + 30), lab, fill=(255, 230, 150) if '改后' in lab else (200, 200, 210), font=FONT)
    for i, c in enumerate(cells): out.paste(c.resize((w, h), Image.LANCZOS), (LW + i * w, r * h))
out.save(f'{D}compare_{name}.png'); print(f'{D}compare_{name}.png', out.size)
# 曲线：跑步中头部相对锚点的高度 / 前后位置、普攻中头部每步的水平位移
try:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    plt.rcParams['font.sans-serif'] = ['Heiti TC', 'STHeiti', 'Arial Unicode MS']; plt.rcParams['axes.unicode_minus'] = False
    fig, ax = plt.subplots(1, 3, figsize=(15, 3.6))
    for tag, col, lab in (('B', '#999', '改前'), ('A', '#e8603c', '改后')):
        R = json.load(open(f'{D}{tag}-{name}.json'))['rec']
        run = [r for r in R if r['seg'] == 'run'][30:90]
        ax[0].step(range(len(run)), [-r.get('hy', 0) for r in run], where='post', color=col, label=lab)
        ax[1].step(range(len(run)), [r.get('hx', 0) for r in run], where='post', color=col, label=lab)
        cb = [r for r in R if r['seg'] == 'combo'][:42]
        ax[2].step(range(len(cb)), [r.get('hx', 0) for r in cb], where='post', color=col, label=lab)
    for a, t in zip(ax, ('跑步：头顶高度（世界像素）', '跑步：头部前后（相对锚点）', '普攻 1~3：头部前后（相对锚点）')): a.set_title(t); a.set_xlabel('逻辑步（1/60 秒）'); a.legend()
    fig.tight_layout(); fig.savefig(f'{D}curves_{name}.png', dpi=80); print(f'{D}curves_{name}.png')
except ImportError:
    pass
