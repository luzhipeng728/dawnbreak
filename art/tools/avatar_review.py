#!/usr/bin/env python3
"""外观与换装：时装表批量自查。每个职业一张总览（左：占位表 / 原表，右：时装表），逐张看武器有没有丢、姿势和衣服对不对。
  avatar_review.py <套装id>   → 主仓库 art/src/avatar/cut/review_<套装>_<职业>.png
"""
import os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from avatar_gen import source_sheets, OUT

def main():
    sid = sys.argv[1]; src = source_sheets()
    for cls in ('sword', 'gun', 'mage'):
        names = sorted(n for n in src if n.startswith(cls + '_') and os.path.exists(os.path.join(OUT, 'sets', sid, f'{n}.png')))
        if not names: continue
        cw, chh = 1000, 500; per = 2; rows = (len(names) + per - 1) // per
        M = Image.new('RGB', (cw * per, (chh + 24) * rows), (40, 40, 40)); d = ImageDraw.Draw(M)
        for i, n in enumerate(names):
            a = os.path.join(OUT, 'sheets', f'{n}.png'); a = a if os.path.exists(a) else src[n]
            A = Image.open(a).convert('RGB').resize((chh, chh)); B = Image.open(os.path.join(OUT, 'sets', sid, f'{n}.png')).convert('RGB').resize((chh, chh))
            x, y = (i % per) * cw, (i // per) * (chh + 24)
            M.paste(A, (x, y + 24)); M.paste(B, (x + chh, y + 24)); d.text((x + 6, y + 4), n, fill=(255, 220, 120))
        out = os.path.join(OUT, 'cut', f'review_{sid}_{cls}.png'); M.save(out); print(out, M.size)

if __name__ == '__main__':
    main()
