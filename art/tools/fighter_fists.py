#!/usr/bin/env python3
"""格斗家（男）缺的拳头锚点（B2，拳上武器 cover 用）：原装帧里只有一只拳有锚点、另一只拳其实露在外面（走路护在下巴前的后手、跑步往后甩的手、刺拳的后手…）
  fighter_fists.py find [帧,...]      按绑带颜色找另一只拳 → 预览 art/work/fighter_b2/fists_find.jpg（人工看，挑对的写进 ACCEPT）
  fighter_fists.py apply              把 ACCEPT 里的帧写进 art/final/spr/fighter/spr.json（side = 缺的那一侧，auto: 3，没有握拳轮廓，远侧拳按拳心一圈裁）
  fighter_fists.py hints              把 HINTS 里的提示点吸到绑带色的拳头质心上，写成另一只拳的锚点（auto: 4）
做法：绑带色（fighter_art.BANDAGE）去掉已有拳头一圈、头一圈、腰线以下（绑腿）→ 连通块 → 离肩膀最远的那一截 = 拳头（质心 = 握点），
  块的质心 → 拳头 = 前臂方向。ACCEPT 里可以写 (dx, dy) 微调握点。时装帧的锚点从原装平移（fighter_looks_art.py frames 重跑）。
"""
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
import fighter_art as FA
from prep import components

SPR = FA.SPR
WORK = os.path.join(FA.HERE, 'work', 'fighter_b2')
ACCEPT = {   # 帧 → (dx, dy[, ang]) 握点微调 / 指定方向（逐帧看过 fists_find.jpg；run5 / run8 / jump1 找到的是前臂，不收）
    **{f'walk{i}': (0, 0) for i in range(1, 9)},   # 走路：护在下巴前的后手
    'run3': (0, 0), 'run4': (0, 0), 'run7': (0, 0),   # 跑步：往后甩的手
    'f_jab1': (0, 0), 'f_jab2': (-39, 25, -1.3),   # 刺拳的后手（f_jab2 找到的是出拳那只的前臂，挪到胸前的后手、拳面朝上）
    'fs_elbow': (0, 0),   # 肘击突进：B1 没有锚点，前面那只拳
}

def hsv(a):
    rgb = a[..., :3].astype(np.float32) / 255; mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; h = np.zeros_like(mx); nz = d > 1e-6
    h = np.where(nz & (mx == r), ((g - b) / np.maximum(d, 1e-6)) % 6, h); h = np.where(nz & (mx == g), (b - r) / np.maximum(d, 1e-6) + 2, h); h = np.where(nz & (mx == b), (r - g) / np.maximum(d, 1e-6) + 4, h)
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx

def find(f, F):
    a = np.array(Image.open(os.path.join(SPR, f + '.webp')).convert('RGBA')); H, W = a.shape[:2]
    h, s, v = hsv(a); B = FA.BANDAGE
    m = (a[..., 3] > 200) & (h >= B['h'][0]) & (h <= B['h'][1]) & (s >= B['s'][0]) & (s <= B['s'][1]) & (v >= B['v'][0])
    yy, xx = np.mgrid[0:H, 0:W]
    have = [F[k] for k in ('wpn', 'wpn2') if k in F]
    for w in have: m &= (xx - w['gx']) ** 2 + (yy - w['gy']) ** 2 > 16 ** 2
    hd = F.get('head')
    if hd: m &= (xx - hd['x']) ** 2 + (yy - hd['y']) ** 2 > 44 ** 2
    if F.get('cut'): m &= yy < F['cut']['wy'] + 6
    lab, comps = components((m * 255).astype(np.uint8), f=1, min_cells=40)
    if not comps: return None
    c, n = max(comps, key=lambda t: t[1]); ys, xs = np.where(lab == c)
    sh = (hd['x'] - 6, hd['y'] + 52) if hd else (F['ax'], F['ay'] - F['h'] * 0.55)
    dist = np.hypot(xs - sh[0], ys - sh[1]); far = dist >= np.percentile(dist, 72)
    gx, gy = float(xs[far].mean()), float(ys[far].mean()); cx, cy = float(xs.mean()), float(ys.mean())
    ang = math.atan2(gy - cy, gx - cx) if math.hypot(gx - cx, gy - cy) > 2 else (have[0]['ang'] if have else -0.7)
    side = 'f' if any(w.get('side') == 'n' for w in have) else 'n'
    return {'gx': round(gx, 1), 'gy': round(gy, 1), 'ang': round(ang, 3), 'len': 24.0, 'bk': 0.0, 'front': 1, 'side': side, 'auto': 3, 'n': int(n)}

def cmd_find(names):
    meta = json.load(open(os.path.join(SPR, 'spr.json')))['frames']
    names = names or [f for f, F in meta.items() if len([k for k in ('wpn', 'wpn2') if k in F]) < 2]
    font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 13); Z = int(os.environ.get('Z', 2)); per = int(os.environ.get('PER', 6)); cw, ch = 200 * Z, 240 * Z
    out = Image.new('RGB', (cw * per, ch * ((len(names) + per - 1) // per)), (70, 74, 84)); d = ImageDraw.Draw(out); res = {}
    for i, f in enumerate(names):
        F = meta[f]; r = find(f, F); res[f] = r
        im = Image.open(os.path.join(SPR, f + '.webp')).convert('RGBA'); im = im.resize((im.width * Z, im.height * Z), Image.LANCZOS)
        ox, oy = (i % per) * cw + 10, (i // per) * ch + 22; out.paste(im, (ox, oy), im)
        for w, col in [(F.get('wpn'), (255, 60, 60)), (F.get('wpn2'), (80, 200, 255)), (r, (0, 255, 0))]:
            if not w: continue
            x, y = ox + w['gx'] * Z, oy + w['gy'] * Z; d.ellipse([x - 26, y - 26, x + 26, y + 26], outline=col, width=2); d.line([x, y, x + math.cos(w['ang']) * 40, y + math.sin(w['ang']) * 40], fill=col, width=3)
        d.text(((i % per) * cw + 12, (i // per) * ch + 3), f'{f} {"→ " + r["side"] if r else "（没找到）"}', fill=(255, 230, 120), font=font)
    os.makedirs(WORK, exist_ok=True); out.save(os.path.join(WORK, 'fists_find.jpg'), quality=84); print(os.path.join(WORK, 'fists_find.jpg'))
    return res

HINTS = {   # 帧 → 另一只拳的大概位置（帧像素，逐帧放大 4 倍看过：护在胸前 / 往后甩、露在外面的那只拳；B2 手套“双手”修复，2026-09-30）
    'f_axe1': (77, 104), 'f_flykick': (90, 86), 'f_low1': (70, 105), 'f_low2': (65, 105), 'f_mid1': (69, 102), 'f_high1': (87, 106), 'fs_kneekick': (65, 87),
    'run5': (45, 112), 'run8': (32, 105), 'tech': (90, 111),
}

def snap(a, x, y, r=11):
    """提示点附近的绑带色像素质心（迭代两次）"""
    h, s, v = hsv(a); H, W = a.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    m0 = (a[..., 3] > 128) & (v >= 0.55) & (s < 0.45) & (a[..., 0].astype(int) >= a[..., 2].astype(int))
    for _ in range(2):
        m = m0 & ((xx - x) ** 2 + (yy - y) ** 2 <= r * r)
        if m.sum() < 20: return None
        x, y = float(xx[m].mean()), float(yy[m].mean())
    return x, y

def cmd_hints():
    p = os.path.join(SPR, 'spr.json'); meta = json.load(open(p)); n = 0
    for f, (hx, hy) in HINTS.items():
        F = meta['frames'][f]; have = [F[k] for k in ('wpn', 'wpn2') if k in F]
        if len(have) != 1: continue
        a = np.array(Image.open(os.path.join(SPR, f + '.webp')).convert('RGBA')); c = snap(a, hx, hy)
        if not c: print('  没找到', f); continue
        w0 = have[0]; side = 'f' if w0.get('side') == 'n' else 'n'
        F['wpn2' if 'wpn' in F else 'wpn'] = {'gx': round(c[0], 1), 'gy': round(c[1], 1), 'ang': w0['ang'], 'len': 24.0, 'bk': 0.0, 'front': 1, 'side': side, 'auto': 4}; n += 1
    json.dump(meta, open(p, 'w'), indent=1); print(f'按提示点补了 {n} 只拳头锚点（auto: 4；方向运行时按前臂重算）')

def cmd_apply():
    p = os.path.join(SPR, 'spr.json'); meta = json.load(open(p)); n = 0
    for f, fix in ACCEPT.items():
        F = meta['frames'][f]
        if any(F.get(k, {}).get('auto') == 3 for k in ('wpn', 'wpn2')) or len([k for k in ('wpn', 'wpn2') if k in F]) >= 2: continue
        r = find(f, F); r.pop('n'); r['gx'] = round(r['gx'] + fix[0], 1); r['gy'] = round(r['gy'] + fix[1], 1)
        if len(fix) > 2: r['ang'] = fix[2]
        F['wpn2' if 'wpn' in F else 'wpn'] = r; n += 1
    json.dump(meta, open(p, 'w'), indent=1); print(f'补了 {n} 只拳头锚点')

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'find'; names = [x for x in (sys.argv[2] if len(sys.argv) > 2 else '').split(',') if x]
    if cmd == 'find': cmd_find(names)
    elif cmd == 'apply': cmd_apply()
    elif cmd == 'hints': cmd_hints()
    else: sys.exit('cmd: find | apply | hints')
