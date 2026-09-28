#!/usr/bin/env python3
"""外观与换装：混搭时装用的分割线（每帧），写进原装 spr.json 的 F.cut。
  avatar_cuts.py [职业...] [--preview]
混搭 = 上身（头 + 躯干 + 手臂）用上衣那套、下身用下装那套、脚用鞋那套的帧，按两条分割线拼起来：
  腰线（上衣 / 下装）、脚踝线（下装 / 鞋）。两条线都垂直于“身体轴”（头部锚点 → 脚底）。
  cut = { a 身体轴的倾角（弧度，0 = 竖直向下，正 = 脚在头的右边）, wx, wy 腰线上的一点（原装帧像素）, kd 脚踝线到腰线沿身体轴的距离 }
位置按身体轴上的比例定（在站姿上量的：腰带、鞋口的位置），每个职业一组比例（原装魔法师 / 神枪手的头部锚点含帽子，所以比例不同）。
不可靠的帧不写 cut（运行时这一帧整套用件数最多的那套）：
  - 身体轴倾斜超过 35°（躺地、浮空翻滚、翻滚、飞扑）；
  - 头部锚点到脚底的距离不到站姿的 45%（缩成一团）。
各套时装的帧都已经按脚底锚点对齐到原装同名帧（avatar_align.py），所以原装帧上的分割线换算到各套帧里是同一条。
"""
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
# 腰线、脚踝线在“头部锚点 → 脚底”上的比例（原装站姿上量的）
FRAC = {'sword': (0.48, 0.86), 'gun': (0.47, 0.86), 'mage': (0.52, 0.87)}
# 踢腿帧（腿抬过腰线）：水平分割会把踢起来的腿算进上身
#   （踢腿帧照样分割：踢起来的腿会用上衣那套的腿，只差一截腿；整帧换成另一套衣服在连招里闪一下更难看）
MAX_TILT = math.radians(35); MIN_LEN = 0.45; SNAP = math.radians(15); FAR_MIN = 0.75

def bottom_point(a, ax):
    """脚底：最下面一行不透明像素里、离锚点 x 最近的一段的中点"""
    m = a[..., 3] > 60; ys = np.where(m.any(1))[0]
    if not len(ys): return None
    y = ys.max(); xs = np.where(m[max(0, y - 3):y + 1].any(0))[0]
    return float(xs[np.argmin(np.abs(xs - ax))]) if len(xs) else ax, float(y)

def far_point(a, hx, hy):
    """轮廓上离头部锚点最远的点（躺地、浮空、飞扑时 = 脚）"""
    m = a[..., 3] > 60; ys, xs = np.where(m)
    if not len(xs): return None
    i = int(np.argmax((xs - hx) ** 2 + (ys - hy) ** 2)); return float(xs[i]), float(ys[i])

def cuts_for(cls):
    d = os.path.join(HERE, 'final', 'spr', cls); meta = json.load(open(os.path.join(d, 'spr.json'))); Fs = meta['frames']
    fw, fk = FRAC[cls]
    img = lambda f: np.array(Image.open(os.path.join(d, f + '.webp')).convert('RGBA'))
    H0 = Fs['idle']['head']; b0 = bottom_point(img('idle'), Fs['idle']['ax']); L0 = math.hypot(Fs['idle']['ax'] - H0['x'], b0[1] - H0['y'])
    out, skip, far = {}, [], []
    for f in Fs:
        F = Fs[f]; H = F.get('head'); Fs[f].pop('cut', None)
        if not H: skip.append(f); continue
        a = img(f); bp = bottom_point(a, F['ax'])
        hx, hy = H['x'], H['y']; bx, by = F['ax'], bp[1]   # 脚底取锚点的 x（两脚中间 / 躯干中线）+ 最低的不透明像素：跨步时轴不会歪到后脚
        L = math.hypot(bx - hx, by - hy); ang = math.atan2(bx - hx, by - hy)
        if abs(ang) > MAX_TILT or L < MIN_LEN * L0 or by < hy:
            # 身体斜着 / 躺着 / 倒立：身体轴改成“头 → 离头最远的点（脚）”；身体伸得不够开（缩成球）就算不可靠
            fp = far_point(a, hx, hy); L = math.hypot(fp[0] - hx, fp[1] - hy)
            if L < FAR_MIN * L0: skip.append(f); continue
            ang = math.atan2(fp[0] - hx, fp[1] - hy); far.append(f)
        elif abs(ang) < SNAP: ang = 0.0   # 基本直立：线就是水平的（跨步、出招时身体轴的小角度多半是头往前探，不是身体真的斜了）
        ux, uy = math.sin(ang), math.cos(ang)
        wx, wy = hx + ux * L * fw, hy + uy * L * fw
        Fs[f]['cut'] = {'a': round(ang, 3), 'wx': round(wx, 1), 'wy': round(wy, 1), 'kd': round(L * (fk - fw), 1)}
        out[f] = Fs[f]['cut']
    json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'), indent=1)
    return out, skip, far

def preview(cls, cuts):
    d = os.path.join(HERE, 'final', 'spr', cls); tiles = []
    for f, c in cuts.items():
        im = Image.open(os.path.join(d, f + '.webp')).convert('RGBA'); bg = Image.new('RGBA', (im.width + 20, im.height + 20), (60, 64, 74, 255)); bg.alpha_composite(im, (10, 10))
        dr = ImageDraw.Draw(bg); ux, uy = math.sin(c['a']), math.cos(c['a']); px, py = -uy, ux
        for (x, y, col) in [(c['wx'], c['wy'], (255, 220, 0)), (c['wx'] + ux * c['kd'], c['wy'] + uy * c['kd'], (0, 230, 255))]:
            dr.line([x + 10 - px * 80, y + 10 - py * 80, x + 10 + px * 80, y + 10 + py * 80], fill=col, width=2)
        dr.text((2, 2), f, fill=(255, 255, 255)); tiles.append(bg)
    per = 10; cw = max(t.width for t in tiles); ch = max(t.height for t in tiles); nr = (len(tiles) + per - 1) // per
    M = Image.new('RGBA', (cw * per, ch * nr), (40, 40, 40, 255))
    for i, t in enumerate(tiles): M.alpha_composite(t, ((i % per) * cw, (i // per) * ch))
    p = os.path.join(MAIN, 'src', 'avatar', 'cut', f'cuts_{cls}.png'); M.save(p); return p

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')] or ['sword', 'gun', 'mage']
    for cls in args:
        cuts, skip, far = cuts_for(cls)
        print(f'{cls}: {len(cuts)} 帧有分割线（其中 {len(far)} 帧身体斜 / 躺，按“头 → 最远点”定轴：{" ".join(far)}）；不可靠（整套用件数最多的那套）{len(skip)} 帧 {" ".join(skip)}')
        if '--preview' in sys.argv: print('  预览', preview(cls, cuts))

if __name__ == '__main__':
    main()
