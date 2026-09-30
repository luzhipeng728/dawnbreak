#!/usr/bin/env python3
"""街霸图标审图：把新切的 fb_* 图标和对照图标（散打 fs_* / 现有图标）并排拼成一张（每行上面是 fb、下面是对照），给主线程一次看完。
  python3 art/tools/fighter_brawler_cmp.py <输出.jpg> [对照图标目录] [fb 前缀过滤]
"""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
ref_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'final', 'icon')
only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
fb = sorted(glob.glob(os.path.join(HERE, 'final', 'icon', 'fb_*.webp')))
if only: fb = [f for f in fb if os.path.basename(f)[:-5] in only]
ref = sorted(glob.glob(os.path.join(ref_dir, 'fs_*.webp'))) or sorted(glob.glob(os.path.join(ref_dir, 'bm_*.webp')))
cell, cols = 96, 10
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 11)
rows_fb = (len(fb) + cols - 1) // cols
rows_ref = min(2, (len(ref) + cols - 1) // cols)
H = 30 + (rows_fb + rows_ref) * (cell + 16) + 24
W = Image.new('RGB', (cols * cell + 20, H), (40, 44, 52)); d = ImageDraw.Draw(W)
big = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 16)
d.text((10, 6), f'街霸 fb_*（{len(fb)} 个）', fill=(255, 220, 140), font=big)
y = 30
def put(files, y0):
    for i, f in enumerate(files):
        x, yy = 10 + (i % cols) * cell, y0 + (i // cols) * (cell + 16)
        im = Image.open(f).convert('RGBA').resize((cell - 8, cell - 8)); W.paste(im, (x + 4, yy), im)
        d.text((x + 4, yy + cell - 6), os.path.basename(f)[:-5], fill=(220, 220, 220), font=font)
put(fb, y)
y2 = y + rows_fb * (cell + 16) + 4
d.text((10, y2 - 2), '对照：' + os.path.basename(ref[0])[:3] + '*', fill=(160, 220, 255), font=big)
put(ref[:rows_ref * cols], y2 + 22)
W.save(out, quality=88); print(out, W.size)
