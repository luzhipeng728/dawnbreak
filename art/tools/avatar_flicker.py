#!/usr/bin/env python3
"""外观与换装：同一片段里衣服颜色 / 花纹的帧间差异（闪烁）。
  avatar_flicker.py [套装...] [--json 输出]
城镇里最常看到的片段：待机（idle）、走路（walk1~8）、跑步（run1~8）。
每帧取头部以下（衣服）的不透明像素，算颜色直方图（RGB 各 8 档）；
“离群分” = 这一帧和片段内所有帧直方图中位数的差（0~1）。原装同一片段的最大离群分作参照：
时装里离群分超过 max(原装最大值 × 1.3, 0.12) 的帧 = 衣服明显和同片段其他帧不一样（换了花纹 / 渐变 / 颜色），走动时会闪 → 需要返修。
"""
import os, sys, json
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ['festival', 'spring', 'sky1', 'summer', 'sky2', 'academy']
CLIPS = {'walk': ['idle'] + [f'walk{i}' for i in range(1, 9)], 'run': [f'run{i}' for i in range(1, 9)]}
BINS = 8

def body_hist(d, meta, f):
    a = np.array(Image.open(os.path.join(d, f + '.webp')).convert('RGBA'))
    H = meta[f].get('head'); y0 = int(H['y'] + 38) if H else int(a.shape[0] * 0.4)   # 头部锚点往下（衣服）
    b = a[max(0, y0):]; m = b[..., 3] > 200
    px = np.minimum(b[..., :3][m] // (256 // BINS), BINS - 1)
    idx = px[:, 0] * BINS * BINS + px[:, 1] * BINS + px[:, 2]
    h = np.bincount(idx, minlength=BINS ** 3).astype(np.float32)
    return h / max(1, h.sum())

def hair_bins(d, meta):
    """头发 / 皮肤的颜色档：站姿帧头部（上 30%）里占比 > 2% 的档。魔法师的长发会盖住半个身子，不去掉的话直方图全是头发"""
    a = np.array(Image.open(os.path.join(d, 'idle.webp')).convert('RGBA')); t = a[:int(a.shape[0] * 0.3)]; m = t[..., 3] > 200
    px = np.minimum(t[..., :3][m] // (256 // BINS), BINS - 1); idx = px[:, 0] * BINS * BINS + px[:, 1] * BINS + px[:, 2]
    h = np.bincount(idx, minlength=BINS ** 3).astype(np.float32); h /= max(1, h.sum())
    return h > 0.02

def outliers(key, clip):
    d = os.path.join(HERE, 'final', 'spr', key); meta = json.load(open(os.path.join(d, 'spr.json')))['frames']
    fs = [f for f in CLIPS[clip] if f in meta]; hb = hair_bins(d, meta)
    H = np.stack([body_hist(d, meta, f) for f in fs]); H[:, hb] = 0; H /= np.maximum(1e-6, H.sum(1, keepdims=True))
    med = np.median(H, 0); med /= max(1e-6, med.sum())
    return {f: round(0.5 * float(np.abs(H[i] - med).sum()), 3) for i, f in enumerate(fs)}

def main():
    args = sys.argv[1:]; jout = None
    if '--json' in args: i = args.index('--json'); jout = args[i + 1]; del args[i:i + 2]
    sets = args or SETS; bad = []
    for cls in ('sword', 'gun', 'mage'):
        ref = {c: max(outliers(cls, c).values()) for c in CLIPS}
        print(f'{cls}（原装最大离群分）: ' + '  '.join(f'{c} {ref[c]:.3f}' for c in CLIPS))
        for sid in sets:
            key = f'{cls}@{sid}'
            if not os.path.isdir(os.path.join(HERE, 'final', 'spr', key)): continue
            line = []
            for c in CLIPS:
                o = outliers(key, c); th = max(ref[c] * 1.3, 0.12)
                b = [f for f, v in o.items() if v > th]; bad += [{'set': sid, 'cls': cls, 'clip': c, 'frame': f, 'score': o[f], 'th': round(th, 3)} for f in b]
                line.append(f'{c} 最大 {max(o.values()):.3f}' + (f' 离群 {" ".join(f"{f}({o[f]:.2f})" for f in b)}' if b else ''))
            print(f'  @{sid:8s} ' + '；'.join(line))
    print(f'共 {len(bad)} 帧离群')
    if jout: json.dump(bad, open(jout, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
