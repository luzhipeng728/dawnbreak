#!/usr/bin/env python3
"""外观与换装：占位武器动作表 → 精灵帧 + 每帧武器轨迹（写进 spr.json 的 wpn / wpn2）
  avatar_frames.py [前缀...]                     art/src/avatar/sheets/<职业>_<表>.png → art/final/spr/<职业>/
  avatar_frames.py --set festival [前缀...]      art/src/avatar/sets/festival/<职业>_<表>.png → art/final/spr/<职业>@festival/
  --src 目录：指定输入目录；--dry：只出预览，不写 art/final
一律是 --keep 语义：只替换这些表里的帧，其余帧和 spr.json 的 res 不动（新目录沿用基础职业的 res）。
每帧：
  1. 找出纯绿 #00FF00 占位棍（魔法师的杖头另有品红 #FF00FF 小球标记）并抠掉；棍子在身前时，被它挡住的身体用周围颜色补上
  2. 求出武器轨迹 wpn = { gx, gy 握点（帧像素）, ang 握点→尖端的方向（弧度，y 向下）, len 可见长度, front 1=身前 0=身后,
     hand [[x0,y0,x1,y1,…]] 握拳的轮廓（身前时运行时把这块重新盖在武器上面，做出“握住”的效果） }
     双持时第二把写在 wpn2
  3. 手工修正写在 art/tools/avatar_fix.json：{ "<表>/<帧>": { "front": 0, "flip": 1, "none": 1, ... } }
预览（抠好的帧 + 轴线 / 握点 / 拳头轮廓）写到主仓库 art/src/avatar/cut/<表>.png，逐张检查。
"""
import os, sys, json, math, argparse
from collections import deque
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, fill_holes, components
from frames import HEIGHT
import frames2
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
AV = os.path.join(MAIN, 'src', 'avatar')
FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'avatar_fix.json')
Q = int(os.environ.get('Q', 76))

# 战斗组新增的动作表：帧名来自 combatgen.SHEETS（frames2 合并后会自己 import；这里兜底一次）
try:
    from combatgen import SHEETS as _CS
    for _k, _v in _CS.items():
        _c, _s = _k.split('_', 1); frames2.NAMES.setdefault(_c, {}).setdefault(_s, [n for n, _ in _v])
except Exception: pass

def dil(m, r=1):
    o = m.copy()
    for _ in range(r):
        p = o.copy()
        p[1:] |= o[:-1]; p[:-1] |= o[1:]; p[:, 1:] |= o[:, :-1]; p[:, :-1] |= o[:, 1:]
        o = p
    return o

def key_maps(a):
    """绿色 / 品红覆盖度（0..1）：纯色 = 1，与中性色混合时约等于混合比例"""
    rgb = a[..., :3].astype(np.float32)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    g = np.clip((G - np.maximum(R, B)) / 255.0, 0, 1)
    m = np.clip((np.minimum(R, B) - G) / 255.0, 0, 1) * (np.minimum(R, B) > 150)
    op = a[..., 3] > 0
    return g * op, m * op

def cut_boxes(alpha, n=9):
    """同 frames2.cut9：按连通块切 3×3 表（alpha 里已去掉占位棍）"""
    lab, comps = components(alpha, min_cells=4)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); big, small = boxes[:n], boxes[n:]
    for s in small:
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        dist = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=dist)
        if dist(b) > 150: continue
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    H = alpha.shape[0]
    for b in big: b['row'] = min(2, int((b['y0'] + b['y1']) / 2 / (H / 3)))
    return lab, sorted(big, key=lambda b: (b['row'], b['x0']))

def hull(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) < 3: return pts
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

def stick_groups(S, lab_g, ids):
    """把同一根棍子的几段（被拳头 / 身体隔开）合在一起；不共线的是另一把武器（双持）"""
    segs = []
    for i in ids:
        ys, xs = np.where((lab_g == i) & S)
        if len(ys) < 25: continue
        P = np.stack([xs, ys], 1).astype(np.float32); c = P.mean(0)
        w, v = np.linalg.eigh(np.cov((P - c).T) + 1e-6 * np.eye(2)); d = v[:, 1]
        segs.append({'P': P, 'c': c, 'd': d, 'n': len(P), 'long': math.sqrt(max(w[1], 1e-6))})
    segs.sort(key=lambda s: -s['n'])
    groups = []
    for s in segs:
        for g in groups:
            h = g[0]; ang = abs(float(np.dot(h['d'], s['d'])))
            nrm = np.array([-h['d'][1], h['d'][0]]); off = abs(float(np.dot(s['c'] - h['c'], nrm)))
            if (ang > math.cos(math.radians(14)) or s['n'] < 250) and off < 26: g.append(s); break
        else: groups.append([s])
    return [np.concatenate([s['P'] for s in g]) for g in groups]

def runs(occ):
    """occ（bool 数组）里连续为 False 的区间 [(起, 止)]"""
    out = []; i = 0; n = len(occ)
    while i < n:
        if not occ[i]:
            j = i
            while j < n and not occ[j]: j += 1
            out.append((i, j)); i = j
        else: i += 1
    return out

def analyze(P, a, g, m, body, fist, cls, fix):
    """一根棍子 → 握点、方向、身前 / 身后、握拳区域（局部坐标）"""
    c = P.mean(0); w, v = np.linalg.eigh(np.cov((P - c).T)); d = v[:, 1]; nrm = np.array([-d[1], d[0]])
    t = (P - c) @ d; s = (P - c) @ nrm
    hw = max(4.0, float(np.percentile(np.abs(s), 96)))
    t0, t1 = float(t.min()), float(t.max()); L = t1 - t0
    occ = np.zeros(int(L) + 1, bool); occ[np.clip((t - t0).astype(int), 0, len(occ) - 1)] = True
    gaps = [(t0 + i, t0 + j) for i, j in runs(occ) if j - i >= 4]
    H, W = body.shape
    def at(tt, ss):
        x = np.clip(np.round(c[0] + d[0] * tt + nrm[0] * ss).astype(int), 0, W - 1); y = np.clip(np.round(c[1] + d[1] * tt + nrm[1] * ss).astype(int), 0, H - 1)
        return y, x
    def opaque_frac(ta, tb):
        ts = np.linspace(ta, tb, 12); ss = np.linspace(-hw, hw, 7); TT, SS = np.meshgrid(ts, ss); y, x = at(TT.ravel(), SS.ravel())
        return float((body[y, x] & (g[y, x] < 0.3)).mean())
    # 尖端方向：魔法师看品红标记；否则“短的一截 + 拳头缝”是握柄；再不行看哪一端外面挨着拳头
    tip, grip, why = None, None, ''
    if m is not None:
        my, mx = np.where(m > 0.5)
        if len(mx) > 15:
            mt = float(((np.stack([mx, my], 1) - c) @ d).mean()); tip = 1 if mt > (t0 + t1) / 2 else -1; why = '品红标记'
    cand = [(gs, ge) for gs, ge in gaps if 0.35 * fist <= ge - gs <= 2.2 * fist and opaque_frac(gs, ge) > 0.5]
    if cand:
        gs, ge = min(cand, key=lambda q: min(q[0] - t0, t1 - q[1]))
        short = min(gs - t0, t1 - ge)
        if short < 0.42 * L:
            if tip is None: tip = 1 if gs - t0 < t1 - ge else -1; why = why or '握柄短截'
            grip = (gs + ge) / 2
    if tip is None:
        fa, fb = opaque_frac(t0 - fist, t0 - 3), opaque_frac(t1 + 3, t1 + fist)
        tip = 1 if fa >= fb else -1; why = f'端点外侧 {fa:.2f}/{fb:.2f}'
    if fix.get('flip'): tip = -tip; why += ' 手工翻转'
    if grip is None: grip = (t0 - fist * 0.5) if tip == 1 else (t1 + fist * 0.5)
    tipT = t1 if tip == 1 else t0
    # 身前 / 身后：除了拳头缝（≤1.6 个拳头、离握点不远），棍子中段还被挡住的就是在身后
    hands, block = [grip], 0.0
    for gs, ge in gaps:
        mid = (gs + ge) / 2
        if abs(mid - grip) < 0.6 * fist: continue
        if ge - gs <= 1.6 * fist and abs(mid - grip) < 3.2 * fist and opaque_frac(gs, ge) > 0.5: hands.append(mid); continue
        if opaque_frac(gs, ge) > 0.4: block += ge - gs
    front = 1 if block < 0.1 * L else 0
    if 'front' in fix: front = int(fix['front'])
    gx, gy = c + d * grip; ang = math.atan2(d[1] * tip, d[0] * tip)
    return {'c': c, 'd': d, 'nrm': nrm, 'hw': hw, 't0': t0, 't1': t1, 'grip': grip, 'tip': tip, 'tipT': tipT, 'gx': float(gx), 'gy': float(gy), 'ang': ang,
            'len': abs(tipT - grip), 'front': front, 'hands': hands, 'why': why, 'gaps': gaps}

def fist_poly(W, a, g, body, fist):
    """握点附近的拳头：从棍子被挡住的那一段取色，向外扩到颜色相近（或深色描边）的像素，取凸包"""
    H, Wd = body.shape; out = []
    rgb = a[..., :3].astype(np.float32); lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    yy, xx = np.mgrid[0:H, 0:Wd]
    for hc in W['hands']:
        cx, cy = W['c'] + W['d'] * hc
        dx, dy = xx - cx, yy - cy; tt = dx * W['d'][0] + dy * W['d'][1]; ss = dx * W['nrm'][0] + dy * W['nrm'][1]
        seed = body & (g < 0.2) & (np.abs(ss) <= W['hw'] * 1.1) & (np.abs(tt) <= fist * 0.45)
        if seed.sum() < 8: continue
        sc = rgb[seed & (lum > 55)]; mean = sc.mean(0) if len(sc) else rgb[seed].mean(0)
        near = body & (g < 0.25) & (dx * dx + dy * dy <= (fist * 0.8) ** 2)
        ok = near & ((np.abs(rgb - mean).sum(-1) < 95) | (lum < 60))
        acc = seed & ok; q = deque(zip(*np.where(acc)))
        while q:
            y, x = q.popleft()
            for ny in (y - 1, y, y + 1):
                for nx in (x - 1, x, x + 1):
                    if 0 <= ny < H and 0 <= nx < Wd and ok[ny, nx] and not acc[ny, nx]: acc[ny, nx] = True; q.append((ny, nx))
        acc = dil(acc, 2) & body
        ys, xs = np.where(acc)
        if len(xs) < 20: continue
        out.append(hull(np.stack([xs, ys], 1).tolist()))
    return out

def bg_white(a):
    rgb = a[..., :3].astype(np.int16)
    return (rgb.min(-1) >= 243) & (rgb.max(-1) - rgb.min(-1) <= 12) & (a[..., 3] > 0)

def clear_white(out, seed):
    """棍子原来围住的白底（remove_bg 从图边泛洪不到）：从抠空的位置吃掉相连的纯白，再吃两圈抗锯齿浅色边"""
    W = bg_white(out); cur = seed.copy()
    for _ in range(400):
        nx = dil(cur) & W & ~cur
        if not nx.any(): break
        cur |= nx
    rgb = out[..., :3].astype(np.int16); L = (rgb.min(-1) >= 215) & (rgb.max(-1) - rgb.min(-1) <= 30) & (out[..., 3] > 0)
    for _ in range(2): cur |= dil(cur) & L
    out[..., 3] = np.where(cur & ~seed, 0, out[..., 3])

def key_and_fill(a, hole, fill, known):
    """抠掉占位棍：fill（身前那段被挡住的身体）用 known 里的干净颜色逐圈向内扩散补上；其余占位像素变透明"""
    rgb = a[..., :3].astype(np.float32); al = a[..., 3].copy()
    col = rgb * known[..., None]; kn = known.astype(np.float32); known = known.copy()
    for _ in range(80):
        todo = fill & ~known
        if not todo.any(): break
        acc = np.zeros_like(col); cnt = np.zeros_like(kn)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dy and not dx: continue
                acc += np.roll(np.roll(col, dy, 0), dx, 1); cnt += np.roll(np.roll(kn, dy, 0), dx, 1)
        new = todo & (cnt > 0)
        if not new.any(): break
        col[new] = acc[new] / cnt[new][:, None]; kn[new] = 1; known = known | new
    out = a.copy(); out[..., :3] = np.where(fill[..., None], np.clip(col, 0, 255), rgb).astype(np.uint8)
    out[..., 3] = np.where(fill, 255, np.where(hole, 0, al))
    return out

def inside_mask(hole, al, sticks, white):
    """占位棍像素两侧（垂直方向）都挨着身体（纯白底不算）→ 在身体里面，需要补"""
    H, W = hole.shape; res = np.zeros_like(hole)
    solid = (al > 127) & ~hole & ~white
    ys, xs = np.where(hole)
    if not len(xs): return res
    for st in sticks:
        if not st['front']: continue
        n = st['nrm']; D = int(st['hw'] * 2 + 14)
        sel = np.abs((xs - st['c'][0]) * n[0] + (ys - st['c'][1]) * n[1]) <= st['hw'] * 2.2
        t = (xs - st['c'][0]) * st['d'][0] + (ys - st['c'][1]) * st['d'][1]
        sel &= (t >= st['t0'] - st['hw'] * 2) & (t <= st['t1'] + st['hw'] * 2)
        px, py = xs[sel], ys[sel]
        if not len(px): continue
        side = []
        for sg in (1, -1):
            hit = np.zeros(len(px), bool); done = np.zeros(len(px), bool)
            for k in range(1, D):
                qx = np.clip(np.round(px + n[0] * k * sg).astype(int), 0, W - 1); qy = np.clip(np.round(py + n[1] * k * sg).astype(int), 0, H - 1)
                nh = ~hole[qy, qx]
                hit |= ~done & nh & solid[qy, qx]; done |= nh
            side.append(hit)
        ok = side[0] & side[1]; res[py[ok], px[ok]] = True
    return res

def process_sheet(char, sheet, path, names, res, fixes, pv_path):
    img = Image.open(path)
    im = fill_holes(remove_bg(img), min_area=90, thr=251); a = np.array(im)
    g, m = key_maps(a)
    use_m = char == 'mage'
    solid = g > 0.5
    body_al = np.where((g > 0.35) | (use_m & (m > 0.35)), 0, a[..., 3]).astype(np.uint8)
    lab, order = cut_boxes(body_al)
    rows_ok = [sum(1 for b in order if b['row'] == r) for r in range(3)]
    bad = len(order) != 9 or rows_ok != [3, 3, 3]
    print(f'{char}_{sheet}: {len(order)} frames rows={rows_ok}{"  <-- CHECK" if bad else ""}')
    # 绿色连通块分给最近的帧
    lab_g, gcomps = components((solid * 255).astype(np.uint8), f=2, min_cells=6)
    owner = {}
    for gid, _ in gcomps:
        ys, xs = np.where(lab_g == gid)
        if not len(xs): continue
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        dist = lambda b: max(0, b['x0'] - x1, x0 - b['x1']) + max(0, b['y0'] - y1, y0 - b['y1'])
        b = min(range(len(order)), key=lambda i: dist(order[i])); owner.setdefault(b, []).append(gid)
    ref = order[0]; k = HEIGHT[char] * res / (ref['y1'] - ref['y0'])
    fist = (ref['y1'] - ref['y0']) * 0.088
    frames, pv_items = {}, []
    base = {}
    for i, b in enumerate(order):
        fn = names[i] if i < len(names) else None
        if fn is None: continue
        fix = fixes.get(f'{sheet}/{fn}', {})
        gids = owner.get(i, [])
        pad = 40
        ys, xs = np.where(np.isin(lab_g, gids)) if gids else (np.array([], int), np.array([], int))
        X0 = max(0, min([b['x0']] + ([xs.min()] if len(xs) else [])) - pad); X1 = min(a.shape[1], max([b['x1']] + ([xs.max() + 1] if len(xs) else [])) + pad)
        Y0 = max(0, min([b['y0']] + ([ys.min()] if len(ys) else [])) - pad); Y1 = min(a.shape[0], max([b['y1']] + ([ys.max() + 1] if len(ys) else [])) + pad)
        la = a[Y0:Y1, X0:X1].copy(); lg = g[Y0:Y1, X0:X1]; lm = m[Y0:Y1, X0:X1] if use_m else None
        mine = np.isin(lab[Y0:Y1, X0:X1], b['ids']); stickreg = dil(np.isin(lab_g[Y0:Y1, X0:X1], gids), 5) if gids else np.zeros_like(mine)
        if use_m: stickreg |= dil(lm > 0.3, 4) & dil(mine | stickreg, 20)
        la[..., 3] = np.where(mine | stickreg, la[..., 3], 0)
        body = (la[..., 3] > 127) & (lg < 0.3)
        sticks = []
        if gids and not fix.get('none'):
            for P in stick_groups(solid[Y0:Y1, X0:X1], lab_g[Y0:Y1, X0:X1], gids):
                if len(P) < 120: continue
                sticks.append(analyze(P, la, lg, lm, body, fist, char, fix))
            sticks.sort(key=lambda s: -(s['t1'] - s['t0']))
            for st in sticks[1:]: st['minor'] = (st['t1'] - st['t0']) < 0.5 * (sticks[0]['t1'] - sticks[0]['t0'])
        hole = stickreg & ((lg > 0.07) | ((lm > 0.1) if use_m else False))
        white = bg_white(la)
        inside = inside_mask(hole, la[..., 3], sticks, white)
        band = dil(hole, 2) & ~hole & (la[..., 3] > 0)
        fillset = (hole & inside) | (band & dil(hole & inside, 3))
        known = (la[..., 3] > 127) & ~hole & ~band & ~white
        polys = []
        for st in sticks: st['polys'] = fist_poly(st, la, lg, body, fist) if st['front'] and not st.get('minor') else []
        out = key_and_fill(la, hole, fillset, known)
        # 去绿边：棍子附近残留的绿色偏色压回去（G 不超过 R、B 的较大者）
        sp = stickreg & ~hole & ~fillset; rgb = out[..., :3].astype(np.int16); mx = np.maximum(rgb[..., 0], rgb[..., 2])
        out[..., 1] = np.where(sp & (rgb[..., 1] > mx), mx, rgb[..., 1]).astype(np.uint8)
        # 棍子原来围住的白底（remove_bg 泛洪不到的地方）：从抠空的位置向外吃掉相连的近白像素
        clear_white(out, hole & ~fillset)
        # 裁到身体
        al = out[..., 3] > 40
        rows = np.where(al.any(1))[0]; cols = np.where(al.any(0))[0]
        y0, y1, x0, x1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
        sub = out[y0:y1, x0:x1]
        frames[fn] = {'sub': sub, 'row': b['row'], 'y1': Y0 + y1, 'y0': Y0 + y0, 'sticks': sticks, 'org': (X0 + x0, Y0 + y0), 'org_l': (x0, y0)}
        base[b['row']] = max(base.get(b['row'], 0), Y0 + y1)
    return frames, base, k, a

def finish(char, sheet, frames, base, k, res, meta, out_dir, pv_path, dry):
    cyc = sheet in frames2.CYCLE
    tiles = []
    for fn, F in frames.items():
        sub = F['sub']; a = sub[..., 3] > 40; h = a.shape[0]
        if cyc:
            xs = np.where(a[int(h * 0.15):int(h * 0.55)])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
            ay = base[F['row']] - F['y0']
        else:
            rows = np.where(a.any(1))[0]; bottom = rows.max() + 1
            xs = np.where(a[max(0, bottom - int(h * 0.12)):bottom])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
            ay = bottom
        fr = Image.fromarray(sub, 'RGBA'); sm = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS)
        ent = {'w': sm.width, 'h': sm.height, 'ax': round(ax * k, 1), 'ay': round(ay * k, 1)}
        ox, oy = F['org_l']
        for j, st in enumerate([st for st in F['sticks'] if not st.get('minor')][:2]):
            wp = {'gx': round((st['gx'] - ox) * k, 1), 'gy': round((st['gy'] - oy) * k, 1), 'ang': round(st['ang'], 3), 'len': round(st['len'] * k, 1), 'front': st['front']}
            if st['polys']: wp['hand'] = [[round(v, 1) for p in poly for v in ((p[0] - ox) * k, (p[1] - oy) * k)] for poly in st['polys']]
            ent['wpn' if j == 0 else 'wpn2'] = wp
        meta['frames'][fn] = ent
        if not dry: sm.save(os.path.join(out_dir, f'{fn}.webp'), 'WEBP', quality=Q, method=6)
        tiles.append((fn, sm, ent))
        ws = ' '.join(f"[{'前' if st['front'] else '后'} 长{st['len'] * k:.0f} 角{math.degrees(st['ang']):.0f} 手{len(st['polys'])} {st['why']}]" for st in F['sticks'] if not st.get('minor')) or '（无武器）'
        print(f'   {fn:10s} {ws}')
    # 预览（2 倍）：灰底，轴线（红=身前 蓝=身后）、握点（黄圈）、拳头轮廓（青）；每行 5 帧
    Z = 2; per = 5; cw = max(t[1].width for t in tiles) * Z + 60; ch = max(t[1].height for t in tiles) * Z + 60
    nr = (len(tiles) + per - 1) // per
    pv = Image.new('RGBA', (cw * min(per, len(tiles)), ch * nr), (70, 74, 84, 255)); d = ImageDraw.Draw(pv)
    for i, (fn, sm, ent) in enumerate(tiles):
        ox, oy = (i % per) * cw + 30, (i // per) * ch + 30
        pv.alpha_composite(sm.resize((sm.width * Z, sm.height * Z), Image.NEAREST), (ox, oy)); d.text((ox, oy - 22), fn, fill=(255, 230, 120))
        for key in ('wpn', 'wpn2'):
            wp = ent.get(key)
            if not wp: continue
            gx, gy = ox + wp['gx'] * Z, oy + wp['gy'] * Z; ex, ey = gx + math.cos(wp['ang']) * wp['len'] * Z, gy + math.sin(wp['ang']) * wp['len'] * Z
            d.line([gx, gy, ex, ey], fill=(255, 60, 60) if wp['front'] else (60, 140, 255), width=2)
            d.ellipse([gx - 5, gy - 5, gx + 5, gy + 5], outline=(255, 230, 0), width=2)
            for poly in wp.get('hand', []):
                pts = [(ox + poly[j] * Z, oy + poly[j + 1] * Z) for j in range(0, len(poly), 2)]
                d.line(pts + [pts[0]], fill=(0, 255, 255), width=1)
    pv.save(pv_path)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('pre', nargs='*'); ap.add_argument('--set', default=''); ap.add_argument('--src', default=''); ap.add_argument('--dry', action='store_true')
    A = ap.parse_args()
    src = A.src or (os.path.join(AV, 'sets', A.set) if A.set else os.path.join(AV, 'sheets'))
    fixes = json.load(open(FIX)) if os.path.exists(FIX) else {}
    pv_dir = os.path.join(AV, 'cut', A.set or 'base'); os.makedirs(pv_dir, exist_ok=True)
    todo = {}
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png') or '_pre' in f: continue
        name = f[:-4]
        if A.pre and not any(name.startswith(p) for p in A.pre): continue
        char, sheet = name.split('_', 1); todo.setdefault(char, []).append((sheet, os.path.join(src, f)))
    for char, sheets in todo.items():
        key = f'{char}@{A.set}' if A.set else char
        out_dir = os.path.join(HERE, 'final', 'spr', key); os.makedirs(out_dir, exist_ok=True)
        mp = os.path.join(out_dir, 'spr.json')
        base_meta = json.load(open(os.path.join(HERE, 'final', 'spr', char, 'spr.json')))
        meta = json.load(open(mp)) if os.path.exists(mp) else {'res': base_meta['res'], 'frames': {}}
        res = meta['res']
        for sheet, path in sheets:
            names = frames2.names_for(char, sheet)
            frames, base, k, _ = process_sheet(char, sheet, path, names, res, fixes, None)
            finish(char, sheet, frames, base, k, res, meta, out_dir, os.path.join(pv_dir, f'{char}_{sheet}.png'), A.dry)
        if not A.dry:
            meta['frames'] = dict(sorted(meta['frames'].items()))
            json.dump(meta, open(mp, 'w'), indent=1)
        print(f'  -> {key}: {len(meta["frames"])} frames')

if __name__ == '__main__':
    main()
