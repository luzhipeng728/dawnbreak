#!/usr/bin/env python3
"""外观与换装：每帧的头部锚点（帽子 / 发饰 / 眼镜按它叠加）。
做法：拿本职业站姿帧（idle）的头部当模板，在每一帧里搜位置 + 转角（FFT 算平方差），取最像的。
  head = { x, y 模板中心在这一帧的位置（帧像素）, a 转角（弧度，y 向下时顺时针为正）, q 平均色差（越小越像） }
单独运行：avatar_head.py <职业目录名...>  → 给 art/final/spr/<目录>/spr.json 的每帧补上 head，并出预览 art/src/avatar/cut/head_<目录>.png
"""
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
HEAD_FRAC = 0.40    # 站姿帧从顶上往下这么多算头
Q_MAX = 110.0       # 平均色差超过这个就当找不到头（不画配件）

def premul(a):
    a = a.astype(np.float32); al = a[..., 3:4] / 255.0
    return np.concatenate([a[..., :3] * al, al * 255.0], -1)

def head_template(idle):
    """idle：RGBA 数组 → (模板 RGBA, 模板中心 (cx, cy) 在 idle 里的坐标)"""
    h = idle.shape[0]; rows = np.where((idle[..., 3] > 40).any(1))[0]; top = rows.min()
    y1 = int(top + (rows.max() - top) * HEAD_FRAC)
    sub = idle[top:y1]; cols = np.where((sub[..., 3] > 40).any(0))[0]; x0, x1 = cols.min(), cols.max() + 1
    return idle[top:y1, x0:x1].copy(), ((x0 + x1) / 2, (top + y1) / 2)

def _rot(t, deg):
    im = Image.fromarray(t, 'RGBA').rotate(-deg, resample=Image.BICUBIC, expand=True)
    return np.array(im)

def _ssd(F, T):
    """F（premul，H×W×4）上每个位置放模板 T（premul + 掩码）的平均平方差；返回 (分数图, 偏移)"""
    M = (T[..., 3] > 128).astype(np.float32); n = M.sum()
    th, tw = T.shape[:2]; H, W = F.shape[:2]
    PH, PW = H + 2 * th, W + 2 * tw
    Fp = np.zeros((PH, PW, 4), np.float32); Fp[th:th + H, tw:tw + W] = F
    sh = (PH + th, PW + tw)
    fM = np.fft.rfft2(M[::-1, ::-1], sh)
    s = np.fft.irfft2(np.fft.rfft2((Fp ** 2).sum(-1), sh) * fM, sh)
    cross = np.zeros(sh, np.float32)
    for c in range(4): cross += np.fft.irfft2(np.fft.rfft2(Fp[..., c], sh) * np.fft.rfft2((M * T[..., c])[::-1, ::-1], sh), sh)
    tt = (M[..., None] * T ** 2).sum()
    ssd = (s - 2 * cross + tt) / n
    # 有效区：模板左上角放在 (y, x) 时，对应 ssd[y + th - 1, x + tw - 1]
    return ssd[th - 1:th - 1 + PH - th + 1, tw - 1:tw - 1 + PW - tw + 1], (th, tw)

def find_head(frame, tpl, tc, ctr_in_tpl, near=None):
    """frame：RGBA；tpl：模板 RGBA；ctr_in_tpl：模板中心在模板里的坐标 → {x, y, a, q}
    near = (px, py, 角度°, 半径, 角度范围°)：只在预测位置附近找（时装帧：按原装同帧的头部位置预测，防止翅膀 / 白毛边被当成白头发）"""
    F = premul(frame); best = None
    def search(angles, Fs, Ts_scale):
        nonlocal best
        for deg in angles:
            T = _rot(tpl, deg)
            if Ts_scale != 1: T = np.array(Image.fromarray(T, 'RGBA').resize((max(1, round(T.shape[1] * Ts_scale)), max(1, round(T.shape[0] * Ts_scale))), Image.BILINEAR))
            S, (th, tw) = _ssd(Fs, premul(T))
            # 旋转后模板中心 = 旋转图中心（expand 旋转保持中心）；模板中心相对模板几何中心的偏移也要转
            Th, Tw = T.shape[0] / Ts_scale, T.shape[1] / Ts_scale
            ox, oy = ctr_in_tpl[0] - tpl.shape[1] / 2, ctr_in_tpl[1] - tpl.shape[0] / 2; r = math.radians(deg)
            dxc, dyc = Tw / 2 + ox * math.cos(r) - oy * math.sin(r), Th / 2 + ox * math.sin(r) + oy * math.cos(r)
            if near:   # 只看预测位置附近
                yy, xx = np.mgrid[0:S.shape[0], 0:S.shape[1]]
                cxs, cys = (xx - tw) / Ts_scale + dxc, (yy - th) / Ts_scale + dyc
                S = np.where((cxs - near[0]) ** 2 + (cys - near[1]) ** 2 <= near[3] ** 2, S, np.inf)
                if not np.isfinite(S).any(): continue
            i = np.unravel_index(np.argmin(S), S.shape); v = float(S[i])
            # 模板左上角在 F 里的位置
            y0, x0 = (i[0] - th) / Ts_scale, (i[1] - tw) / Ts_scale
            cx = x0 + dxc; cy = y0 + dyc
            if best is None or v < best[0]: best = (v, deg, cx, cy)
    small = 0.5
    Fs = np.array(Image.fromarray(frame, 'RGBA').resize((max(1, round(frame.shape[1] * small)), max(1, round(frame.shape[0] * small))), Image.BILINEAR))
    if near: search([near[2] + k for k in range(-int(near[4]), int(near[4]) + 1, 10)], premul(Fs), small)
    else: search(range(-180, 180, 15), premul(Fs), small)
    if best is None: return None
    d0 = best[1]; best = None
    search([d0 + k for k in np.arange(-10, 10.1, 2.5)], F, 1)
    v, deg, cx, cy = best
    q = math.sqrt(max(v, 0) / 4)
    return {'x': round(cx, 1), 'y': round(cy, 1), 'a': round(math.radians(((deg + 180) % 360) - 180), 3), 'q': round(q, 1), 'fq': round(face_err(F, tpl, deg, cx, cy), 1)}

FACE_BOX = (0.52, 0.5, 1.0, 1.0)   # 模板里脸所在的区域（相对宽高；角色朝右，脸在头部右下）
FACE_MAX = 60.0                   # 脸部色差超过这个、且比整个头的色差明显大（脸那块特别不像）= 脸被挡住，不画眼镜
face_hidden = lambda H: H['fq'] > FACE_MAX and H['fq'] - H['q'] > 18

def face_err(F, tpl, deg, cx, cy):
    """把模板按找到的位置 / 转角贴回去，只比较脸那一块"""
    th, tw = tpl.shape[:2]; m = np.zeros((th, tw), np.uint8)
    x0, y0, x1, y1 = FACE_BOX; m[int(y0 * th):int(y1 * th), int(x0 * tw):int(x1 * tw)] = 255
    T = _rot(tpl, deg); M = np.array(Image.fromarray(m, 'L').rotate(-deg, resample=Image.NEAREST, expand=True)) > 0
    M &= T[..., 3] > 128
    oy, ox = int(round(cy - T.shape[0] / 2)), int(round(cx - T.shape[1] / 2))
    H, W = F.shape[:2]; P = premul(T); ys, xs = np.where(M)
    fy, fx = ys + oy, xs + ox; ok = (fy >= 0) & (fy < H) & (fx >= 0) & (fx < W)
    if ok.sum() < 20: return 999.0
    d = F[fy[ok], fx[ok]] - P[ys[ok], xs[ok]]
    return float(np.sqrt((d ** 2).mean()))

def heads_for_dir(key, frames=None, preview=True):
    d = os.path.join(HERE, 'final', 'spr', key); meta = json.load(open(os.path.join(d, 'spr.json')))
    base = key.split('@')[0]
    idle_p = os.path.join(d, 'idle.webp') if os.path.exists(os.path.join(d, 'idle.webp')) else os.path.join(HERE, 'final', 'spr', base, 'idle.webp')
    idle = np.array(Image.open(idle_p).convert('RGBA')); tpl, tc = head_template(idle)
    rows = np.where((idle[..., 3] > 40).any(1))[0]; top = rows.min()
    y1 = int(top + (rows.max() - top) * HEAD_FRAC); cols = np.where((idle[top:y1, :, 3] > 40).any(0))[0]
    ctr_in_tpl = (tc[0] - cols.min(), tc[1] - top)
    out = {}
    bmeta = json.load(open(os.path.join(HERE, 'final', 'spr', base, 'spr.json')))['frames'] if '@' in key else None
    for fn in (frames or list(meta['frames'])):
        p = os.path.join(d, f'{fn}.webp')
        if not os.path.exists(p): continue
        fr = np.array(Image.open(p).convert('RGBA'))
        near = predict_from_base(key, fn, fr, meta['frames'][fn], bmeta) if bmeta else None
        H = (find_head(fr, tpl, tc, ctr_in_tpl, near) if near else None) or find_head(fr, tpl, tc, ctr_in_tpl)
        if near: H['near'] = [round(near[0], 1), round(near[1], 1), round(math.radians(near[2]), 3)]   # 找不准时退回这个预测位置
        out[fn] = H
    return meta, out, d

def predict_from_base(key, fn, fr, F, bmeta):
    """时装帧：原装同帧（姿势一样）的头部位置 → 这一帧里的预测位置。两帧按脚底锚点放好后，用轮廓重合度再对齐一次平移。"""
    G = bmeta.get(fn); H0 = G and G.get('head')
    if not H0: return None
    base = key.split('@')[0]
    bf = np.array(Image.open(os.path.join(HERE, 'final', 'spr', base, f'{fn}.webp')).convert('RGBA'))
    A = bf[..., 3] > 40; B = fr[..., 3] > 40
    # 放到同一张画布：原点 = 脚底锚点
    S = 2; pad = 60
    W = max(A.shape[1], B.shape[1]) + 2 * pad + 200; Hh = max(A.shape[0], B.shape[0]) + 2 * pad + 200
    ox, oy = W // 2, Hh - pad
    def place(M, ax, ay):
        C = np.zeros((Hh, W), bool); x0, y0 = int(round(ox - ax)), int(round(oy - ay))
        C[y0:y0 + M.shape[0], x0:x0 + M.shape[1]] = M; return C[::S, ::S]
    Ca, Cb = place(A, G['ax'], G['ay']), place(B, F['ax'], F['ay'])
    best = (-1, 0, 0)
    for dy in range(-20, 21, 2):
        for dx in range(-20, 21, 2):
            Cs = np.roll(np.roll(Ca, dy, 0), dx, 1); iou = (Cs & Cb).sum() / max(1, (Cs | Cb).sum())
            if iou > best[0]: best = (iou, dx * S, dy * S)
    _, sx, sy = best
    px = H0['x'] - G['ax'] + F['ax'] + sx; py = H0['y'] - G['ay'] + F['ay'] + sy
    return (px, py, math.degrees(H0.get('a', 0)), 26.0, 35.0)

def preview(d, out, path):
    tiles = []
    for fn, H in out.items():
        im = Image.open(os.path.join(d, f'{fn}.webp')).convert('RGBA'); bg = Image.new('RGBA', (im.width + 40, im.height + 40), (70, 74, 84, 255)); bg.alpha_composite(im, (20, 20))
        dr = ImageDraw.Draw(bg); x, y = H['x'] + 20, H['y'] + 20; ok = H['q'] <= Q_MAX
        dr.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(0, 255, 120) if ok else (255, 60, 60), width=2)
        ux, uy = math.sin(H['a']), -math.cos(H['a']); dr.line([x, y, x + ux * 40, y + uy * 40], fill=(0, 255, 120) if ok else (255, 60, 60), width=2)
        tag = 'X' if face_hidden(H) else ''
        dr.text((4, 2), f"{fn} q{H['q']:.0f} f{H['fq']:.0f}{tag} {math.degrees(H['a']):.0f}°", fill=(255, 230, 120)); tiles.append(bg)
    per = 8; cw = max(t.width for t in tiles); ch = max(t.height for t in tiles); nr = (len(tiles) + per - 1) // per
    M = Image.new('RGBA', (cw * min(per, len(tiles)), ch * nr), (70, 74, 84, 255))
    for i, t in enumerate(tiles): M.alpha_composite(t, ((i % per) * cw, (i // per) * ch))
    M.save(path)

def main():
    for key in sys.argv[1:]:
        meta, out, d = heads_for_dir(key)
        for fn, H in out.items():
            if H['q'] <= Q_MAX:
                meta['frames'][fn]['head'] = {k: H[k] for k in ('x', 'y', 'a')}
                if face_hidden(H): meta['frames'][fn]['head']['f'] = 0
            elif H.get('near'):   # 时装帧找不到：用原装同帧平移过来的位置（不画眼镜）
                n = H['near']; meta['frames'][fn]['head'] = {'x': n[0], 'y': n[1], 'a': n[2], 'f': 0}
            else: meta['frames'][fn].pop('head', None)
        json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'), indent=1)
        pv = os.path.join(MAIN, 'src', 'avatar', 'cut', f'head_{key}.png'); preview(d, out, pv)
        bad = [f for f, H in out.items() if H['q'] > Q_MAX and not H.get('near')]
        print(f'{key}: {len(out)} 帧，{len(out) - len(bad)} 帧有头部锚点；没找到：{" ".join(bad) or "无"}  预览 {pv}')

if __name__ == '__main__':
    main()
