#!/usr/bin/env python3
"""外观与换装：头部配件表（帽子、发饰、眼镜，一行 3 个）→ art/final/avatar/<套装>_<部位>.webp
  avatar_acc.py [套装...]
原图在主仓库 art/src/avatar/acc/<套装>.png（avatar_gen.py acc 生成）。按宽度缩放保存（比游戏里画的大 1.25 倍），
在头上的位置 / 缩放写在 src/content/avatar/looks.js 的 AVATAR_ACC。
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components
from avatar_gen import ACC, OUT
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = {'hat': 78, 'hair': 44, 'face': 44}   # 在角色帧里的宽度（帧像素）
WIDTH_SET = {'spring': {'hat': 96, 'hair': 40}, 'sky1': {'hat': 80, 'hair': 42}, 'summer': {'hat': 100, 'hair': 40}, 'sky2': {'hat': 80, 'hair': 34}, 'academy': {'hat': 74, 'hair': 44}}   # 个别套装的配件更大 / 更小
OVER = 1.25

def main():
    sets = sys.argv[1:] or list(ACC)
    outd = os.path.join(HERE, 'final', 'avatar'); os.makedirs(outd, exist_ok=True)
    for sid in sets:
        path = os.path.join(OUT, 'acc', f'{sid}.png'); items = ACC[sid]
        a = np.array(remove_bg(Image.open(path)))
        lab, comps = components(a[..., 3], min_cells=6)
        boxes = []
        for c, cells in comps:
            ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'x0': xs.min(), 'x1': xs.max() + 1, 'y0': ys.min(), 'y1': ys.max() + 1, 'cells': cells})
        # 按横向位置分组：一行里从左到右摆着 N 件，同一件可能是好几块（一对龙角、光环和小翅膀），组间空隙最大的 N-1 处断开
        boxes = [b for b in boxes if b['cells'] >= 40]
        boxes.sort(key=lambda b: b['x0'])
        groups = [[boxes[0]]]; ends = [boxes[0]['x1']]
        for b in boxes[1:]:
            if b['x0'] < ends[-1] + 20: groups[-1].append(b); ends[-1] = max(ends[-1], b['x1'])
            else: groups.append([b]); ends.append(b['x1'])
        while len(groups) > len(items):   # 合并最近的两组
            gaps = [groups[i + 1][0]['x0'] - ends[i] for i in range(len(groups) - 1)]; i = int(np.argmin(gaps))
            groups[i] += groups.pop(i + 1); ends[i] = max(ends[i], ends.pop(i + 1))
        big = [{'ids': [c for b in g for c in b['ids']], 'x0': min(b['x0'] for b in g), 'x1': max(b['x1'] for b in g),
                'y0': min(b['y0'] for b in g), 'y1': max(b['y1'] for b in g)} for g in groups]
        if len(big) != len(items): print(f'{sid}: 切出 {len(big)} 件，应为 {len(items)}  <-- CHECK')
        for (part, _), b in zip(items, big):
            sub = a[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
            im = Image.fromarray(sub, 'RGBA'); k = WIDTH_SET.get(sid, {}).get(part, WIDTH[part]) * OVER / im.width
            sm = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            sm.save(os.path.join(outd, f'{sid}_{part}.webp'), 'WEBP', quality=88, method=6)
            print(f'  {sid}_{part}: {sm.width}x{sm.height}')

if __name__ == '__main__':
    main()
