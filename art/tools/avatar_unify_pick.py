#!/usr/bin/env python3
"""外观与换装：比较时装表和“统一细节”重画的表，挑更稳定、姿势没变的那张。
  avatar_unify_pick.py [--apply]
对每张 art/src/avatar/unify/<套装>/<表>.png：
  - 闪烁分（avatar_sheetflicker：格与格衣服直方图差、亮度抖动）必须比原来的时装表低；
  - 姿势不能变：和占位表逐格比轮廓（去掉头顶），每格 IoU 不能比原时装表低 0.04 以上；
  - 占位棍还在（绿色像素数不少于原来的 80%）。
都满足的列为“采用”；--apply 时把原时装表备份到 sets/<套装>/_pre/ 再换成统一版（之后重切这几张表）。
"""
import os, sys, json, shutil
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg
import avatar_frames as AF
from avatar_sheetflicker import score
AV = '/Users/luzhipeng/projects/dawnbreak/art/src/avatar'

def cell_masks(path):
    a = np.array(remove_bg(Image.open(path))); g, m = AF.key_maps(a)
    al = np.where((g > 0.2) | (m > 0.3), 0, a[..., 3]).astype(np.uint8)
    lab, order = AF.cut_boxes(al)
    out = []
    for b in order:
        M = np.zeros(al.shape, bool); sub = np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']) & (al[b['y0']:b['y1'], b['x0']:b['x1']] > 60)
        h = b['y1'] - b['y0']; sub[:int(h * 0.3)] = False   # 去掉头顶（头发 / 帽子）
        M[b['y0']:b['y1'], b['x0']:b['x1']] = sub; out.append(M)
    return out, int((g > 0.5).sum())

def ious(ref, cand):
    return [float((a & b).sum() / max(1, (a | b).sum())) for a, b in zip(ref, cand)]

def main():
    apply = '--apply' in sys.argv; picked = []
    for sid in sorted(os.listdir(os.path.join(AV, 'unify'))):
        for f in sorted(os.listdir(os.path.join(AV, 'unify', sid))):
            if not f.endswith('.png'): continue
            u, o, ph = os.path.join(AV, 'unify', sid, f), os.path.join(AV, 'sets', sid, f), os.path.join(AV, 'sheets', f)
            (so, lo), (su, lu) = score(o), score(u)
            R, _ = cell_masks(ph); O, go = cell_masks(o); U, gu = cell_masks(u)
            if len(U) != len(R): print(f'{sid}/{f}: 统一版切出 {len(U)} 格，跳过'); continue
            io, iu = ious(R, O), ious(R, U); worst = min(b - a for a, b in zip(io, iu))
            ok = su < so and worst > -0.04 and gu >= 0.8 * go
            print(f'{sid:8s} {f:14s} 直方图差 {so:.3f}→{su:.3f}  亮度抖动 {lo:.2f}→{lu:.2f}  姿势 IoU 最差变化 {worst:+.3f}  绿棍 {go}→{gu}  {"采用" if ok else "不用"}')
            if ok: picked.append((sid, f))
            if ok and apply:
                bk = os.path.join(AV, 'sets', sid, '_pre'); os.makedirs(bk, exist_ok=True)
                if not os.path.exists(os.path.join(bk, f)): shutil.copy(o, os.path.join(bk, f))
                shutil.copy(u, o)
    print('采用', len(picked), '张：', ' '.join(f'{s}/{f[:-4]}' for s, f in picked))

if __name__ == '__main__':
    main()
