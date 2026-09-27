#!/usr/bin/env python3
"""美术素材预处理：白底去背（带抗锯齿去白边）、部件拆分、背景图层裁切。只依赖 numpy + Pillow。

用法：
  prep.py cut  SHEET.png OUTDIR            # 去背 + 按连通块拆成 part_XX.png，并出一张带编号的预览
  prep.py rmbg IN.png OUT.png [--crop]     # 只去背
  prep.py far  IN.png OUT.webp --w 2400 --anchor 0.78 --h 760   # 远景：缩放后以 anchor 行为地平线截取
  prep.py floor IN.png OUT.webp --w 3400 --h 470 --y 0.5        # 地面：按宽度缩放后取中间一条
  prep.py edge IN.png OUT.webp --w 3400                          # 交界带：去背后按宽度缩放、裁到内容
"""
import sys, json, argparse
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def near_white(a, tol=22):
    rgb = a[..., :3].astype(np.int16)
    mn, mx = rgb.min(-1), rgb.max(-1)
    return (mn >= 255 - tol) & (mx - mn <= 14)

def dilate(m):
    o = m.copy()
    o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    return o

def flood_bg(W, f=4):
    """W：近白色掩码。返回与图像边缘连通的背景区域（先在 1/f 分辨率泛洪，再回到全分辨率细化）。"""
    h, w = W.shape
    hs, ws = h // f, w // f
    Ws = W[:hs * f, :ws * f].reshape(hs, f, ws, f).all(axis=(1, 3))
    seen = np.zeros_like(Ws)
    dq = deque()
    for x in range(ws):
        for y in (0, hs - 1):
            if Ws[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    for y in range(hs):
        for x in (0, ws - 1):
            if Ws[y, x] and not seen[y, x]: seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < hs and 0 <= nx < ws and Ws[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    B = np.zeros_like(W)
    B[:hs * f, :ws * f] = np.repeat(np.repeat(seen, f, 0), f, 1)
    B &= W
    for _ in range(f * 2):          # 在全分辨率里把背景推到真正的边缘
        B2 = dilate(B) & W
        if (B2 == B).all(): break
        B = B2
    return B

def remove_bg(im, tol=22):
    a = np.array(im.convert('RGBA')).astype(np.float32)
    W = near_white(a.astype(np.uint8), tol)
    B = flood_bg(W)
    alpha = np.where(B, 0.0, 1.0)
    # 边缘两像素内：按“离白色的距离”估算半透明度，并把白色从颜色里减掉（去白边）
    band = dilate(dilate(B)) & ~B
    mn = a[..., :3].min(-1)
    ea = np.clip((255 - mn) / 150.0, 0, 1)
    alpha = np.where(band, ea, alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(band[..., None], np.clip((a[..., :3] - (1 - alpha[..., None]) * 255) / safe, 0, 255), a[..., :3])
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def components(alpha, f=4, min_cells=12):
    h, w = alpha.shape
    hs, ws = h // f, w // f
    M = (alpha[:hs * f, :ws * f] > 40).reshape(hs, f, ws, f).any(axis=(1, 3))
    lab = np.zeros((hs, ws), np.int32); n = 0; comps = []
    for y0 in range(hs):
        for x0 in range(ws):
            if M[y0, x0] and not lab[y0, x0]:
                n += 1; lab[y0, x0] = n; dq = deque([(y0, x0)]); cells = 0
                while dq:
                    y, x = dq.popleft(); cells += 1
                    for ny in (y - 1, y, y + 1):
                        for nx in (x - 1, x, x + 1):
                            if 0 <= ny < hs and 0 <= nx < ws and M[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; dq.append((ny, nx))
                comps.append((n, cells))
    full = np.zeros((h, w), np.int32)
    full[:hs * f, :ws * f] = np.repeat(np.repeat(lab, f, 0), f, 1)
    return full, [c for c in comps if c[1] >= min_cells]

def cmd_cut(a):
    im = remove_bg(Image.open(a.sheet), a.tol)
    arr = np.array(im)
    lab, comps = components(arr[..., 3])
    import os; os.makedirs(a.out, exist_ok=True)
    prev = Image.new('RGB', im.size, (60, 64, 72)); prev.paste(im, (0, 0), im)
    d = ImageDraw.Draw(prev)
    try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 56)
    except Exception: font = ImageFont.load_default()
    info = []
    comps.sort(key=lambda c: -c[1])
    for i, (n, cells) in enumerate(comps):
        ys, xs = np.where(lab == n)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = arr[y0:y1, x0:x1].copy()
        crop[..., 3] = np.where(lab[y0:y1, x0:x1] == n, crop[..., 3], 0)
        bb = Image.fromarray(crop, 'RGBA').getbbox()
        part = Image.fromarray(crop, 'RGBA').crop(bb)
        part.save(f'{a.out}/part_{i:02d}.png')
        info.append({'i': i, 'x': int(x0 + bb[0]), 'y': int(y0 + bb[1]), 'w': part.width, 'h': part.height})
        d.rectangle([x0, y0, x1, y1], outline=(255, 220, 60), width=3)
        d.text((x0 + 6, y0 + 4), str(i), fill=(255, 60, 60), font=font, stroke_width=4, stroke_fill=(0, 0, 0))
    prev.thumbnail((1400, 1400)); prev.save(f'{a.out}/_preview.png')
    json.dump(info, open(f'{a.out}/_parts.json', 'w'), indent=1)
    print(json.dumps(info))

def fill_holes(im, min_area=120, thr=247):
    """去掉被主体包围的纯白小块（例如手臂和身体之间露出的白底）。"""
    a = np.array(im); W = (a[..., :3].min(-1) >= thr) & (a[..., 3] > 0)
    h, w = W.shape; f = 2; hs, ws = h // f, w // f
    M = W[:hs * f, :ws * f].reshape(hs, f, ws, f).all(axis=(1, 3))
    lab = np.zeros((hs, ws), np.int32); n = 0
    for y0 in range(hs):
        for x0 in range(ws):
            if M[y0, x0] and not lab[y0, x0]:
                n += 1; lab[y0, x0] = n; dq = deque([(y0, x0)]); cells = []
                while dq:
                    y, x = dq.popleft(); cells.append((y, x))
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < hs and 0 <= nx < ws and M[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; dq.append((ny, nx))
                if len(cells) * f * f >= min_area:
                    for y, x in cells: a[y * f:(y + 1) * f, x * f:(x + 1) * f, 3] = 0
    # 洞的边缘：抗锯齿留下的浅色像素向外扩几圈一起去掉
    hole = a[..., 3] == 0
    light = a[..., :3].min(-1) >= 215
    for _ in range(3):
        grow = dilate(hole) & light & ~hole & (a[..., 3] > 0)
        if not grow.any(): break
        a[..., 3] = np.where(grow, 0, a[..., 3]); hole = hole | grow
    return Image.fromarray(a, 'RGBA')

def cmd_rmbg(a):
    im = remove_bg(Image.open(a.inp), a.tol)
    if a.holes: im = fill_holes(im)
    if a.crop: im = im.crop(im.getbbox())
    im.save(a.out)

def save_webp(im, out, q=82):
    im.save(out, 'WEBP', quality=q, method=6)

def cmd_far(a):
    im = Image.open(a.inp).convert('RGB')
    s = a.w / im.width; im = im.resize((a.w, round(im.height * s)), Image.LANCZOS)
    y1 = round(im.height * a.anchor); y0 = max(0, y1 - a.h)
    save_webp(im.crop((0, y0, a.w, y0 + a.h)), a.out, a.q)

def cmd_floor(a):
    im = Image.open(a.inp).convert('RGB')
    s = a.w / im.width; im = im.resize((a.w, round(im.height * s)), Image.LANCZOS)
    y0 = round((im.height - a.h) * a.y)
    save_webp(im.crop((0, y0, a.w, y0 + a.h)), a.out, a.q)

def cmd_edge(a):
    im = remove_bg(Image.open(a.inp), a.tol)
    s = a.w / im.width; im = im.resize((a.w, round(im.height * s)), Image.LANCZOS)
    bb = im.getbbox(); im = im.crop((0, bb[1], a.w, bb[3]))
    save_webp(im, a.out, a.q)

def main():
    p = argparse.ArgumentParser(); sp = p.add_subparsers(dest='cmd', required=True)
    c = sp.add_parser('cut'); c.add_argument('sheet'); c.add_argument('out'); c.add_argument('--tol', type=int, default=22); c.set_defaults(fn=cmd_cut)
    r = sp.add_parser('rmbg'); r.add_argument('inp'); r.add_argument('out'); r.add_argument('--crop', action='store_true'); r.add_argument('--holes', action='store_true'); r.add_argument('--tol', type=int, default=22); r.set_defaults(fn=cmd_rmbg)
    for name, fn in (('far', cmd_far), ('floor', cmd_floor), ('edge', cmd_edge)):
        q = sp.add_parser(name); q.add_argument('inp'); q.add_argument('out'); q.add_argument('--w', type=int, default=2400); q.add_argument('--h', type=int, default=760)
        q.add_argument('--anchor', type=float, default=0.8); q.add_argument('--y', type=float, default=0.5); q.add_argument('--q', type=int, default=80); q.add_argument('--tol', type=int, default=22); q.set_defaults(fn=fn)
    a = p.parse_args(); a.fn(a)

if __name__ == '__main__':
    main()
