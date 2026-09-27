#!/usr/bin/env python3
"""把拆好的部件装配成骨骼角色：自动找关节点（可在 spec 里手动覆盖），推导骨骼尺寸，输出 WebP + 装配数据。

spec（art/rigs/<name>.json）：
{ "cut": "proto/sword_cut", "height": 118,
  "parts": { "torso": {"i":1, "hip":[.55,.9], "neck":[.62,.08], "shoulder":[.2,.24], "waist":[.55,.72]},
             "head": {"i":5, "neck":[.6,.97]}, "ua": {"i":4}, "fa": {"i":7}, "th": {"i":3}, "sh": {"i":6},
             "ft": {"i":9}, "weapon": {"i":8, "grip":[.5,.07]}, "skirt": {"i":0}, "scarf": {"i":2, "holes":true, "at":[.3,.12]} } }
坐标写成 0..1 的相对值（相对部件自身宽高），省略时按规则自动检测。
输出：art/final/<name>/*.webp 与 art/final/<name>/rig.json；--debug 生成标注图。
"""
import sys, os, json, math, argparse
import numpy as np
from PIL import Image, ImageDraw

RES = 3.0   # 最终贴图：每个世界单位 3 像素（游戏以 2 倍分辨率渲染，留一点余量）

def span(alpha, y, thr=60):
    xs = np.where(alpha[int(np.clip(y, 0, alpha.shape[0] - 1))] > thr)[0]
    return (xs.min(), xs.max()) if len(xs) else (alpha.shape[1] / 2, alpha.shape[1] / 2)

def mid(alpha, y):
    a, b = span(alpha, y); return ((a + b) / 2, b - a)

def limb_points(alpha, grip=False):
    """竖直肢体：上端关节在顶部向下半个宽度处，下端关节在底部向上半个宽度处。"""
    h = alpha.shape[0]
    x0, w0 = mid(alpha, h * 0.06)
    top = (mid(alpha, w0 * 0.45)[0], w0 * 0.45)
    if grip:   # 前臂 + 拳头：握点在拳头中心
        yb = h * 0.84; return top, (mid(alpha, yb)[0], yb)
    x1, w1 = mid(alpha, h * 0.94)
    yb = h - w1 * 0.45
    return top, (mid(alpha, yb)[0], yb)

def rel(p, im): return (p[0] * im.width, p[1] * im.height)

def load(cut, i, holes=False):
    if isinstance(i, list):   # 多个连通块合成一个部件（按它们在原图里的位置拼回去）
        info = {p['i']: p for p in json.load(open(f'{cut}/_parts.json'))}
        x0 = min(info[j]['x'] for j in i); y0 = min(info[j]['y'] for j in i)
        x1 = max(info[j]['x'] + info[j]['w'] for j in i); y1 = max(info[j]['y'] + info[j]['h'] for j in i)
        im = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
        for j in i: pj = Image.open(f'{cut}/part_{j:02d}.png').convert('RGBA'); im.alpha_composite(pj, (info[j]['x'] - x0, info[j]['y'] - y0))
    else:
        im = Image.open(f'{cut}/part_{i:02d}.png').convert('RGBA')
    if holes:   # 封闭的纯白小洞（比如破损布料里露出的白底）也抠掉
        a = np.array(im); w = (a[..., :3].min(-1) >= 246)
        a[..., 3] = np.where(w, 0, a[..., 3]); im = Image.fromarray(a, 'RGBA')
    return im

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('spec'); ap.add_argument('--debug', action='store_true'); a = ap.parse_args()
    spec = json.load(open(a.spec)); name = os.path.splitext(os.path.basename(a.spec))[0]
    base = os.path.dirname(os.path.dirname(os.path.abspath(a.spec)))
    cut = os.path.join(base, spec['cut']); P = spec['parts']
    ims, pts = {}, {}
    for k, d in P.items():
        im = load(cut, d['i'], d.get('holes')); ims[k] = im; al = np.array(im)[..., 3]
        q = {}
        if k in ('ua', 'th', 'sh', 'fa'):
            q['a'], q['b'] = limb_points(al, grip=(k == 'fa'))
        if k == 'ft':
            x, w = mid(al, im.height * 0.06); q['a'] = (x, im.height * 0.16); q['sole'] = im.height * 0.97
        if k == 'head':
            x, w = mid(al, im.height * 0.97); q['neck'] = (x, im.height * 0.95)
        if k in ('weapon', 'weaponB'):
            q['grip'] = (mid(al, im.height * 0.07)[0], im.height * 0.07)
        if k == 'skirt':
            q['top'] = (mid(al, im.height * 0.02)[0], im.height * 0.02)
        for key in ('hip', 'neck', 'shoulder', 'waist', 'grip', 'top', 'at', 'a', 'b'):
            if key in d: q[key] = rel(d[key], im)
        if 'sole' in d: q['sole'] = d['sole'] * im.height
        pts[k] = q
    D = lambda p, q: math.hypot(p[0] - q[0], p[1] - q[1])
    T, H = pts['torso'], pts['head']
    # 身高（像素）：脚底→脚踝 + 小腿 + 大腿 + 髋→颈（竖直） + 颈→头顶
    foot_h = pts['ft']['sole'] - pts['ft']['a'][1]
    px_h = foot_h + D(*[pts['sh']['a'], pts['sh']['b']]) + D(pts['th']['a'], pts['th']['b']) + (T['hip'][1] - T['neck'][1]) + H['neck'][1]
    k = spec.get('height', 118) / px_h
    S = {
        'ua': D(pts['ua']['a'], pts['ua']['b']) * k, 'fa': D(pts['fa']['a'], pts['fa']['b']) * k,
        'th': D(pts['th']['a'], pts['th']['b']) * k, 'sh': D(pts['sh']['a'], pts['sh']['b']) * k,
        'torso': (T['hip'][1] - T['neck'][1]) * k, 'footH': foot_h * k,
        # 躯干骨骼局部坐标：原点在髋，+y 向上，+x 指向身后
        'neckX': -(T['neck'][0] - T['hip'][0]) * k, 'shX': -(T['shoulder'][0] - T['hip'][0]) * k, 'shY': -(T['shoulder'][1] - T['hip'][1]) * k,
        'hipX': spec.get('hipX', 2.5), 'headH': H['neck'][1] * k,
    }
    S['hipY'] = S['th'] + S['sh'] + S['footH']
    out_dir = os.path.join(base, 'final', name); os.makedirs(out_dir, exist_ok=True)
    rig = {'skel': {kk: round(v, 2) for kk, v in S.items()}, 'parts': {}}
    s = RES * k
    hs = spec.get('headScale', 1.2)   # Q 版：头再放大一点更可爱
    S['headH'] = round(S['headH'] * hs, 2); rig['skel']['headH'] = S['headH']
    for kk, im in ims.items():
        sk = s * (hs if kk in ('head', 'hair') else 1)
        W, Hh = max(1, round(im.width * sk)), max(1, round(im.height * sk))
        sm = im.resize((W, Hh), Image.LANCZOS)
        sm.save(os.path.join(out_dir, f'{kk}.webp'), 'WEBP', quality=90, method=6)
        q = pts[kk]
        piv = q.get('a') or q.get('hip') or q.get('neck') or q.get('grip') or q.get('top') or q.get('at') or (im.width / 2, 0)
        e = {'w': W, 'h': Hh, 'px': round(piv[0] * sk, 1), 'py': round(piv[1] * sk, 1)}
        if kk == 'torso' and 'waist' in q: e['waist'] = [round((q['waist'][0] - T['hip'][0]) * k, 2), round((q['waist'][1] - T['hip'][1]) * k, 2)]
        if kk == 'torso': e['neckPt'] = [round((T['neck'][0] - T['hip'][0]) * k, 2), round((T['neck'][1] - T['hip'][1]) * k, 2)]
        rig['parts'][kk] = e
    for kk, d in P.items():
        if 'rot' in d: rig['parts'][kk]['rot'] = d['rot']
        if 'on' in d:   # 挂在头上的部件（马尾等）：在头图上的位置 → 相对颈根的世界坐标偏移
            hp = rel(d['on'], ims['head']); rig['parts'][kk]['at'] = [round((hp[0] - H['neck'][0]) * k * hs, 2), round((hp[1] - H['neck'][1]) * k * hs, 2)]   # 静止时的额外转角（弧度），比如让围巾往后扬
    rig['k'] = k; rig['res'] = RES
    json.dump(rig, open(os.path.join(out_dir, 'rig.json'), 'w'), indent=1)
    print(json.dumps(rig['skel']))
    if a.debug:   # 标注图：每个部件上画出检测到的关节点
        tiles = []
        for kk, im in ims.items():
            t = Image.new('RGB', (im.width + 20, im.height + 40), (50, 54, 62)); t.paste(im, (10, 30), im)
            d = ImageDraw.Draw(t); d.text((10, 6), kk, fill=(255, 230, 90))
            for key, p in pts[kk].items():
                if isinstance(p, tuple) or isinstance(p, list):
                    x, y = p[0] + 10, p[1] + 30; d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 40, 40), width=4); d.text((x + 11, y - 8), key, fill=(255, 90, 90))
            tiles.append(t)
        Wt = sum(t.width for t in tiles); Ht = max(t.height for t in tiles)
        sheet = Image.new('RGB', (Wt, Ht), (30, 30, 36)); x = 0
        for t in tiles: sheet.paste(t, (x, 0)); x += t.width
        sheet.thumbnail((2400, 900)); sheet.save(os.path.join(out_dir, '_debug.png'))

if __name__ == '__main__':
    main()
