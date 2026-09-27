#!/usr/bin/env python3
"""外观与换装：原表 / 改图后的表并排缩小，方便逐张检查武器有没有丢、姿势有没有变。
  avatar_compare.py <表名...>        → 主仓库 art/src/avatar/cut/cmp_<表>.png
  avatar_compare.py --set festival <表名...>   对比占位表和时装表
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from avatar_gen import source_sheets, OUT

def main():
    args = sys.argv[1:]; sid = ''
    if args and args[0] == '--set': sid = args[1]; args = args[2:]
    src = source_sheets(); os.makedirs(os.path.join(OUT, 'cut'), exist_ok=True)
    for name in args:
        a = os.path.join(OUT, 'sheets', f'{name}.png') if sid else src[name]
        b = os.path.join(OUT, 'sets', sid, f'{name}.png') if sid else os.path.join(OUT, 'sheets', f'{name}.png')
        if not os.path.exists(b): print('缺', b); continue
        A = Image.open(a).convert('RGB').resize((900, 900)); B = Image.open(b).convert('RGB').resize((900, 900))
        M = Image.new('RGB', (1810, 900), (40, 40, 40)); M.paste(A, (0, 0)); M.paste(B, (910, 0))
        out = os.path.join(OUT, 'cut', f'cmp_{sid + "_" if sid else ""}{name}.png'); M.save(out); print(out)

if __name__ == '__main__':
    main()
