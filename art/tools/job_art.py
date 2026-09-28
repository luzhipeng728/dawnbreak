# 转职立绘：把 AI 生成的白底原图（art/src/quests/job_<jobId>.png）去背、裁边、缩放，
# 输出 art/final/job/<jobId>.webp（战斗组在 CLASSES[cls].jobs[id].art 里填 'job/<jobId>'）
# 用法：python3 art/tools/job_art.py [原图目录]
import os, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'art', 'src', 'quests')
OUT = os.path.join(ROOT, 'art', 'final', 'job')
JOBS = ['blade', 'berserker', 'ranger', 'launcher', 'elemental', 'battlemage']
try:   # 鬼剑士新转职（art/tools/sword_art.py 的 JOBART）
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from sword_art import JOBART as _SJ; JOBS += [j for j in _SJ if j not in JOBS]
except ImportError: pass
MAX_H = 900
HOLES = {'berserker'}   # 披风破洞里有被包住的大块白底，需要额外清掉

def clear_holes(im, min_area=500):
    """把被角色包住的大块纯白区域（面积 ≥ min_area）也变透明"""
    w, h = im.size; px = im.load(); seen = bytearray(w * h)
    white = lambda p: p[3] > 0 and p[0] >= 248 and p[1] >= 248 and p[2] >= 248
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or not white(px[x0, y0]): continue
            stack, comp = [(x0, y0)], []; seen[i0] = 1
            while stack:
                x, y = stack.pop(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and white(px[nx, ny]): seen[ny * w + nx] = 1; stack.append((nx, ny))
            if len(comp) >= min_area:
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
    return im

def cutout(im, holes=False):
    """从四条边上所有接近白色的像素开始 flood-fill，把背景变透明（被角色包住的白色不受影响）"""
    im = im.convert('RGBA'); w, h = im.size
    key = (255, 0, 255, 255)   # 临时标记色
    px = im.load()
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] + [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    for s in seeds:
        r, g, b, a = px[s]
        if r > 235 and g > 235 and b > 235: ImageDraw.floodfill(im, s, key, thresh=40)
    im.putdata([(0, 0, 0, 0) if p == key else p for p in im.get_flattened_data()] if hasattr(im, 'get_flattened_data') else [(0, 0, 0, 0) if p == key else p for p in im.getdata()])
    if holes: clear_holes(im)
    # 边缘柔化：alpha 通道轻微收缩再模糊，去掉白边
    a = im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(a)
    return im.crop(im.getbbox())

os.makedirs(OUT, exist_ok=True)
for j in JOBS:
    p = os.path.join(SRC, f'job_{j}.png')
    if not os.path.exists(p): print('缺少', p); continue
    im = cutout(Image.open(p), j in HOLES)
    if im.height > MAX_H: im = im.resize((round(im.width * MAX_H / im.height), MAX_H), Image.LANCZOS)
    out = os.path.join(OUT, j + '.webp'); im.save(out, 'WEBP', quality=86, method=6)
    print(j, im.size, os.path.getsize(out) // 1024, 'KB')
