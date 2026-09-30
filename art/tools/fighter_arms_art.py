#!/usr/bin/env python3
"""格斗家（男）拳上武器的手臂层（B2 第二版：不再把武器图贴在拳头上，而是让模型把“戴着武器的小臂和拳头”按每一帧的姿势重画）
  fighter_arms_art.py inputs                 从 7 张原装表切出去掉绿棒的 91 个人（原表分辨率），重新排成 6 张 4×4 输入表 → 主仓库 art/src/fighter/arms/in_<A~F>.png + layout.json
  fighter_arms_art.py gen <类型> [表,...]     生图（输入表 + 武器设计图），一次一张 → art/src/fighter/arms/<类型>_<表>.png
  fighter_arms_art.py cut <类型> [表,...]     切回每一帧（按原装同名帧的缩放 / 位置对齐）→ art/src/fighter/arms/<类型>/<帧>.png（整个人，审图 / 抽手臂层用）
  fighter_arms_art.py layer <类型>            抽手臂层（和原装逐像素比，变了的、靠近拳头的那几块）→ art/final/spr/farm_<类型>/<帧>.webp + spr.json
类型：knuckle 手套 / boxing 拳套 / claw 爪 / tonfa 东方棍 / gauntlet 臂铠；表：A~F（ARMS_SHEETS，A = 站立 / 走 / 跑 / 普攻，样表）。
"""
import os, sys, json, argparse
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import fighter_art as FA
from prep import remove_bg, components

HERE = FA.HERE
AD = os.path.join(FA.FS, 'arms')
SPR = os.path.join(HERE, 'final', 'spr')
V2 = os.path.join(FA.SRC, 'avatar', 'weapons2')
ARMS_SHEETS = {
    'A': ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'run1', 'run3', 'run5', 'run7', 'f_jab1', 'f_jab2', 'f_low1', 'f_low2', 'f_mid1', 'f_mid2', 'f_axe2'],
    'B': ['walk2', 'walk4', 'walk6', 'walk8', 'run2', 'run4', 'run6', 'run8', 'f_axe1', 'f_high1', 'f_high2', 'f_shoulder1', 'f_shoulder2', 'f_grab', 'f_knee', 'f_crouch'],
    'C': ['jump1', 'jump2', 'jump3', 'jump4', 'jump5', 'f_jkick1', 'f_jkick2', 'hit1', 'hit2', 'hit3', 'airUp', 'tumble', 'air', 'bounce', 'down', 'getup'],
    'D': ['tech', 'held', 'charge', 'roll', 'victory', 'f_lift', 'f_slam', 'f_spin1', 'f_spin2', 'f_stomp', 'f_dive', 'f_flykick', 'f_palm1', 'f_palm2', 'f_focus', 'f_seal'],
    'E': ['f_quake', 'f_smash', 'fn_meditate', 'fn_ride', 'fn_thrust1', 'fn_thrust2', 'fs_elbow', 'fs_kneekick', 'fs_rush1', 'fs_rush2', 'fs_dashpunch', 'fs_divepunch', 'fb_throw1', 'fb_throw2', 'fb_sidethrow', 'fb_pound1'],
    'F': ['fb_pound2', 'fb_slide', 'fb_chain1', 'fb_chain2', 'fb_taunt', 'fg_scissor', 'fg_swing1', 'fg_swing2', 'fg_press', 'fg_backflip', 'fg_piledrive'],
}
WEAR = {   # 戴法（每一格都照这个画；设计参考 = 第二张图）
    'knuckle': 'a pair of martial-arts fighting gloves (the design in the SECOND image): each glove fits snugly around the clenched fist and the wrist like a real glove, the same size as the fist',
    'boxing': 'a pair of big round padded boxing gloves (the design in the SECOND image): each glove fully encloses the fist and the wrist and is a bit bigger than a bare fist, laced cuff on the wrist',
    'claw': 'a pair of claw gloves (the design in the SECOND image): a fighting glove on each fist with three straight steel blades sticking out forward from the knuckles, pointing the same way as the punch / the forearm',
    'tonfa': 'a pair of tonfas (the design in the SECOND image): each fist grips the short side handle and the long baton lies along the outside of the forearm, the long end reaching back past the elbow and a short end sticking out in front of the fist',
    'gauntlet': 'a pair of heavy armored gauntlets (the design in the SECOND image): each one encloses the whole fist in a big armored steel fist and covers the whole forearm from the knuckles to just below the elbow with plated armor',
}

def prompt(t):
    return ('The FIRST image is a 2D game sprite sheet (4x4 grid, 16 frames) of a chibi martial artist whose fists and forearms are wrapped in cream cloth bandages. '
            'The SECOND image is only a design reference for a weapon. Redraw the FIRST image EXACTLY: the same 4x4 layout, the same 16 poses, the same positions and sizes of every figure, '
            'the same character, face, hair, clothes, colors, line art and cute chibi art style, and the same plain pure white background. Change ONLY his hands and forearms: '
            f'in EVERY frame he now wears {WEAR[t]}. Each weapon sits exactly where the original fist is, at the original size and angle of the fist, following the direction of the forearm, '
            'so that no bare or bandaged fist is visible anymore (the bandages on the forearm above the weapon may still show). '
            'The near arm is in front of the body; the far arm stays behind the body exactly like the original far arm: parts of the far hand that were hidden behind the body, the head or the near arm stay hidden. '
            'An open hand (fingers spread, a palm strike) keeps the weapon on the hand with the palm open. Do not move, add or remove anything else. No effects, no motion lines, no text.')

def sheet_names():
    import frames2   # noqa: F401  （avatar_frames 需要）
    return FA.SHEETS

def _patch():
    import avatar_frames as AF, frames as FR
    FR.HEIGHT['fighter'] = FA.HEIGHT; AF.cut_boxes = FA.cut16; AF.stick_groups = FA.stick_groups
    return AF

def subs():
    """原装 91 个人（去绿棒、原表分辨率）→ arms/subs/<帧>.png（缓存）"""
    d = os.path.join(AD, 'subs'); os.makedirs(d, exist_ok=True)
    need = [f for L in ARMS_SHEETS.values() for f in L if not os.path.exists(os.path.join(d, f + '.png'))]
    if not need: return d
    AF = _patch(); meta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json'))); fixes = json.load(open(AF.FIX)) if os.path.exists(AF.FIX) else {}
    for t in ('move', 'combo', 'walk', 'react', 'base2', 'base3', 'jobs'):
        fn = [f for f, _, _ in FA.SHEETS[t]]
        if not any(f in need for f in fn if f): continue
        fr, _, _, _ = AF.process_sheet('fighter', t, FA.sheet_path(t), fn, meta['res'], fixes, None)
        FA.fist_sticks(fr, t); FA.clean_frames(fr)
        for f, F in fr.items():
            if f in need: Image.fromarray(F['sub'], 'RGBA').save(os.path.join(d, f + '.png'))
    return d

def cmd_inputs():
    d = subs(); lay = {}
    for S, L in ARMS_SHEETS.items():
        cv = Image.new('RGB', (2048, 2048), 'white'); lay[S] = {}
        for c, f in enumerate(L):
            im = Image.open(os.path.join(d, f + '.png')).convert('RGBA'); s = min(1.0, 470 / im.width, 480 / im.height)
            if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            cx, cy = (c % 4) * 512, (c // 4) * 512; x = cx + (512 - im.width) // 2; y = cy + 500 - im.height
            cv.paste(im, (x, y), im); lay[S][f] = {'cell': c, 's': s, 'x': x, 'y': y, 'w': im.width, 'h': im.height}
        os.makedirs(AD, exist_ok=True); cv.save(os.path.join(AD, f'in_{S}.png')); print(os.path.join(AD, f'in_{S}.png'))
    json.dump(lay, open(os.path.join(AD, 'layout.json'), 'w'), indent=1)

def cmd_gen(t, sheets, force):
    for S in sheets:
        print(FA.gen(os.path.join(AD, f'{t}_{S}.png'), prompt(t), [os.path.join(AD, f'in_{S}.png'), os.path.join(V2, f'{t}.png')], '2048x2048', force), flush=True)

def cmd_cut(t, sheets):
    """每格：去白底 → 这一格里的那个人 → 按原装同名帧的缩放（原表像素 → 帧像素）缩到帧大小 → 和原装帧对齐（位置 + ±8% 缩放）"""
    import avatar_align as AL, fighter_looks_art as LA
    lay = json.load(open(os.path.join(AD, 'layout.json'))); bscale = LA.base_scale(); bmeta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json')))['frames']
    od = os.path.join(AD, t); os.makedirs(od, exist_ok=True); rep = {}
    for S in sheets:
        p = os.path.join(AD, f'{t}_{S}.png')
        if not os.path.exists(p): print('没有', p); continue
        a = np.array(remove_bg(Image.open(p)))
        for f, L in lay[S].items():
            c = L['cell']; X0, Y0 = (c % 4) * 512, (c // 4) * 512
            sub = a[Y0:Y0 + 512, X0:X0 + 512].copy(); lab, comps = components(sub[..., 3], min_cells=6)
            if not comps: continue
            big = max(n for _, n in comps); keep = [k for k, n in comps if n >= big * 0.03]
            sub[..., 3] = np.where(np.isin(lab, keep), sub[..., 3], 0); ys, xs = np.where(sub[..., 3] > 40); sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            k = bscale[f] / L['s']; im = Image.fromarray(sub, 'RGBA'); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            B = bmeta[f]; bim = Image.open(os.path.join(SPR, 'fighter', f + '.webp')).convert('RGBA')
            s, tx, ty, iou = AL.align(LA._mask(np.array(bim)), LA._mask(np.array(im)), np.arange(0.92, 1.081, 0.02))
            if abs(s - 1) > 0.02:
                im = im.resize((max(1, round(im.width / s)), max(1, round(im.height / s))), Image.LANCZOS); _, tx, ty, iou = AL.align(LA._mask(np.array(bim)), LA._mask(np.array(im)), np.array([1.0])); s = 1.0
            ax, ay = B['ax'] + tx, B['ay'] + ty   # 这张图里和原装脚底锚点对应的位置
            im.save(os.path.join(od, f + '.png')); rep[f] = {'ax': round(ax, 1), 'ay': round(ay, 1), 'w': im.width, 'h': im.height, 'iou': round(iou, 3)}
        print(f'  {t}/{S}: {len(lay[S])} 帧')
    mp = os.path.join(od, 'cut.json'); old = json.load(open(mp)) if os.path.exists(mp) else {}; old.update(rep); json.dump(old, open(mp, 'w'), indent=1)
    low = [f'{f}({r["iou"]})' for f, r in rep.items() if r['iou'] < 0.7]; print('  和原装轮廓重合度 < 0.7：', ' '.join(low) or '无')

GLOVE_SCALE = {'knuckle': 1.15}   # 手套类型的手套放大倍数（拳套本来就大、臂铠 / 爪 / 东方棍不放大）

def dil(m, r=1):
    o = m.copy()
    for _ in range(r):
        q = o.copy(); q[1:] |= o[:-1]; q[:-1] |= o[1:]; q[:, 1:] |= o[:, :-1]; q[:, :-1] |= o[:, 1:]; o = q
    return o
def ero(m, r=1): return ~dil(~m, r)

def hand_mask(B, b, R=24):
    """原装帧里的手（拳头 + 绑带 + 手腕，锚点 R 以内）：从拳头锚点往外按浅色暖色像素长，脸一框不算、腐蚀一圈断开贴着脸 / 另一只手的桥（同 avatar.js avFists）"""
    H, W = b.shape[:2]; rgb = b[..., :3].astype(int); mx = rgb.max(-1); sat = np.where(mx > 0, (mx - rgb.min(-1)) / np.maximum(mx, 1), 0)
    L1 = (b[..., 3] >= 128) & (mx >= 140) & (sat < 0.45) & (rgb[..., 0] >= rgb[..., 2]); L2 = (b[..., 3] >= 128) & (mx >= 95) & (sat < 0.65) & (rgb[..., 0] >= rgb[..., 2])
    ys, xs = np.mgrid[0:H, 0:W]; hd = B.get('head'); face = np.zeros((H, W), bool)
    if hd:
        a = -(hd.get('a') or 0); dx, dy = xs - hd['x'], ys - hd['y']; lx = dx * np.cos(a) - dy * np.sin(a); ly = dx * np.sin(a) + dy * np.cos(a)
        face = (lx > -14) & (lx < 38) & (ly > -4) & (ly < 44)
    E = ero(L1, 1); out = np.zeros((H, W), bool); anchors = [B[k] for k in ('wpn', 'wpn2') if k in B]
    for i, w in enumerate(anchors):
        d2 = (xs - w['gx']) ** 2 + (ys - w['gy']) ** 2
        mine = np.ones((H, W), bool)
        for j, o in enumerate(anchors):
            if j != i: mine &= d2 <= (xs - o['gx']) ** 2 + (ys - o['gy']) ** 2 + 30
        ok = (d2 <= R * R) & ~face & mine
        seed = E & ok & (d2 <= 64)
        if not seed.any(): continue
        m = seed.copy()
        while True:
            g = dil(m, 1) & E & ok
            if (g == m).all(): break
            m = g
        m = dil(m, 2) & L2 & ok
        out |= m
    return out

def arm_layer(f, B, b, w, C, t):
    """武器帧（整个人）→ 手臂层：和原装同名帧逐像素比（对齐到原装坐标），变了的地方（武器）里靠近拳头锚点的那几块 + 一圈描边。
    返回原装坐标里的 RGBA（没有 = None）"""
    H, W = b.shape[:2]; dx, dy = round(C['ax'] - B['ax']), round(C['ay'] - B['ay'])
    ys, xs = np.mgrid[0:H, 0:W]; wy, wx = ys + dy, xs + dx; ok = (wy >= 0) & (wy < w.shape[0]) & (wx >= 0) & (wx < w.shape[1])
    wb = np.zeros_like(w[:1, :1]).repeat(H, 0).repeat(W, 1); wb[ok] = w[wy[ok], wx[ok]]
    rgb = wb[..., :3].astype(int); white = (rgb.min(-1) >= 232) & (rgb.max(-1) - rgb.min(-1) <= 18)
    D = np.sqrt(((rgb - b[..., :3].astype(int)) ** 2).sum(-1)); D = np.where(b[..., 3] < 128, 255, D)   # 原来是空白、现在有东西 = 变了
    mxv = rgb.max(-1); satv = np.where(mxv > 0, (mxv - rgb.min(-1)) / np.maximum(mxv, 1), 0)
    dark = (mxv < 56) & (satv < 0.5)   # 黑裤子 / 黑腰带 / 描边：只当武器的描边（核心外面两圈）收，不整块收（手垂在腰边时模型重画的腰带会被当成“变了”）
    G = (D > 60) & (wb[..., 3] > 128) & ~white & ~dark
    G = dil(ero(G, 1), 1)   # 去掉重画带来的细线差异
    anchors = [B[k] for k in ('wpn', 'wpn2') if k in B]
    if not anchors: return None
    R = 48 if t in ('gauntlet', 'tonfa') else 40
    near = np.zeros((H, W), bool)
    for a_ in anchors: near |= (xs - a_['gx']) ** 2 + (ys - a_['gy']) ** 2 <= R * R
    lab, comps = components((G * 255).astype(np.uint8), f=1, min_cells=40)
    keep = [c for c, n in comps if (near[lab == c]).mean() >= 0.3]
    if not keep: return None
    m = np.isin(lab, keep)
    m = ero(dil(m, 3), 3) & (wb[..., 3] > 0) & ~white   # 补洞、连起来
    mx = rgb.max(-1); sat = np.where(mx > 0, (mx - rgb.min(-1)) / np.maximum(mx, 1), 0); r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g_ - b_), 2 * r_ - g_ - b_)) % 360
    skin = (mx >= 140) & (sat >= 0.07) & (sat < 0.45) & (r_ >= b_) & (hue > 8) & (hue < 48)   # 绑带 / 皮肤：原装帧里本来就有（前臂留原装的），不进手臂层
    m &= ~skin
    lab2, comps2 = components((m * 255).astype(np.uint8), f=1, min_cells=1); m = np.isin(lab2, [c for c, n in comps2 if n >= 30])
    m = dil(m, 2) & (wb[..., 3] > 0) & ~white & (m | dark | (D > 40))   # 外面两圈：武器自己的描边
    hm = hand_mask(B, b)   # 原装的手整只换掉：这些像素一律用重画的图（重画图这里是空白 = 手本来就不在这了，运行时这里的原装手被 avFists 抹掉）
    m |= dil(hm, 1) & (wb[..., 3] > 0) & ~white
    out = wb.copy(); out[..., 3] = np.where(m, wb[..., 3], 0)
    # 去白边：贴着透明的浅色像素（重画图去白底留下的一圈、半透明的浅色）去掉，两遍
    for _ in range(2):
        a_ = out[..., 3] > 0; edge = a_ & ~ero(a_, 1); c3 = out[..., :3].astype(int); mxc = c3.max(-1); satc = np.where(mxc > 0, (mxc - c3.min(-1)) / np.maximum(mxc, 1), 0)
        fr = edge & (((mxc >= 200) & (satc < 0.2)) | ((out[..., 3] < 200) & (mxc >= 150)))
        out[..., 3] = np.where(fr, 0, out[..., 3])
    k = GLOVE_SCALE.get(t)
    if k:   # 手套画得和拳头一样大，1 倍下显小：每只手的手套（离锚点 20 以内的非皮肤像素）绕自己的中心放大一点，叠在原来的上面
        rgb2 = out[..., :3].astype(int); mx2 = rgb2.max(-1); s2 = np.where(mx2 > 0, (mx2 - rgb2.min(-1)) / np.maximum(mx2, 1), 0)
        hue2 = np.degrees(np.arctan2(np.sqrt(3) * (rgb2[..., 1] - rgb2[..., 2]), 2 * rgb2[..., 0] - rgb2[..., 1] - rgb2[..., 2])) % 360
        skin2 = (mx2 >= 140) & (s2 >= 0.07) & (s2 < 0.45) & (rgb2[..., 0] >= rgb2[..., 2]) & (hue2 > 8) & (hue2 < 48)
        big = out.copy(); big[..., 3] = 0; Hh, Ww = out.shape[:2]
        for a2 in anchors:
            g = (out[..., 3] > 0) & ~skin2 & ((xs - a2['gx']) ** 2 + (ys - a2['gy']) ** 2 <= 400)
            if g.sum() < 30: continue
            yy, xx = np.where(g); cx, cy = xx.mean(), yy.mean(); x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
            crop = out[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(g[y0:y1, x0:x1], crop[..., 3], 0)
            im = Image.fromarray(crop, 'RGBA'); w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k)); im = im.resize((w2, h2), Image.LANCZOS)
            px, py = round(cx - (cx - x0) * k), round(cy - (cy - y0) * k)
            layer = Image.new('RGBA', (Ww, Hh)); layer.paste(im, (px, py)); big = np.array(Image.alpha_composite(Image.fromarray(big, 'RGBA'), layer))
        out = np.array(Image.alpha_composite(Image.fromarray(out, 'RGBA'), Image.fromarray(big, 'RGBA')))
    return out

def cmd_layer(t):
    """切好的武器帧 → 手臂层 art/final/spr/farm_<类型>/<帧>.webp + spr.json（w h ax ay：脚底锚点在这张小图里的位置，和原装帧对齐）"""
    od = os.path.join(SPR, f'farm_{t}'); os.makedirs(od, exist_ok=True); src = os.path.join(AD, t)
    cut = json.load(open(os.path.join(src, 'cut.json'))); bmeta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json')))
    mp = os.path.join(od, 'spr.json'); meta = json.load(open(mp)) if os.path.exists(mp) else {'res': bmeta['res'], 'frames': {}}; n = 0
    none = set(meta.get('none', []))   # 做过、但两只拳都被挡住（没有手臂层）的帧：运行时照原帧画；没做过的帧退回贴武器图
    for f, C in cut.items():
        B = bmeta['frames'][f]; b = np.array(Image.open(os.path.join(SPR, 'fighter', f + '.webp')).convert('RGBA')); w = np.array(Image.open(os.path.join(src, f + '.png')).convert('RGBA'))
        L = arm_layer(f, B, b, w, C, t)
        if L is None: meta['frames'].pop(f, None); none.add(f); continue
        none.discard(f)
        ys, xs = np.where(L[..., 3] > 0); x0, y0 = xs.min(), ys.min(); sub = L[y0:ys.max() + 1, x0:xs.max() + 1]
        Image.fromarray(sub, 'RGBA').save(os.path.join(od, f + '.webp'), 'WEBP', quality=86, method=6)
        meta['frames'][f] = {'w': sub.shape[1], 'h': sub.shape[0], 'ax': round(B['ax'] - x0, 1), 'ay': round(B['ay'] - y0, 1)}; n += 1
    meta['frames'] = dict(sorted(meta['frames'].items())); meta['none'] = sorted(none); json.dump(meta, open(mp, 'w'), indent=1); print(f'  farm_{t}: {n} 帧手臂层，{len(none)} 帧两只拳都被挡住')

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('type', nargs='?', default=''); ap.add_argument('sheets', nargs='?', default=''); ap.add_argument('--force', action='store_true')
    a = ap.parse_args(); S = [s for s in a.sheets.split(',') if s] or list(ARMS_SHEETS)
    if a.cmd == 'inputs': return cmd_inputs()
    if a.cmd == 'gen': return cmd_gen(a.type, S, a.force)
    if a.cmd == 'cut': return cmd_cut(a.type, S)
    if a.cmd == 'layer': return cmd_layer(a.type)
    sys.exit('cmd: inputs | gen <类型> [表] | cut <类型> [表] | layer <类型>')

if __name__ == '__main__':
    main()
