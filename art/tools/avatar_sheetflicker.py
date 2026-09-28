#!/usr/bin/env python3
"""外观与换装：动作表（3×3）里衣服的帧间差异打分（不用切帧，直接比较原表 / 返修表）。
  avatar_sheetflicker.py <png...>
每格取身体（去白底、去绿棍）、去掉上 35%（头发 / 脸），算颜色直方图（RGB 各 6 档）和 Lab 平均亮度；
分数 = 相邻两格直方图差的平均（walk 表第 1 格是站姿，和每一格都比一次）；越小越稳定。
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg
import avatar_frames as AF

def cells(path):
    a = np.array(remove_bg(Image.open(path))); g, m = AF.key_maps(a)
    al = np.where((g > 0.2) | (m > 0.3), 0, a[..., 3]).astype(np.uint8)
    lab, order = AF.cut_boxes(al)
    out = []
    for b in order:
        sub = a[b['y0']:b['y1'], b['x0']:b['x1']]; ok = np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']) & (al[b['y0']:b['y1'], b['x0']:b['x1']] > 200)
        h = sub.shape[0]; ok[:int(h * 0.35)] = False
        px = np.minimum(sub[..., :3][ok] // 43, 5)
        idx = px[:, 0] * 36 + px[:, 1] * 6 + px[:, 2]
        hist = np.bincount(idx, minlength=216).astype(np.float32); hist /= max(1, hist.sum())
        lum = float((sub[..., :3][ok].astype(np.float32) @ np.array([0.3, 0.59, 0.11])).mean())
        out.append((hist, lum))
    return out

def score(path):
    c = cells(path); walk = os.path.basename(path).endswith('_walk.png')
    pairs = [(0, i) for i in range(1, len(c))] if walk else [(i, i + 1) for i in range(1, len(c) - 1)]
    d = [0.5 * float(np.abs(c[i][0] - c[j][0]).sum()) for i, j in pairs]
    lum = [x[1] for x in c[1:]]
    return float(np.mean(d)), float(np.std(lum))

if __name__ == '__main__':
    for p in sys.argv[1:]:
        s, l = score(p); print(f'{p.split("avatar/")[-1]:40s} 直方图差 {s:.3f}  亮度抖动 {l:.2f}')
