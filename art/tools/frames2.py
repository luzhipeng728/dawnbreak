#!/usr/bin/env python3
"""第二版切帧：3×3 动作表 → 9 帧（第 1 格为站姿参考，只用 walk 表的那张作 idle）。
对齐：走 / 跑循环按“躯干中线 + 同一行的脚底基线”对齐（腾空帧保留离地高度，不会抖）；其他表按“脚底中线 + 自身脚底”对齐。
比例：每张表按参考站姿的高度统一。输出 art/final/spr/<角色>/<帧>.webp + spr.json
  frames2.py [前缀]
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components, fill_holes
from frames import HEIGHT
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = float(os.environ.get('RES', 2.0))
W8 = [f'walk{i}' for i in range(1, 9)]; R8 = [f'run{i}' for i in range(1, 9)]
JUMP = ['jump1', 'jump2', 'jump3', 'jump4', 'jump5', 'jatk1', 'jatk2', 'jatk3']
NAMES = {
    'sword': {'combo': ['a1_1', 'a1_2', 'a1_3', 'a2_1', 'a2_2', 'a2_3', 'a3_1', 'a3_2'], 'react': ['hit1', 'hit2', 'air', 'down', 'getup', 'roll', 'dash1', 'dash2'],
              'skillA': ['up1', 'up2', 'up3', 'spin1', 'spin2', 'iai1', 'iai2', 'stab1'], 'skillB': ['stab2', 'slam1', 'slam2', 'rise1', 'rise2', 'focus', 'awk1', 'awk2']},
    'gun': {'combo': ['shoot1', 'shoot2', 'shootUp1', 'shootUp2', 'kick1', 'kick2', 'sk1', 'sk2'], 'react': ['hit1', 'hit2', 'air', 'down', 'getup', 'roll', 'slide1', 'slide2'],
            'skillA': ['throw1', 'throw2', 'gat1', 'gat2', 'snipe', 'twirl', 'rapid1', 'rapid2'], 'skillB': ['hawk1', 'hawk2', 'awk1', 'awk2', 'dash', 'reload', 'taunt', 'victory']},
    'mage': {'combo': ['m1_1', 'm1_2', 'm1_3', 'm2_1', 'm2_2', 'm2_3', 'cast1', 'cast2'], 'react': ['hit1', 'hit2', 'air', 'down', 'getup', 'roll', 'dash1', 'dash2'],
             'skillA': ['castUp1', 'castUp2', 'castDown1', 'castDown2', 'chan1', 'chan2', 'burst', 'palm'], 'skillB': ['spin', 'pray', 'cheer', 'meteor', 'tornado', 'grip', 'awk', 'victory']},
}
MON = {'act': ['atk1', 'atk2', 'atk3', 'atk4', 'hit1', 'hit2', 'air', 'down'], 'more': ['cast1', 'cast2', 'low1', 'low2', 'getup', 'jump', 'idle2', 'taunt']}
CYCLE = {'walk', 'run'}

def names_for(char, sheet):
    if sheet == 'walk': return ['idle'] + W8
    if sheet == 'run': return [None] + R8
    if sheet == 'jump': return [None] + JUMP
    return [None] + (NAMES[char][sheet] if char in NAMES else MON[sheet])

def cut9(path, n=9):
    im = fill_holes(remove_bg(Image.open(path)), min_area=90, thr=251); arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=4)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); big, small = boxes[:n], boxes[n:]
    for s in small:
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        dist = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=dist)
        if dist(b) > 150: continue
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    # 按格子分行：图是 3×3，按纵向中心落在哪个三分之一
    H = arr.shape[0]
    for b in big: b['row'] = min(2, int((b['y0'] + b['y1']) / 2 / (H / 3)))
    order = sorted(big, key=lambda b: (b['row'], b['x0']))
    return im, arr, lab, order

def main():
    pre = sys.argv[1] if len(sys.argv) > 1 else ''
    src = os.path.join(ROOT, 'src', 'sheets2'); pv_dir = os.path.join(ROOT, 'cut', 'sheets2'); os.makedirs(pv_dir, exist_ok=True)
    chars = {}
    for f in sorted(os.listdir(src)):
        char, sheet = f[:-4].rsplit('_', 1)
        if char.startswith(pre): chars.setdefault(char, []).append((sheet, os.path.join(src, f)))
    for char, sheets in chars.items():
        out = os.path.join(ROOT, 'final', 'spr', char)
        if os.path.isdir(out):
            for x in os.listdir(out): os.remove(os.path.join(out, x))
        os.makedirs(out, exist_ok=True)
        meta = {'res': RES, 'frames': {}}
        for sheet, path in sheets:
            names = names_for(char, sheet)
            im, arr, lab, order = cut9(path)
            rows_ok = [sum(1 for b in order if b['row'] == r) for r in range(3)]
            bad = len(order) != 9 or rows_ok != [3, 3, 3]
            print(f'{char}_{sheet}: {len(order)} frames rows={rows_ok}{"  <-- CHECK" if bad else ""}')
            pv = Image.new('RGB', im.size, (60, 64, 72)); pv.paste(im, (0, 0), im); d = ImageDraw.Draw(pv)
            for i, b in enumerate(order):
                d.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], outline=(255, 220, 60), width=3); d.text((b['x0'] + 4, b['y0'] + 4), f'{i} {names[i] if i < len(names) else "?"}', fill=(255, 60, 60))
            pv.thumbnail((900, 900)); pv.save(os.path.join(pv_dir, f'{char}_{sheet}.png'))
            if not order: continue
            ref = order[0]; k = HEIGHT[char] * RES / (ref['y1'] - ref['y0'])
            base = {r: max(b['y1'] for b in order if b['row'] == r) for r in range(3) if any(b['row'] == r for b in order)}
            for b, fn in zip(order, names):
                if fn is None or fn in meta['frames']: continue
                sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
                a = sub[..., 3] > 40; h = a.shape[0]
                if sheet in CYCLE:
                    xs = np.where(a[int(h * 0.15):int(h * 0.55)])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
                    ay = base[b['row']] - b['y0']            # 同一行的脚底基线：腾空帧自然离地
                else:
                    rows = np.where(a.any(1))[0]; bottom = rows.max() + 1
                    xs = np.where(a[max(0, bottom - int(h * 0.12)):bottom])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
                    ay = bottom
                fr = Image.fromarray(sub, 'RGBA'); sm = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS)
                sm.save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=int(os.environ.get('Q', 76)), method=6)
                meta['frames'][fn] = {'w': sm.width, 'h': sm.height, 'ax': round(ax * k, 1), 'ay': round(ay * k, 1)}
        json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1)
        tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith('.webp'))
        print(f'  -> {char}: {len(meta["frames"])} frames, {tot // 1024} KB')

if __name__ == '__main__':
    main()
