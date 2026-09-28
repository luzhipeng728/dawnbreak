#!/usr/bin/env python3
"""外观与换装：时装帧和原装同名帧比较大小 / 姿势，列出偏差大的帧。
  avatar_sizecheck.py [套装...] [--tol 0.08] [--json 输出] [--write]
三个指标（每一帧都和原装同名帧比）：
  1. 包围盒（按要求）：高、宽的比值先除以这一套这个职业所有帧的中位数（系统差：魔法师摘了巫师帽整体变矮、
     天空套背后多了翅膀变宽），再看偏离多少。鬼剑士原装的长围巾、魔法师的披风在时装里都摘了，
     这会让宽度随姿势变很多——包围盒偏差只作参考，不单独判定为问题。
  2. 画的大小（比例）：脸（头部锚点往下半个头，不含帽子）在时装帧里是原装同名帧的几倍——
     把原装的脸按 0.78~1.28 倍缩放后在时装帧里找最像的，得到 scale。|scale - 1| > tol 就是这一格画大 / 画小了，
     可以按比例归一：切帧时这一格额外缩放 1 / scale（写进 art/tools/avatar_scale.json，avatar_frames.py 读取）。
  3. 姿势：按比例归一后，头部位置（相对脚底锚点）和原装差多少（占身高的比例）。> tol 就是姿势不一样，要重新生成那一格。
--write：把比例偏差写进 avatar_scale.json（只写比例；姿势问题要人工返修）。
"""
import os, sys, json, math, statistics
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from avatar_head import premul, head_template
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ['festival', 'spring', 'sky1', 'summer', 'sky2', 'academy']
SCALE_F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'avatar_scale.json')
ERR_MAX = 60   # 头部匹配的平均色差超过这个就不信比例（头被挡住 / 转过去了）

def load(d, n):
    return np.array(Image.open(os.path.join(d, n + '.webp')).convert('RGBA'))

def bbox(a):
    m = a[..., 3] > 60; ys, xs = np.where(m)
    return (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) if len(xs) else (1, 1)

def upright(a, H):
    """以头部锚点为中心把头转正，返回（图，锚点）"""
    deg = math.degrees(H.get('a', 0))
    im = Image.fromarray(a, 'RGBA')
    if abs(deg) > 0.5: im = im.rotate(deg, resample=Image.BICUBIC, center=(H['x'], H['y']))
    return np.array(im), (H['x'], H['y'])

def dil(m, r):
    o = m.copy()
    for _ in range(r):
        q = o.copy(); q[1:] |= o[:-1]; q[:-1] |= o[1:]; q[:, 1:] |= o[:, :-1]; q[:, :-1] |= o[:, 1:]; o = q
    return o

def head_tpl(idle):
    """站姿帧的头（上 40%）：模板 + 掩码（不透明区域外扩 6 像素：透明的一圈也参与比较，轮廓要对上，缩小的模板占不到便宜）"""
    T, _ = head_template(idle)
    M = dil(T[..., 3] > 128, 6)
    return T, M

def head_scale(F, H, T, M):
    """头在这一帧里是模板的几倍大：以头部锚点为中心把帧转正，模板中心对准锚点，缩放 0.78~1.28 倍、平移 ±10 像素找最像的"""
    fr, (cx, cy) = upright(F, H)
    pad = 90; fr = np.pad(fr, ((pad, pad), (pad, pad), (0, 0))); cx += pad; cy += pad
    Fp = premul(fr); best = None
    for sc in np.arange(0.78, 1.285, 0.02):
        w, h = max(4, round(T.shape[1] * sc)), max(4, round(T.shape[0] * sc))
        Ts = premul(np.array(Image.fromarray(T, 'RGBA').resize((w, h), Image.BILINEAR)))
        Ms = np.array(Image.fromarray((M * 255).astype(np.uint8), 'L').resize((w, h), Image.NEAREST)) > 127
        x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2)); n = Ms.sum()
        for dy in range(-10, 11, 2):
            for dx in range(-10, 11, 2):
                W = Fp[y0 + dy:y0 + dy + h, x0 + dx:x0 + dx + w]
                if W.shape[:2] != (h, w): continue
                v = float((((W - Ts) ** 2).sum(-1) * Ms).sum() / n)
                if best is None or v < best[0]: best = (v, sc, dx, dy)
    v, sc, dx, dy = best
    return round(float(sc), 3), round(math.sqrt(v / 4), 1)

def check(sid, cls, tol):
    bd, sd = os.path.join(HERE, 'final', 'spr', cls), os.path.join(HERE, 'final', 'spr', f'{cls}@{sid}')
    if not os.path.isdir(sd): return []
    BA = json.load(open(os.path.join(bd, 'spr.json')))['frames']; SA = json.load(open(os.path.join(sd, 'spr.json')))['frames']
    rows = {}
    TB, MB = head_tpl(load(bd, 'idle')); TS, MS = head_tpl(load(sd, 'idle'))   # 原装 / 时装各用自己的站姿头当模板（有没有帽子各自一致）
    for n in sorted(SA):
        if n not in BA: continue
        A, B = load(bd, n), load(sd, n); (bw, bh), (sw, sh) = bbox(A), bbox(B)
        fs = None
        if BA[n].get('head') and SA[n].get('head'):
            sb, eb = head_scale(A, BA[n]['head'], TB, MB); ss, es = head_scale(B, SA[n]['head'], TS, MS)
            fs = (round(ss / sb, 3), max(eb, es), sb, ss)
        rows[n] = {'bw': bw, 'bh': bh, 'sw': sw, 'sh': sh, 'fs': fs}
    mw = statistics.median(r['sw'] / r['bw'] for r in rows.values()); mh = statistics.median(r['sh'] / r['bh'] for r in rows.values())
    hb = BA['idle']['h']
    # 头部位置（相对脚底锚点）：时装（按比例归一后）减原装；原装帽子会让头部锚点整体偏，所以再减掉这一套所有帧的中位数
    offs = {}
    for n, r in rows.items():
        HB, HS, fs = BA[n].get('head'), SA[n].get('head'), r['fs']
        if HB and HS and fs:
            sc = fs[0]; offs[n] = ((HS['x'] - SA[n]['ax']) / sc - (HB['x'] - BA[n]['ax']), (HS['y'] - SA[n]['ay']) / sc - (HB['y'] - BA[n]['ay']))
    mox = statistics.median(v[0] for v in offs.values()) if offs else 0; moy = statistics.median(v[1] for v in offs.values()) if offs else 0
    out = []
    for n, r in rows.items():
        dw, dh = r['sw'] / r['bw'] / mw - 1, r['sh'] / r['bh'] / mh - 1
        fs = r['fs']; scale = fs[0] if fs else None; err = fs[1] if fs else None
        pose = round(math.hypot(offs[n][0] - mox, offs[n][1] - moy) / hb, 3) if n in offs else None
        flags = []
        if abs(dw) > tol or abs(dh) > tol: flags.append('包围盒')
        # 比例：时装帧头的大小 / 原装同名帧头的大小（各自和自己的站姿比，同一个姿势下头的透视一样，比值应该 ≈ 1）
        if fs and err < ERR_MAX and abs(scale - 1) > tol: flags.append('比例')
        if pose is not None and pose > tol: flags.append('姿势')
        if flags: out.append({'set': sid, 'cls': cls, 'frame': n, 'dw': round(dw, 3), 'dh': round(dh, 3), 'scale': scale, 'err': err, 'pose': pose, 'flags': flags,
                              'sb': fs[2] if fs else None, 'ss': fs[3] if fs else None, 'bbox': [int(r['bw']), int(r['bh']), int(r['sw']), int(r['sh'])]})
    return out

def main():
    args = sys.argv[1:]; tol = 0.08; jout = None; write = '--write' in args
    if write: args.remove('--write')
    if '--tol' in args: i = args.index('--tol'); tol = float(args[i + 1]); del args[i:i + 2]
    if '--json' in args: i = args.index('--json'); jout = args[i + 1]; del args[i:i + 2]
    sets = args or SETS; allr = []
    for sid in sets:
        for cls in ('sword', 'gun', 'mage'):
            r = check(sid, cls, tol); allr += r
            bb = [x for x in r if x['flags'] == ['包围盒']]; real = [x for x in r if x['flags'] != ['包围盒']]
            print(f'{cls}@{sid}: 只有包围盒偏差 {len(bb)} 帧；比例 / 姿势问题 {len(real)} 帧 ' +
                  ' '.join(f'{x["frame"]}[{"/".join(f for f in x["flags"] if f != "包围盒")} 头{x["ss"]}(原装{x["sb"]}) 头位{x["pose"]} 差{x["err"]}]' for x in real))
    n_bb = sum(1 for x in allr if x['flags'] == ['包围盒']); n_real = len(allr) - n_bb
    print(f'共 {len(allr)} 帧有偏差：只有包围盒偏差（衣服轮廓不同：摘了围巾 / 披风、多了翅膀）{n_bb} 帧，比例或姿势问题 {n_real} 帧')
    if jout: json.dump(allr, open(jout, 'w'), ensure_ascii=False, indent=1)
    if write:
        S = json.load(open(SCALE_F)) if os.path.exists(SCALE_F) else {}
        for x in allr:
            if '比例' in x['flags']: S.setdefault(x['set'], {}).setdefault(x['cls'], {})[x['frame']] = round(1 / x['scale'], 3)
        json.dump(S, open(SCALE_F, 'w'), ensure_ascii=False, indent=1); print('写入', SCALE_F)

if __name__ == '__main__':
    main()
