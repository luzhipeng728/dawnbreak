#!/usr/bin/env python3
"""动作表单格返修：从 3×3 动作表里裁出第 i 格 → gpt-image edit → 把修好的主体缩放到和原格主体一样高、脚底中心对齐，贴回去
（原表先备份到 sheets2/_pre/，每次都从备份重做，已经修过的格子一并贴回）→ 之后重新切帧。
  witch_cellfix.py <表 png> <格号 0-8> "<修改说明>"     修好的单格缓存为 _pre/<表>_c<i>_fix.png，已存在就不再调用生图
"""
import os, sys, shutil, subprocess, time, glob, re
import numpy as np
from PIL import Image
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
KEEP = ' Keep everything else exactly the same: same character, same pose, same colors, same outlines, same size and position in the frame. Plain pure white background, no text.'

def bbox(im):
    a = np.array(im.convert('RGB')).astype(int); m = (a.min(-1) < 235); ys, xs = np.where(m)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else (0, 0, im.width, im.height)

def main():
    path, i, what = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    d = os.path.dirname(path) or '.'; pre = os.path.join(d, '_pre'); os.makedirs(pre, exist_ok=True); name = os.path.basename(path)
    b = os.path.join(pre, name)
    if not os.path.exists(b): shutil.copy(path, b)
    orig = Image.open(b).convert('RGB'); W, H = orig.size; cw, ch = W // 3, H // 3
    box = lambda j: ((j % 3) * cw, (j // 3) * ch, (j % 3 + 1) * cw, (j // 3 + 1) * ch)
    cell = os.path.join(pre, name.replace('.png', f'_c{i}.png')); fixed = cell.replace('.png', '_fix.png')
    orig.crop(box(i)).save(cell)
    if not os.path.exists(fixed):
        for attempt in range(6):
            r = subprocess.run(['python3', GI, 'edit', 'Edit this image: ' + what + KEEP, '-i', cell, '-o', fixed, '-s', '1024x1024', '-q', 'high'], capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(fixed): break
            err = (r.stderr + r.stdout)[-200:]; print('retry', err); time.sleep(65 if '429' in err else 10)
    if not os.path.exists(fixed): raise SystemExit('edit failed')
    out = orig.copy()
    for f in sorted(glob.glob(os.path.join(pre, name.replace('.png', '_c*_fix.png')))):
        j = int(re.search(r'_c(\d)_fix', f).group(1)); c0 = orig.crop(box(j)); ob = bbox(c0)
        fx = Image.open(f).convert('RGB'); fb = bbox(fx); sub = fx.crop(fb)
        k = (ob[3] - ob[1]) / sub.height; sub = sub.resize((max(1, round(sub.width * k)), max(1, round(sub.height * k))), Image.LANCZOS)
        cell_new = Image.new('RGB', c0.size, (255, 255, 255)); cx = (ob[0] + ob[2]) / 2
        cell_new.paste(sub, (round(cx - sub.width / 2), ob[3] - sub.height)); out.paste(cell_new, box(j)[:2]); print('paste', j, 'scale', round(k, 3))
    out.save(path); print('ok', path)

if __name__ == '__main__':
    main()
