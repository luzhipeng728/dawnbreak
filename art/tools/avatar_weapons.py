#!/usr/bin/env python3
"""外观与换装：武器图表 → art/final/weapon/<key>.webp + src/content/avatar/weapon_art.js（握点 / 尖端数据）
  avatar_weapons.py [表名前缀...]
武器图横放、握柄在左、尖端 / 枪口在右（art/tools/avatar_gen.py weapons 生成，原图在主仓库 art/src/avatar/weapons/）。
握点自动求（按武器类别），需要微调的写在 art/tools/avatar_weapons.json：{ "<key>": { "gx": 0.3, "gy": 0.5 } }（相对图片宽高）。
图片按“握点→尖端 = SIZE × 1.25 像素”缩放保存，运行时再缩到 SIZE（角色帧像素，res 1.8）。
预览写到主仓库 art/src/avatar/cut/weapons_<表>.png（黄圈 = 握点，红线 = 朝向）。
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components, fill_holes
from avatar_gen import WEAPON_SHEETS, OUT
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(HERE)
FIXF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'avatar_weapons.json')
LAST = {k: n for n, its in WEAPON_SHEETS.items() for k, _, _ in its}   # 同一把武器出现在多张表里时，用最后那张
OVER = 1.25   # 图片比游戏里画出来的大一点，缩小绘制更清晰

# 在角色帧里的长度（握点→尖端，帧像素）。太刀 ≈ 原来画死在帧里的太刀长度
SIZE = {'shortsword': 72, 'katana': 100, 'club': 70, 'greatsword': 112, 'lightsaber': 98,
        'revolver': 40, 'autopistol': 38, 'rifle': 70, 'handcannon': 52, 'bowgun': 50,
        'spear': 95, 'pole': 85, 'rod': 50, 'staff': 88, 'broom': 88}   # 长杆（握点在图里 35% 处）：全长 ≈ size / 0.65，画的时候再按占位棍截短
# 握法：grip = 握点在握柄上（剑、枪、魔杖）；tip = 长杆按杖头对齐（魔法师的长武器，握在杆子中段哪里都行）
KIND = {'shortsword': 'blade', 'katana': 'blade', 'greatsword': 'blade', 'lightsaber': 'saber', 'club': 'club',
        'revolver': 'gun', 'autopistol': 'gun', 'handcannon': 'gun', 'bowgun': 'gun', 'rifle': 'rifle',
        'spear': 'pole', 'pole': 'pole', 'staff': 'pole', 'broom': 'pole', 'rod': 'rod'}
SINGLE = {'rifle', 'handcannon', 'bowgun'}   # 长枪 / 手炮 / 手弩不双持：双枪帧里只画主手那把
EP_TYPE = {'ep_shortsword': 'shortsword', 'ep_katana': 'katana', 'ep_katana2': 'katana', 'ep_club': 'club', 'ep_greatsword': 'greatsword', 'ep_lightsaber': 'lightsaber',
           'ep_revolver': 'revolver', 'ep_autopistol': 'autopistol', 'ep_rifle': 'rifle', 'ep_handcannon': 'handcannon', 'ep_bowgun': 'bowgun',
           'ep_spear': 'spear', 'ep_pole': 'pole', 'ep_rod': 'rod', 'ep_staff': 'staff', 'ep_broom': 'broom'}

def cut_rows(path, n):
    a = np.array(remove_bg(Image.open(path))); drop_holes(a)   # 扳机护圈、弩弦里围住的白底也去掉
    lab, comps = components(a[..., 3], min_cells=6)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'x0': xs.min(), 'x1': xs.max() + 1, 'y0': ys.min(), 'y1': ys.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); big, small = boxes[:n], boxes[n:]
    for s in small:   # 小碎块（挂饰、宝石）并进最近的武器；在武器外框左右两边以外的（枪口的光点）丢掉
        cy, cx = (s['y0'] + s['y1']) / 2, (s['x0'] + s['x1']) / 2
        b = min(big, key=lambda b: 0 if b['y0'] <= cy <= b['y1'] else min(abs(cy - b['y0']), abs(cy - b['y1'])))
        if not (b['y0'] - 10 <= cy <= b['y1'] + 10) or not (b['x0'] <= cx <= b['x1']): continue
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    big.sort(key=lambda b: b['y0'])
    out = []
    for b in big:
        sub = a[b['y0']:b['y1'], b['x0']:b['x1']].copy(); L = lab[b['y0']:b['y1'], b['x0']:b['x1']]
        solo = sub.copy(); solo[..., 3] = np.where(L == b['ids'][0], sub[..., 3], 0)   # 只要主体（手工修正 solo 用）
        sub[..., 3] = np.where(np.isin(L, b['ids']), sub[..., 3], 0)
        out.append((sub, solo))
    return out

def dil(m, r=1):
    o = m.copy()
    for _ in range(r):
        q = o.copy(); q[1:] |= o[:-1]; q[:-1] |= o[1:]; q[:, 1:] |= o[:, :-1]; q[:, :-1] |= o[:, 1:]; o = q
    return o

def drop_holes(a, min_area=40):
    """被围住的白底（扳机护圈、弩弦里面）挖掉；外圈是深色描边才算，外圈浅色的是高光 / 白色羽毛，保留"""
    rgb = a[..., :3].astype(np.int16); W = (rgb.min(-1) >= 240) & (rgb.max(-1) - rgb.min(-1) <= 14) & (a[..., 3] > 0)
    lab, comps = components((W * 255).astype(np.uint8), f=1, min_cells=min_area)
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    for c, _ in comps:
        reg = lab == c; ring = dil(reg, 4) & ~dil(reg, 1) & (a[..., 3] > 0) & ~W
        if ring.sum() < 10: continue
        dark, light = (lum[ring] < 90).mean(), (lum[ring] > 150).mean()
        if dark > 0.3 and light < 0.5:
            grow = reg.copy(); L = (rgb.min(-1) >= 210) & (a[..., 3] > 0)
            for _ in range(2): grow |= dil(grow) & L
            a[..., 3] = np.where(grow, 0, a[..., 3])

def profile(al):
    """每列的上下边界（没有像素的列为 nan）"""
    m = al > 60; H, W = m.shape
    has = m.any(0); top = np.where(has, m.argmax(0), np.nan).astype(float); bot = np.where(has, H - 1 - m[::-1].argmax(0), np.nan).astype(float)
    return top, bot

def auto_grip(sub, kind):
    al = sub[..., 3]; H, W = al.shape; top, bot = profile(al); hgt = bot - top + 1; mid = (top + bot) / 2
    if kind == 'blade':
        seg = hgt[int(W * 0.06):int(W * 0.3)]; hh = float(np.nanpercentile(seg, 25))
        x = int(W * 0.06)
        while x < W * 0.5 and not (hgt[x] > 2.0 * hh and x > W * 0.12): x += 1
        guard = x
        # 握柄 = 护手左边、高度不超过握柄粗细的最长一段（跳过圆头柄尾）
        thin = [(not np.isnan(hgt[x])) and hgt[x] <= 1.35 * hh for x in range(guard)]
        best, cur, st = (0, 0), 0, 0
        for x in range(guard + 1):
            if x < guard and thin[x]:
                if cur == 0: st = x
                cur += 1
            else:
                if cur > best[1] - best[0]: best = (st, x)
                cur = 0
        pom, guard = best
        gx = (pom + guard) / 2; gy = float(np.nanmedian(mid[int(pom):int(guard)]))
    elif kind == 'saber':
        gx = W * 0.14; gy = float(np.nanmedian(mid[int(W * 0.05):int(W * 0.3)]))
    elif kind == 'club':
        gx = W * 0.3; gy = float(np.nanmedian(mid[int(W * 0.15):int(W * 0.45)]))
    elif kind == 'rod':
        gx = W * 0.2; gy = float(np.nanmedian(mid[int(W * 0.1):int(W * 0.35)]))
    elif kind == 'pole':
        gy = float(np.nanmedian(mid[int(W * 0.2):int(W * 0.6)])); gx = W * 0.35
    elif kind == 'gun':
        barrel = float(np.nanmedian(mid[int(W * 0.6):int(W * 0.9)])); bb = float(np.nanmedian(bot[int(W * 0.6):int(W * 0.9)]))
        cols = [x for x in range(int(W * 0.5)) if not np.isnan(bot[x]) and bot[x] > bb + H * 0.18]
        gx = float(np.mean(cols)) if cols else W * 0.2; hb = float(np.nanmax(bot[:int(W * 0.5)]))
        gy = barrel + (hb - barrel) * 0.42
    elif kind == 'rifle':
        barrel = float(np.nanmedian(mid[int(W * 0.6):int(W * 0.95)])); gx = W * 0.32; gy = barrel + (bot[int(gx)] - barrel) * 0.35
    return gx, gy

def main():
    pres = sys.argv[1:]
    fixes = json.load(open(FIXF)) if os.path.exists(FIXF) else {}
    outd = os.path.join(HERE, 'final', 'weapon'); os.makedirs(outd, exist_ok=True)
    pv_dir = os.path.join(OUT, 'cut'); os.makedirs(pv_dir, exist_ok=True)
    jsf = os.path.join(ROOT, 'src', 'content', 'avatar', 'weapon_art.js')
    data = {}
    if os.path.exists(jsf):   # 只重切一部分表时保留其他武器的数据
        txt = open(jsf).read(); data = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    for name, items in WEAPON_SHEETS.items():
        if pres and not any(name.startswith(p) for p in pres): continue
        path = os.path.join(OUT, 'weapons', f'{name}.png')
        if not os.path.exists(path): print('缺原图', path); continue
        subs = cut_rows(path, len(items))
        if len(subs) != len(items): print(f'{name}: 切出 {len(subs)} 把，应为 {len(items)}  <-- CHECK')
        tiles = []
        for (key, _, _), (sub, solo) in zip(items, subs):
            if LAST[key] != name: continue   # 后面的表重画过这把（巨剑加厚），以后面的为准
            f = fixes.get(key, {})
            if f.get('solo'):   # 去掉并进来的小碎块（别的武器的火焰碎片等）
                sub = solo; ys, xs = np.where(sub[..., 3] > 40); sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            if 'cut' in f:   # 只保留左边这么多（去掉枪口的火焰等特效）
                sub = sub[:, :int(sub.shape[1] * f['cut'])]; cols = np.where((sub[..., 3] > 40).any(0))[0]; sub = sub[:, :cols.max() + 1]
            wt = EP_TYPE.get(key) or (key.split('_', 1)[1] if '_' in key and key.split('_', 1)[1] in SIZE else key)   # 装扮：<装扮>_<武器类型>
            kind = KIND[wt]; H, W = sub.shape[:2]
            gx, gy = auto_grip(sub, kind)
            if 'gx' in f: gx = f['gx'] * W
            if 'gy' in f: gy = f['gy'] * H
            tx = W - 1.0   # 尖端：最右边
            reach = tx - gx if kind != 'pole' else tx - gx
            size = f.get('size', SIZE[wt]) * (1.0 if key == wt else f.get('mul', 1.05))
            k = size * OVER / reach
            im = Image.fromarray(sub, 'RGBA'); sm = im.resize((max(1, round(W * k)), max(1, round(H * k))), Image.LANCZOS)
            sm.save(os.path.join(outd, f'{key}.webp'), 'WEBP', quality=88, method=6)
            data[key] = {'w': sm.width, 'h': sm.height, 'gx': round(gx * k, 1), 'gy': round(gy * k, 1), 'tx': round(tx * k, 1), 'ty': round(gy * k, 1),
                         'size': round(size, 1), 'kind': kind, 'type': wt}
            if wt in SINGLE: data[key]['dual'] = 0
            tiles.append((key, sm, data[key]))
            print(f'  {key:14s} {sm.width}x{sm.height} 握点 ({gx * k:.0f},{gy * k:.0f}) {kind}')
        # 预览
        Z = 2; wmax = max(t[1].width for t in tiles) * Z + 40; hsum = sum(t[1].height * Z + 30 for t in tiles) + 10
        pv = Image.new('RGBA', (wmax, hsum), (70, 74, 84, 255)); d = ImageDraw.Draw(pv); y = 10
        for key, sm, D in tiles:
            pv.alpha_composite(sm.resize((sm.width * Z, sm.height * Z), Image.NEAREST), (20, y)); gx, gy = 20 + D['gx'] * Z, y + D['gy'] * Z
            d.line([gx, gy, 20 + D['tx'] * Z, gy], fill=(255, 60, 60), width=1); d.ellipse([gx - 6, gy - 6, gx + 6, gy + 6], outline=(255, 230, 0), width=2)
            d.text((22, y), key, fill=(255, 230, 120)); y += sm.height * Z + 30
        pv.save(os.path.join(pv_dir, f'weapons_{name}.png'))
    os.makedirs(os.path.dirname(jsf), exist_ok=True)
    body = ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in sorted(data.items()))
    open(jsf, 'w').write('/* 由 art/tools/avatar_weapons.py 生成，请勿手改（握点微调写在 art/tools/avatar_weapons.json 后重跑）\n'
                         '   武器图 IMG[\'weapon/<key>\']：w h 图片尺寸；gx gy 握点；tx ty 尖端；size 在角色帧里握点→尖端的长度（帧像素）；kind 握法；type 武器类型；dual 0 = 不双持 */\n'
                         'const WEAPON_IMG = {\n' + body + '\n};\n')
    print('->', jsf)

if __name__ == '__main__':
    main()
