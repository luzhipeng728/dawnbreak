#!/usr/bin/env python3
"""动作表 → 逐帧精灵：去背 → 连通块（小碎块并入最近的大块）→ 按行列排序 → 命名 → 统一比例（按每张表第 1 帧“站立”的高度）
→ 锚点 = 脚底（最低不透明行）+ 身体中线（躯干区域不透明像素的中位数），输出 art/final/spr/<角色>/<帧>.webp 与 spr.json
  frames.py [名字前缀]      预览图写到 art/cut/sheets/<表>.png
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = 2.2   # 每个世界单位的像素数（世界层按 2 倍像素渲染）
LOCO = ['idle', 'walk1', 'walk2', 'run1', 'run2', 'jump', 'crouch', 'hit']
NAMES = {
    'sword': {'A': LOCO, 'B': [None, 'wind', 'slashDown', 'slashUp', 'slashFwd', 'thrust', 'airSlash', 'down'], 'C': [None, 'iaiReady', 'iaiStrike', 'spin', 'stab', 'dash', 'focus', 'rise']},
    'gun': {'A': LOCO, 'B': [None, 'aim', 'aimUp', 'airDown', 'kickHigh', 'kickSide', 'slide', 'down'], 'C': [None, 'throwWind', 'throwRel', 'gatling', 'buff', 'snipe', 'dash', 'twirl']},
    'mage': {'A': LOCO, 'B': [None, 'staffWind', 'staffStrike', 'castFwd', 'castUp', 'castDown', 'channel', 'down'], 'C': [None, 'airCast', 'dash', 'burst', 'cheer', 'palm', 'spin', 'pray']},
}
MON_NAMES = ['idle', 'walk', 'wind', 'strike', 'cast', 'low', 'hit', 'down']
# 站立帧的目标高度（世界单位）
HEIGHT = {'sword': 118, 'gun': 112, 'mage': 116, 'goblin': 80, 'goblinCaptain': 82, 'goblinChief': 76, 'goblinShaman': 78, 'flameMage': 78, 'cat': 92, 'catKing': 88,
          'tau': 124, 'tauArmored': 118, 'tauKing': 116, 'zombie': 104, 'boneLord': 96}

def cut_sheet(path, n_expect):
    im = remove_bg(Image.open(path)); arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=4)
    boxes = []
    for n, cells in comps:
        ys, xs = np.where(lab == n); boxes.append({'ids': [n], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells'])
    big, small = boxes[:n_expect], boxes[n_expect:]
    for s in small:   # 碎块（掉落的刀尖、火星……）并入最近的大块
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        d = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=d)
        if d(b) > 120: continue   # 离得太远的当噪点丢掉
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    # 阅读顺序：按纵向中心分两行，行内按 x
    big.sort(key=lambda b: (b['y0'] + b['y1']) / 2)
    mid = arr.shape[0] / 2
    rows = [[b for b in big if (b['y0'] + b['y1']) / 2 < mid], [b for b in big if (b['y0'] + b['y1']) / 2 >= mid]]
    order = [b for r in rows for b in sorted(r, key=lambda b: b['x0'])]
    frames = []
    for b in order:
        sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy()
        mask = np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']); sub[..., 3] = np.where(mask, sub[..., 3], 0)
        frames.append((Image.fromarray(sub, 'RGBA'), b))
    return im, frames

def anchor(im):
    a = np.array(im)[..., 3] > 40; h, w = a.shape
    rows = np.where(a.any(1))[0]; bottom = rows.max() + 1
    band = a[int(h * 0.3):int(h * 0.9)]; xs = np.where(band)[1]
    ax = float(np.median(xs)) if len(xs) else w / 2
    return ax, float(bottom)

def main():
    pre = sys.argv[1] if len(sys.argv) > 1 else ''
    src = os.path.join(ROOT, 'src', 'sheets'); prev_dir = os.path.join(ROOT, 'cut', 'sheets'); os.makedirs(prev_dir, exist_ok=True)
    chars = {}
    for f in sorted(os.listdir(src)):
        name, sh = f[:-4].rsplit('_', 1)
        if not name.startswith(pre): continue
        chars.setdefault(name, []).append((sh, os.path.join(src, f)))
    for name, sheets in chars.items():
        out = os.path.join(ROOT, 'final', 'spr', name); os.makedirs(out, exist_ok=True)
        meta = {'res': RES, 'frames': {}}
        for sh, path in sorted(sheets):
            names = NAMES[name][sh] if name in NAMES else MON_NAMES
            im, frames = cut_sheet(path, len(names))
            ok = len(frames) == len(names)
            idle_h = frames[0][0].height if frames else 1
            k = HEIGHT[name] * RES / idle_h
            # 预览：带编号和名字
            pv = Image.new('RGB', im.size, (60, 64, 72)); pv.paste(im, (0, 0), im); d = ImageDraw.Draw(pv)
            for i, (fr, b) in enumerate(frames):
                d.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], outline=(255, 220, 60), width=3)
                d.text((b['x0'] + 4, b['y0'] + 4), f'{i} {names[i] if i < len(names) else "?"}', fill=(255, 80, 80))
            pv.thumbnail((1000, 1000)); pv.save(os.path.join(prev_dir, f'{name}_{sh}.png'))
            print(f'{name}_{sh}: {len(frames)} frames (expect {len(names)}){"" if ok else "  <-- MISMATCH"}')
            for (fr, b), fn in zip(frames, names):
                if fn is None or fn in meta['frames']: continue
                sm = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS)
                ax, ay = anchor(sm)
                sm.save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=82, method=6)
                meta['frames'][fn] = {'w': sm.width, 'h': sm.height, 'ax': round(ax, 1), 'ay': round(ay, 1)}
        json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1)
        tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith('.webp'))
        print(f'  -> {name}: {len(meta["frames"])} frames, {tot // 1024} KB')

if __name__ == '__main__':
    main()
