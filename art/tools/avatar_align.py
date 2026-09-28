#!/usr/bin/env python3
"""外观与换装：时装帧对齐原装同名帧（大小 + 位置）。
  avatar_align.py <套装...> [--apply] [--report 输出json] [--frames a,b,...]
时装表是改图重画的，个别格子会画大 / 画小、在格子里偏一点，切帧后：
  - 大小和原装不一样（帧高 / 宽偏差）；
  - 脚底锚点和原装不一样（换时装后人在原地挪一下；同一片段里帧与帧之间位置跳）。
做法：把时装帧的轮廓（alpha）缩放 s、平移 t，找和原装同名帧轮廓重合度（IoU）最高的 (s, t)。
  s 除以这一套这个职业所有帧的中位数 = 这一格画大 / 画小了多少（中位数是系统差：摘了帽子 / 披风、多了翅膀）。
--apply：|s 相对中位数 - 1| > SCALE_TOL 的帧按比例缩回去；所有对齐可靠的帧（IoU 够高）脚底锚点改成原装锚点映射过来的位置。
  spr.json 里的 wpn / wpn2（握点、长度、握拳轮廓）、head 一起换算。之后请重跑 avatar_head.py（头部锚点按新图重找）。
IoU 低的帧 = 姿势和原装差得多（或者衣服轮廓差太多），列在报告里，人工看是否要重新生成那一格。
"""
import os, sys, json, math, statistics
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCALE_TOL = 0.06     # 比这小的缩放偏差不重采样（避免把图弄糊；鬼剑士 / 神枪手实测全部在 ±4% 以内）
IOU_OK = 0.55        # 对齐可靠的最低重合度
D = 2                # 算对齐时缩小倍数

POS_ONLY = {'mage'}
HAT_CLS = {'gun', 'mage'}   # 原装自带帽子（报童帽 / 巫师帽），时装都摘了：对齐时两边都去掉头顶（头部锚点以上）

def mask(path, head=None):
    a = np.array(Image.open(path).convert('RGBA'))[..., 3] > 60
    if head:   # 去掉头部锚点“上方”的半平面（按头的朝向）
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; ang = head.get('a', 0)
        up = -(xx - head['x']) * math.sin(ang) + (yy - head['y']) * math.cos(ang)   # 头朝上时 = y - head.y
        a &= up > 0
    return Image.fromarray((a * 255).astype(np.uint8), 'L')

def align(mb, ms, scales=np.arange(0.84, 1.161, 0.02)):
    """mb 原装 / ms 时装（PIL L）。返回 (s, tx, ty, iou)：时装像素 ≈ s × 原装像素 + t（原图坐标）"""
    B = np.array(mb.resize((max(1, mb.width // D), max(1, mb.height // D)), Image.BILINEAR)) > 127
    nb = B.sum(); best = None
    for s in scales:
        # 把时装按 1/s 缩放到原装的大小，再找平移
        w, h = max(1, round(ms.width / s / D)), max(1, round(ms.height / s / D))
        S = np.array(ms.resize((w, h), Image.BILINEAR)) > 127; ns = S.sum()
        H, W = B.shape[0] + S.shape[0], B.shape[1] + S.shape[1]
        cor = np.fft.irfft2(np.fft.rfft2(B.astype(np.float32), (H, W)) * np.conj(np.fft.rfft2(S.astype(np.float32), (H, W))), (H, W))
        i = np.unravel_index(np.argmax(cor), cor.shape); ov = float(cor[i])
        iou = ov / (nb + ns - ov)
        if best is None or iou > best[3]:
            dy = i[0] if i[0] < H - S.shape[0] else i[0] - H   # 缩放后的时装放在原装 (dx, dy) 处
            dx = i[1] if i[1] < W - S.shape[1] else i[1] - W
            best = (float(s), dx, dy, iou)
    s, dx, dy, iou = best
    # 时装（缩到原装大小后）像素 p' 放在原装的 p' + d 处 → 原装像素 p 对应缩放后时装的 p - d → 时装原图 s·(p - d)
    return s, -dx * D * s, -dy * D * s, iou

def run(sid, apply, only=None):
    rep = []
    for cls in ('sword', 'gun', 'mage'):
        bd, sd = os.path.join(HERE, 'final', 'spr', cls), os.path.join(HERE, 'final', 'spr', f'{cls}@{sid}')
        if not os.path.isdir(sd): continue
        BA = json.load(open(os.path.join(bd, 'spr.json'))); SA = json.load(open(os.path.join(sd, 'spr.json')))
        if only and not any(n in SA['frames'] for n in only): continue
        res = {}
        for n in SA['frames']:
            if n not in BA['frames']: continue
            cut = cls in HAT_CLS and BA['frames'][n].get('head') and SA['frames'][n].get('head')
            # 魔法师：原装的巫师帽 / 披风让轮廓差很多，逐帧估的缩放不可靠（实测同一段走路忽大忽小 ±10%）→ 只对齐位置，不估缩放
            res[n] = align(mask(os.path.join(bd, n + '.webp'), BA['frames'][n]['head'] if cut else None),
                           mask(os.path.join(sd, n + '.webp'), SA['frames'][n]['head'] if cut else None),
                           np.array([1.0]) if cls in POS_ONLY else np.arange(0.84, 1.161, 0.02))
        med = statistics.median(r[0] for r in res.values() if r[3] >= IOU_OK)
        fixed_s, fixed_a = [], []
        for n, (s, tx, ty, iou) in res.items():
            F, G = SA['frames'][n], BA['frames'][n]; rel = s / med
            ent = {'set': sid, 'cls': cls, 'frame': n, 's': round(s, 3), 'rel': round(rel, 3), 'iou': round(iou, 3),
                   'dax': round(s * G['ax'] + tx - F['ax'], 1), 'day': round(s * G['ay'] + ty - F['ay'], 1)}
            rep.append(ent)
            if not apply or iou < IOU_OK or (only and n not in only): continue
            k = 1.0
            if abs(rel - 1) > SCALE_TOL:   # 按比例缩回去：时装图缩放 1/rel
                k = 1 / rel; p = os.path.join(sd, n + '.webp'); im = Image.open(p).convert('RGBA')
                im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS); im.save(p, 'WEBP', quality=76, method=6)
                F['w'], F['h'] = im.width, im.height
                for key in ('wpn', 'wpn2'):
                    W = F.get(key)
                    if not W: continue
                    for f2 in ('gx', 'gy', 'len', 'bk'):
                        if f2 in W: W[f2] = round(W[f2] * k, 1)
                    if 'hand' in W: W['hand'] = [[round(v * k, 1) for v in P] for P in W['hand']]
                if F.get('head'): F['head'] = {**F['head'], 'x': round(F['head']['x'] * k, 1), 'y': round(F['head']['y'] * k, 1)}
                fixed_s.append(f'{n}({rel:.2f})')
            # 脚底锚点：原装锚点映射到时装图（缩放 k 之后）
            nax, nay = (s * G['ax'] + tx) * k, (s * G['ay'] + ty) * k
            if abs(nax - F['ax']) > 1.5 or abs(nay - F['ay']) > 1.5: fixed_a.append(f'{n}({nax - F["ax"]:+.0f},{nay - F["ay"]:+.0f})')
            F['ax'], F['ay'] = round(nax, 1), round(nay, 1)
        if apply: json.dump(SA, open(os.path.join(sd, 'spr.json'), 'w'), indent=1)
        low = [f'{n}({r[3]:.2f})' for n, r in res.items() if r[3] < IOU_OK]
        print(f'{cls}@{sid}: 系统比例 {med:.3f}；按比例归一 {len(fixed_s)} 帧 {" ".join(fixed_s)}')
        print(f'    锚点改到原装位置 {len(fixed_a)} 帧；对不齐（IoU < {IOU_OK}，姿势差得多）{len(low)} 帧 {" ".join(low)}')
    return rep

def main():
    args = sys.argv[1:]; apply = '--apply' in args; rp = None
    if apply: args.remove('--apply')
    if '--report' in args: i = args.index('--report'); rp = args[i + 1]; del args[i:i + 2]
    only = None
    if '--frames' in args: i = args.index('--frames'); only = set(args[i + 1].split(',')); del args[i:i + 2]   # 只改这几帧（新加的帧；系统比例仍按全部帧算）
    rep = []
    for sid in args: rep += run(sid, apply, only)
    if rp: json.dump(rep, open(rp, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
