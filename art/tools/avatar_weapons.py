#!/usr/bin/env python3
"""外观与换装：武器图表 → art/final/weapon/<key>.webp + src/content/avatar/weapon_art.js（握点 / 尖端数据）
  avatar_weapons.py [表名前缀...]
武器图横放、握柄在左、尖端 / 枪口在右（art/tools/avatar_gen.py weapons 生成，原图在主仓库 art/src/avatar/weapons/）。
握点自动求（按武器类别），需要微调的写在 art/tools/avatar_weapons.json：{ "<key>": { "gx": 0.3, "gy": 0.5 } }（相对图片宽高）；
  另可写 size（握点→尖端长度）、mul（相对类型长度的倍数）、wide（只加宽的倍数，如巨剑 1.3）、cut / solo（去掉特效碎块）。
v2（weapon_gen.py）：一把武器一张图 art/src/avatar/weapons2/<key>.png，有就优先用它（json 里 "v2": {...} 是只对 v2 图生效的微调；旧表的 wide / cut / solo 不再生效）。
在手里的长度 = SIZE × HAND（按类型放大，1 倍画面也看得清）× 品级 / 史诗倍数；图片按 OVER 倍存（高分屏也清楚），运行时再缩到这个长度（角色帧像素，res 1.8）。
预览写到主仓库 art/src/avatar/cut/weapons_<表>.png / weapons_v2.png（黄圈 = 握点，红线 = 朝向）。
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
# 格斗家（男）拳上武器 5 类（B2，art/tools/fighter_weapons_art.py 一张表出一组 → weapons2/<key>.png，只有 v2 图）
FIGHTER_W = ('knuckle', 'boxing', 'claw', 'tonfa', 'gauntlet')
from avatar_gen import WEAPON_SKINS as _WSK
LAST.update({k: 'v2' for t in FIGHTER_W for k in [t] + [f'{t}_r{r}' for r in (2, 3, 4)] + [f'{sk}_{t}' for sk in _WSK]})
OVER = 3.0   # 图片按游戏里画出来的 3 倍存：高分屏（2 倍）上还是缩小绘制，线条清楚
V2 = os.path.join(OUT, 'weapons2')

# 在角色帧里的长度（握点→尖端，帧像素）。太刀 ≈ 原来画死在帧里的太刀长度
SIZE = {'shortsword': 72, 'katana': 100, 'club': 70, 'greatsword': 112, 'lightsaber': 98,
        'revolver': 40, 'autopistol': 38, 'rifle': 70, 'handcannon': 52, 'bowgun': 50,
        'spear': 95, 'pole': 85, 'rod': 50, 'staff': 88, 'broom': 88}   # 长杆（握点在图里 35% 处）：全长 ≈ size / 0.65，画的时候再按占位棍截短
# 拿在手里再放大（v2 武器重做：原来 1 倍画面里短剑只有 75 像素，改了设计也看不出来）
HAND = {'shortsword': 1.35, 'katana': 1.35, 'lightsaber': 1.25, 'greatsword': 1.25, 'club': 1.2,
        'revolver': 1.6, 'autopistol': 1.6, 'rifle': 1.2, 'handcannon': 1.25, 'bowgun': 1.25,   # 小手枪 1 倍下原来只有 40 像素，放得最多
        'staff': 1.2, 'rod': 1.3, 'broom': 1.15, 'pole': 1.1, 'spear': 1.1}
SIZE.update({t: 20 for t in FIGHTER_W}); HAND.update({t: 1.0 for t in FIGHTER_W})   # 拳上武器不按 SIZE：大小按拳头高度（FIST_H）/ 全长（TONFA_LEN）定
FIST_H = {'knuckle': 31, 'boxing': 38, 'claw': 29}   # 画出来的拳头高（帧像素；原装空拳约 26）：手套 / 拳套 / 爪盖住拳头要比空拳大一圈
LEN = {'tonfa': 70, 'gauntlet': 82}   # 东方棍 / 臂铠按全长（帧像素；拳头约 26 + 前臂约 40，臂铠的护臂太长会伸到腰上）
COVER = {'glove', 'claw'}   # 盖住拳头画（avatar.js cover）；东方棍握在拳里（盖回握拳像素）
# 握法：grip = 握点在握柄上（剑、枪、魔杖）；tip = 长杆按杖头对齐（魔法师的长武器，握在杆子中段哪里都行）
KIND = {'shortsword': 'blade', 'katana': 'blade', 'greatsword': 'blade', 'lightsaber': 'saber', 'club': 'club',
        'revolver': 'gun', 'autopistol': 'gun', 'handcannon': 'gun', 'bowgun': 'gun', 'rifle': 'rifle',
        'spear': 'pole', 'pole': 'pole', 'staff': 'pole', 'broom': 'pole', 'rod': 'rod',
        'knuckle': 'glove', 'boxing': 'glove', 'gauntlet': 'glove', 'claw': 'claw', 'tonfa': 'tonfa'}
EP2_CODE = {'ss': 'shortsword', 'kt': 'katana', 'cb': 'club', 'gs': 'greatsword', 'ls': 'lightsaber', 'rv': 'revolver', 'ap': 'autopistol', 'rf': 'rifle', 'hc': 'handcannon',
            'bg': 'bowgun', 'sp': 'spear', 'pl': 'pole', 'rd': 'rod', 'st': 'staff', 'br': 'broom', 'kn': 'knuckle', 'bx': 'boxing', 'cl': 'claw', 'tf': 'tonfa', 'ga': 'gauntlet'}   # 第二批史诗：ep_<类型缩写>_<名字>
SINGLE = {'rifle', 'handcannon', 'bowgun'}   # 长枪 / 手炮 / 手弩不双持：双枪帧里只画主手那把
EP_TYPE = {'ep_shortsword': 'shortsword', 'ep_katana': 'katana', 'ep_katana2': 'katana', 'ep_club': 'club', 'ep_greatsword': 'greatsword', 'ep_lightsaber': 'lightsaber',
           'ep_revolver': 'revolver', 'ep_autopistol': 'autopistol', 'ep_rifle': 'rifle', 'ep_handcannon': 'handcannon', 'ep_bowgun': 'bowgun',
           'ep_spear': 'spear', 'ep_pole': 'pole', 'ep_rod': 'rod', 'ep_staff': 'staff', 'ep_broom': 'broom'}

TIER_MUL = {2: 1.02, 3: 1.06, 4: 1.14}   # 普通武器的品级外观 <类型>_r2/r3/r4：稀有 / 神器 / 传说，一级比一级长（传说长 10~15%）
EPIC_MUL = {'greatsword': 1.12, 'revolver': 1.15, 'autopistol': 1.15, 'handcannon': 1.1, 'bowgun': 1.1, 'rod': 1.1}   # 史诗默认比普通武器长 5%；巨剑更夸张，小枪 / 魔杖放大一点才看得清
WIDE = {'katana': 1.2, 'lightsaber': 1.15, 'greatsword': 1.1}   # 史诗 / 品级外观只加宽不加长：太刀、光剑在游戏里别细成一根线
WIDE_V2 = {'katana': 1.25, 'greatsword': 1.25, 'tonfa': 1.35}   # v2 图：太刀刀身画得细，1 倍下像一根线，加宽 25%；巨剑要够厚重（用户：不够霸气），也加宽 25%
def tier_type(key):
    t, _, r = key.rpartition('_r')
    return t if t in SIZE and r in ('2', '3', '4') else None
def default_mul(key, wt):
    if tier_type(key): return TIER_MUL[int(key[-1])]
    return EPIC_MUL.get(wt, 1.05) if key.startswith('ep_') else 1.05

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
    elif kind == 'glove':   # 手套 / 拳套 / 臂铠：拳头在右端，握点 = 拳心（离指节半个拳头高）
        fh = float(np.nanmax(hgt[int(W * 0.6):])); gx = W - 1 - fh * 0.5; gy = float(mid[int(gx)])
    elif kind == 'claw':    # 爪：刀刃段每列有 3 截（刀刃之间有缝），手套段只有 1 截；握点 = 刀刃根部（指节）往回半个拳头高
        m = al > 60; runs = (m[1:] & ~m[:-1]).sum(0) + m[0]
        blade = [x for x in range(int(W * 0.25), W - 5) if (runs[x:x + 6] >= 3).all()]; xk = blade[0] if blade else int(W * 0.5)
        fh = float(np.nanmax(hgt[max(0, int(xk - W * 0.15)):xk])); gx = xk - fh * 0.45; gy = float(mid[int(gx)])
    elif kind == 'tonfa':   # 东方棍：握点在往下伸的握把中段（棍身在握点上方，沿前臂外侧）
        sb = float(np.nanmedian(bot)); sm = float(np.nanmedian(mid))
        cols = [x for x in range(W) if not np.isnan(bot[x]) and bot[x] > sb + H * 0.2]
        gx = float(np.mean(cols)) if cols else W * 0.75; hb = float(np.nanmax(bot[int(min(cols or [gx])):int(max(cols or [gx])) + 1]))
        gy = sm + (hb - sm) * 0.55
    return gx, gy

def fist_h(sub, gx):
    """握点这一列附近的拳头高（原图像素）"""
    top, bot = profile(sub[..., 3]); x0, x1 = max(0, int(gx - 6)), min(sub.shape[1], int(gx + 7))
    return float(np.nanmax(bot[x0:x1] - top[x0:x1] + 1))

import re   # epics3.js 的经典官方史诗没有画师图标：图标由武器图生成，重切时跟着更新（其他史诗的图标不动）
ICON_FROM_ART = set(re.findall(r"EP\('(ep_\w+)'", open(os.path.join(ROOT, 'src', 'content', 'items', 'epics3.js')).read()))
def epic_icon(sub, kind, out):
    """没有专属图标的史诗（epics3.js 新增的官方史诗）：用武器原图斜放 + 金色描光做 128×128 图标，和现有史诗图标同一种摆法"""
    from PIL import ImageFilter
    im = Image.fromarray(sub, 'RGBA'); ang = 18 if kind in ('gun', 'rifle') else 45   # 刀剑 / 长杆斜 45°（尖端朝右上），枪稍微上扬
    im = im.rotate(ang, resample=Image.BICUBIC, expand=True); im = im.crop(im.getbbox())
    k = 112 / max(im.size); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    cv = Image.new('RGBA', (128, 128)); cv.alpha_composite(im, ((128 - im.width) // 2, (128 - im.height) // 2))
    a = cv.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.5))
    glow = Image.new('RGBA', (128, 128), (255, 196, 64, 0)); glow.putalpha(a.point(lambda v: min(255, int(v * 1.1))))
    glow.alpha_composite(cv); glow.save(out, 'WEBP', quality=90, method=6)

def demarker(sub):
    """纯绿 / 品红是切帧工具的标记色：v2 图里零星的品红高光（粉色宝石）压一点蓝，变成玫红"""
    rgb = sub[..., :3].astype(np.int16); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    M = (r > 200) & (b > 200) & (g < 70); rgb[..., 2] = np.where(M, b * 0.8, b)
    G = (g > 200) & (r < 70) & (b < 70); rgb[..., 0] = np.where(G, r + 50, r); rgb[..., 2] = np.where(G, rgb[..., 2] + 50, rgb[..., 2])
    sub[..., :3] = rgb.clip(0, 255).astype(np.uint8); return sub

def weapon_type(key):
    return EP_TYPE.get(key) or EP2_CODE.get(key.split('_')[1] if key.startswith('ep_') else '') or tier_type(key) or (key.split('_', 1)[1] if '_' in key and key.split('_', 1)[1] in SIZE else key)   # 装扮：<装扮>_<武器类型>

def sources(pres, fixes):
    """→ {组名: [(key, 武器图, 微调)]}：有 weapons2/<key>.png 的用它（一把一张，组名 v2），没有的从旧表切。pres：key 或表名前缀"""
    want = lambda key, name='': not pres or any(key.startswith(p) or name.startswith(p) for p in pres)
    v2 = {f[:-4] for f in os.listdir(V2) if f.endswith('.png') and f != 'style_ref.png'} if os.path.isdir(V2) else set()
    out = {}
    for key in sorted(v2):
        if key not in LAST or not want(key): continue
        f = fixes.get(key, {}); f = {**{k: v for k, v in f.items() if k in ('size', 'mul')}, **f.get('v2', {})}
        out.setdefault('v2', []).append((key, demarker(cut_rows(os.path.join(V2, f'{key}.png'), 1)[0][0]), f))
    for name, items in WEAPON_SHEETS.items():
        todo = [k for k, _, _ in items if LAST[k] == name and k not in v2 and want(k, name)]   # 后面的表重画过的（巨剑加厚），以后面的为准
        if not todo: continue
        path = os.path.join(OUT, 'weapons', f'{name}.png')
        if not os.path.exists(path): print('缺原图', path); continue
        subs = cut_rows(path, len(items))
        if len(subs) != len(items): print(f'{name}: 切出 {len(subs)} 把，应为 {len(items)}  <-- CHECK')
        for (key, _, _), (sub, solo) in zip(items, subs):
            if key not in todo: continue
            f = {k: v for k, v in fixes.get(key, {}).items() if k != 'v2'}
            if f.get('solo'):   # 去掉并进来的小碎块（别的武器的火焰碎片等）
                sub = solo; ys, xs = np.where(sub[..., 3] > 40); sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            if 'cut' in f:   # 只保留左边这么多（去掉枪口的火焰等特效）
                sub = sub[:, :int(sub.shape[1] * f['cut'])]; cols = np.where((sub[..., 3] > 40).any(0))[0]; sub = sub[:, :cols.max() + 1]
            out.setdefault(name, []).append((key, sub, f))
    return out

def main():
    pres = sys.argv[1:]
    fixes = json.load(open(FIXF)) if os.path.exists(FIXF) else {}
    outd = os.path.join(HERE, 'final', 'weapon'); os.makedirs(outd, exist_ok=True)
    pv_dir = os.path.join(OUT, 'cut'); os.makedirs(pv_dir, exist_ok=True)
    jsf = os.path.join(ROOT, 'src', 'content', 'avatar', 'weapon_art.js')
    data = {}
    if os.path.exists(jsf):   # 只重切一部分时保留其他武器的数据
        txt = open(jsf).read(); data = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    for name, items in sources(pres, fixes).items():
        tiles = []
        for key, sub, f in items:
            wt = weapon_type(key); kind = KIND[wt]; H, W = sub.shape[:2]
            gx, gy = auto_grip(sub, kind)
            if 'gx' in f: gx = f['gx'] * W
            if 'gy' in f: gy = f['gy'] * H
            tx = W - 1.0   # 尖端：最右边
            reach = tx - gx
            size = f.get('size', SIZE[wt]) * HAND[wt] * (1.0 if key == wt else f.get('mul', default_mul(key, wt)))
            if wt in LEN: size = f.get('len', LEN[wt]) * reach / W
            elif kind in COVER: size = f.get('fist', FIST_H[wt]) * reach / fist_h(sub, gx)   # 拳上武器：按拳头高定大小（品级外观自己画得更大，不另外放大）
            wide = f.get('wide', WIDE_V2.get(wt, 1.0) if name == 'v2' else 1.0 if key == wt else WIDE.get(wt, 1.0))   # wide：只加宽（旧表的细刀身）；v2 图只有太刀加宽一点
            k = size * OVER / reach; ky = k * wide
            im = Image.fromarray(sub, 'RGBA'); sm = im.resize((max(1, round(W * k)), max(1, round(H * ky))), Image.LANCZOS)
            gy *= ky / k
            sm.save(os.path.join(outd, f'{key}.webp'), 'WEBP', quality=86, method=6)
            data[key] = {'w': sm.width, 'h': sm.height, 'gx': round(gx * k, 1), 'gy': round(gy * k, 1), 'tx': round(tx * k, 1), 'ty': round(gy * k, 1),
                         'size': round(size, 1), 'kind': kind, 'type': wt}
            if wt in SINGLE: data[key]['dual'] = 0
            if kind in COVER: data[key]['cover'] = 1
            tiles.append((key, sm, data[key]))
            ic = os.path.join(HERE, 'final', 'icon', f'item_{key}.webp')
            if key.startswith('ep_') and (not os.path.exists(ic) or key in ICON_FROM_ART): epic_icon(sub, kind, ic)
            print(f'  {key:18s} {sm.width}x{sm.height} 握点 ({gx * k:.0f},{gy * k:.0f}) 长度 {size:.0f} {kind}')
        # 预览（缩到一半；黄圈 = 握点，红线 = 朝向）
        Z = 0.5; wmax = int(max(t[1].width for t in tiles) * Z) + 40; hsum = int(sum(t[1].height * Z + 30 for t in tiles)) + 10
        pv = Image.new('RGBA', (wmax, hsum), (70, 74, 84, 255)); d = ImageDraw.Draw(pv); y = 10
        for key, sm, D in tiles:
            pv.alpha_composite(sm.resize((max(1, int(sm.width * Z)), max(1, int(sm.height * Z))), Image.LANCZOS), (20, y)); gx, gy = 20 + D['gx'] * Z, y + D['gy'] * Z
            d.line([gx, gy, 20 + D['tx'] * Z, gy], fill=(255, 60, 60), width=1); d.ellipse([gx - 6, gy - 6, gx + 6, gy + 6], outline=(255, 230, 0), width=2)
            d.text((22, y), key, fill=(255, 230, 120)); y += int(sm.height * Z) + 30
        pv.save(os.path.join(pv_dir, f'weapons_{name}.png'))
    os.makedirs(os.path.dirname(jsf), exist_ok=True)
    body = ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in sorted(data.items()))
    open(jsf, 'w').write('/* 由 art/tools/avatar_weapons.py 生成，请勿手改（握点微调写在 art/tools/avatar_weapons.json 后重跑）\n'
                         '   武器图 IMG[\'weapon/<key>\']：w h 图片尺寸；gx gy 握点；tx ty 尖端；size 在角色帧里握点→尖端的长度（帧像素，已含按类型放大的 HAND）；kind 握法；type 武器类型；dual 0 = 不双持 */\n'
                         'const WEAPON_IMG = {\n' + body + '\n};\n')
    print('->', jsf)

if __name__ == '__main__':
    main()
