#!/usr/bin/env python3
"""魔法师动作表的占位色自查：每格里“像占位棍的纯绿”和“像杖头标记的品红”各有多少像素（切帧工具会把它们当武器抠掉）。
  marker_check.py <表名> [格子...]   例：marker_check.py mage_witch2 7
检查原表（art/src/combat/sheets/）和 6 套时装（art/src/avatar/sets/<套装>/）。数值 > 300 左右就要当心（普通格子通常在 0～500 之间，来自紫色饰品）。
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from avatar_frames import key_maps
from prep import remove_bg
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SETS = ['sky1', 'summer', 'sky2', 'academy', 'spring', 'festival']

def main():
    name = sys.argv[1]; cells = [int(c) for c in sys.argv[2:]] or list(range(1, 9))
    P = {'base': os.path.join(MAIN, 'src', 'combat', 'sheets', f'{name}.png')}
    for s in SETS: P[s] = os.path.join(MAIN, 'src', 'avatar', 'sets', s, f'{name}.png')
    for k, p in P.items():
        if not os.path.exists(p): print(k, '缺'); continue
        im = np.array(remove_bg(Image.open(p)).convert('RGBA')); g, m = key_maps(im); H, W = g.shape
        sub = lambda a, c: a[(c // 3) * H // 3:(c // 3 + 1) * H // 3, (c % 3) * W // 3:(c % 3 + 1) * W // 3]
        print(f'{k:9s}', ' '.join(f'{c}:绿{int((sub(g, c) > 0.3).sum())}/品红{int((sub(m, c) > 0.3).sum())}' for c in cells))

if __name__ == '__main__':
    main()
