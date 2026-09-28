#!/usr/bin/env python3
"""小魔女的召唤物 / 物件美术（魔法师组起稿，小魔女组接手）：疯疯熊、僵尸人偶、林中小屋。流水线同 witch_art.py（sky_art 的参考立绘 → 动作表 → 切帧，支持自定义帧名）。
AI 原图写到主仓库 art/src/ench/；最终 webp 写到本仓库 art/final/spr/<id>/。

  ench_art.py refs|sheets [--only 前缀] [--sheets act,grow]
  ench_art.py cut [--only 前缀]      切帧（本文件的 cut：去掉头顶往上的傀儡线、去掉脱离主体的碎片特效，比例按不含线的身体高度统一；
                                   线的挂点写进 spr.json 的 str，游戏里统一从挂点往天上画，所以每张表的线都一致）
  ench_art.py strip                  游戏比例连拍（最左边放魔法师站姿对照）→ <主仓库>/art/src/ench/_<id>_strip.png
生图配额：小魔女组同时最多 1 个请求，429 退避 65 秒。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import witch_art as W   # 复用自定义帧名的补丁（names_for / sheet_job）
A = W.A
A.SRC = os.path.join(A.MAIN, 'src', 'ench')
A.PAR = 1
A.M = {
    'madbear': dict(h=100, hold=None, sheets=('walk', 'act', 'more'),
        desc='Mad, a big creepy-cute stitched teddy bear puppet: brown fur made of patched fabric with visible cross stitches, mismatched black button eyes, a stitched smile, '
             'one ear half torn and sewn back, a purple patch on the belly, big round paws with sharp little claws, standing upright like a guardian, faint puppet strings from its shoulders.',
        atk='its clawed paws', cast='roaring with both arms raised', low='crouching to leap',
        custom={'act': [('scratch1', 'slashing forward with the right claws, body twisted, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('scratch2', 'slashing forward with the left claws, body twisted the other way, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('punch1', 'pulling one paw back to punch, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('punch2', 'punching forward, the whole forearm shooting forward on a stretched string, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('slam1', 'raising both paws high overhead, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('slam2', 'slamming both paws down onto the ground, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('guard', 'standing in front with both arms spread wide, blocking and protecting, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('hurt', 'flinching backward, a few stitches coming loose, the two thin puppet strings from its shoulders going straight up out of frame as always')],
                'more': [('leap', 'leaping high into the air with arms up, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('fall', 'falling down from the sky belly-first, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('roar', 'roaring with its mouth wide open and both arms raised, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('claw1', 'wild frenzied clawing, a flurry of paws, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('claw2', 'wild frenzied clawing, the other paw, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('idle2', 'sitting lazily with its legs out, head tilted, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('cheer', 'hopping happily with both arms up, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('down', 'lying flat on its back, limp like a doll, the two thin puppet strings from its shoulders going straight up out of frame as always')]}),
    'zombiedoll': dict(h=46, hold=None, sheets=('walk', 'act'),
        desc='A small cursed zombie puppet doll: a pale greenish rag doll with stitched X eyes, a crooked stitched mouth, patched clothes, a big rusty needle stuck in its head, wobbly arms stretched forward.',
        atk='its wobbly arms', cast='swelling up', low='lunging forward',
        # 第 2 版：不画任何发光、烟、火焰、线条特效（爆炸前的紫光由游戏里画）
        custom={'act': [('run1', 'running forward clumsily with arms stretched out, no effects'), ('run2', 'running forward clumsily, other leg, no effects'),
                        ('swell1', 'starting to puff up rounder, cheeks bulging, stitches straining, eyes drawn as spirals, NO glow, NO smoke, NO effects'),
                        ('swell2', 'puffed up very round like a balloon, stitches about to pop, eyes drawn as spirals, NO glow, NO smoke, NO effects'),
                        ('grab', 'hugging onto something tightly, no effects'), ('fall', 'tripping and falling flat, no effects'),
                        ('idle2', 'standing and swaying creepily, no effects'), ('cheer', 'waving both arms, no effects')]}),
    'thornhut': dict(h=120, hold=None, sheets=('act', 'grow'), holes=False,
        desc='A small creepy-cute witch hut made of twisting black thorny vines and dark wood planks, a round door with a glowing violet keyhole, red roses growing on the roof, a crooked little chimney, NO person.',
        custom={'act': [('idle', 'standing still, roses gently glowing'), ('wiggle1', 'the whole hut wiggling and squirming to the left, vines writhing'),
                        ('wiggle2', 'the whole hut wiggling and squirming to the right, vines writhing'), ('stab', 'thorny vines shooting out sideways from the walls'),
                        ('open', 'the door swinging open with a violet glow inside'), ('grow1', 'only a small tangle of black thorny vine sprouts coming out of the ground, no hut yet'),
                        ('grow2', 'half grown: vines weaving into walls, the roof not finished yet'), ('wither', 'collapsing: the roof caved in, walls sagging, vines drying up')],
                'grow': [('g1', 'only a few tiny black thorny vine sprouts poking out of a small patch of dark soil and stones, NO hut yet'),
                         ('g2', 'black thorny vines grown knee-high from the soil, twisting upward and curling, a few leaves, NO walls yet'),
                         ('g3', 'thick black thorny vines woven into the bare frame of small walls and a round door frame, NO roof yet, a couple of red rose buds'),
                         ('g4', 'dark wooden plank walls filled in between the vines, a round wooden door with a keyhole, the roof frame of bare vines just starting, NO chimney yet'),
                         ('g5', 'almost finished: the roof half covered with dark shingles, the crooked little chimney poking up, red roses beginning to bloom'),
                         ('w1', 'withering: the black vines turning grey and dry, the red roses drooping and losing petals, the roof starting to sag'),
                         ('w2', 'collapsing: the roof caved in, the walls leaning and cracked, dry grey vines snapping, a few petals on the ground'),
                         ('w3', 'only a low pile of broken dark planks and dry grey vines on the ground with a few fallen rose petals, the hut is gone')]}),

}

# ---------------------------------------------------------------------------------------------
# 切帧（替换 sky_art.cut）：
#  1. 疯疯熊的 act / more 表每帧头顶都画着两根往上出画的傀儡线，walk 表没有 → 统一去掉“身体最高处往上”的细线，
#     把挂点（身体最高处的两个位置）写进 spr.json 的 str: [[x, y], [x, y]]，游戏里统一从挂点往天上画线（mage_enchantress.js）。
#  2. 比例按参考站姿“不含线”的身体高度算（不然带线的表会整体画小）。
#  3. 脱离主体的小碎片（抓挠的弧线、飞出的线头）算烘焙特效，去掉。
# ---------------------------------------------------------------------------------------------
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def _opened(alpha, k=9):
    m = Image.fromarray(((alpha > 40) * 255).astype(np.uint8), 'L')
    return np.array(m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))) > 0

def _body_top(alpha):
    o = _opened(alpha); rows = np.where(o.any(1))[0]
    return (int(rows.min()), int(rows.max()) + 1) if len(rows) else (0, alpha.shape[0])

def _strip_strings(sub):
    """傀儡线 = 横向宽度 ≤ 14px、竖向连续很长的细条（爪尖、耳尖都很短，不会被当成线）。叠在身体上的那段不动。"""
    a = sub[..., 3] > 40; H, W = a.shape; thin = np.zeros_like(a)
    for y in range(H):
        xs = np.where(a[y])[0]
        if not len(xs): continue
        for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            if len(r) <= 14: thin[y, r[0]:r[-1] + 1] = True
    td = thin.copy()
    for s in (1, 2, 3): td[:, s:] |= thin[:, :-s]; td[:, :-s] |= thin[:, s:]
    string = np.zeros_like(a); minlen = max(40, int(H * 0.08))
    for x in range(W):
        ys = np.where(td[:, x])[0]
        if not len(ys): continue
        for sg in np.split(ys, np.where(np.diff(ys) > 1)[0] + 1):
            if len(sg) >= minlen: string[sg[0]:sg[-1] + 1, x] = True
    string &= thin
    sd = string.copy()
    for s in (1, 2): sd[:, s:] |= string[:, :-s]; sd[:, :-s] |= string[:, s:]
    sub[..., 3] = np.where(sd & (thin | (sub[..., 3] < 200)), 0, sub[..., 3])
    return sub

FX_FRAMES = {'hurt'}   # 画了飞出线头的帧：按像素连通去掉碎片
DROP = {'madbear': {'claw1', 'claw2'}}   # 抓挠弧线和爪子连在一起、去不干净（烘焙特效）：不出这两帧，狂抓用 scratch1 / scratch2
def _clean(sub, strings, fn=None):
    """去掉傀儡线、脱离主体的碎片；返回 (图, 挂点 x 列表, 身体顶行)"""
    if strings: sub = _strip_strings(sub)
    top = _body_top(sub[..., 3])[0] if strings else 0
    if strings and top > 2: sub[:top - 1, :, 3] = 0
    from prep import components
    lab, comps = components(sub[..., 3], f=1 if fn in FX_FRAMES else 2, min_cells=2)
    if comps:
        big = max(c for _, c in comps)
        for c, n in comps:
            if n < big * 0.05: sub[..., 3] = np.where(lab == c, 0, sub[..., 3])
    anchors = []
    if strings:   # 挂点：身体最高处往下 12% 那一行（两只耳朵 / 两只举起的爪子），只有一段就取这段的 30% / 70%
        bh = _body_top(sub[..., 3]); row = sub[min(sub.shape[0] - 1, top + max(10, int((bh[1] - bh[0]) * 0.12))), :, 3] > 60; xs = np.where(row)[0]
        if len(xs):
            runs = np.split(xs, np.where(np.diff(xs) > 3)[0] + 1)
            if len(runs) >= 2: anchors = [float(runs[0].mean()), float(runs[-1].mean())]
            else: r = runs[0]; anchors = [float(r.min() + (r.max() - r.min()) * 0.3), float(r.min() + (r.max() - r.min()) * 0.7)]
    return sub, anchors, top

def cut_one(name):
    from frames2 import names_for, CYCLE
    RES = 2.0; d = A.M[name]; strings = name == 'madbear'
    src = os.path.join(A.SRC, 'sheets2'); pv_dir = os.path.join(A.SRC, 'cut'); os.makedirs(pv_dir, exist_ok=True)
    out = os.path.join(A.HERE, 'final', 'spr', name)
    if os.path.isdir(out):
        for x in os.listdir(out): os.remove(os.path.join(out, x))
    os.makedirs(out, exist_ok=True)
    meta = {'res': RES, 'frames': {}}
    sheets = ['walk', 'run', 'act', 'more'] + [k for k in (d.get('custom') or {}) if k not in ('walk', 'run', 'act', 'more')]
    for sheet in sheets:
        path = os.path.join(src, f'{name}_{sheet}.png')
        if not os.path.exists(path): continue
        names = names_for(name, sheet)
        im, arr, lab, order = A.cut9(path, True if sheet == 'grow' else d.get('holes', True))   # 生长中的墙架会透出白底：这张表要补洞
        rows_ok = [sum(1 for b in order if b['row'] == r) for r in range(3)]
        print(f'{name}_{sheet}: {len(order)} frames rows={rows_ok}{"  <-- CHECK" if len(order) != 9 or rows_ok != [3, 3, 3] else ""}')
        subs = []
        for i, b in enumerate(order):
            sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
            subs.append(_clean(sub, strings, names[i] if i < len(names) else None))
        pv = Image.new('RGB', im.size, (60, 64, 72)); dr = ImageDraw.Draw(pv)
        for b, (sub, anc, top) in zip(order, subs):
            fi = Image.fromarray(sub, 'RGBA'); pv.paste(fi, (b['x0'], b['y0']), fi)
            for x in anc: dr.line([(b['x0'] + x, b['y0'] + top), (b['x0'] + x, b['y0'] + top - 60)], fill=(255, 240, 200), width=3)
        for i, b in enumerate(order): dr.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], outline=(255, 220, 60), width=3); dr.text((b['x0'] + 4, b['y0'] + 4), f'{i} {names[i] if i < len(names) else "?"}', fill=(255, 60, 60))
        pv.thumbnail((900, 900)); pv.save(os.path.join(pv_dir, f'{name}_{sheet}.png'))
        if not order: continue
        top0, bot0 = _body_top(subs[0][0][..., 3]); k = d['h'] * RES / max(1, bot0 - top0)
        base = {r: max(b['y1'] for b in order if b['row'] == r) for r in range(3) if any(b['row'] == r for b in order)}
        for b, fn, (sub, anc, top) in zip(order, names, subs):
            if fn is None or fn in meta['frames'] or fn in DROP.get(name, ()): continue
            a = sub[..., 3] > 40; rows = np.where(a.any(1))[0]
            if not len(rows): continue
            y0 = int(rows.min()); sub = sub[y0:]; a = a[y0:]; h = a.shape[0]
            if sheet in CYCLE:
                xs = np.where(a[int(h * 0.15):int(h * 0.55)])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2; ay = base[b['row']] - b['y0'] - y0
            else:
                bottom = np.where(a.any(1))[0].max() + 1; xs = np.where(a[max(0, bottom - int(h * 0.12)):bottom])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2; ay = bottom
            fr = Image.fromarray(sub, 'RGBA'); sm = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS)
            sm.save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=76, method=6)
            F = {'w': sm.width, 'h': sm.height, 'ax': round(ax * k, 1), 'ay': round(ay * k, 1)}
            if anc: F['str'] = [[round(x * k, 1), round(max(0, top - y0) * k, 1)] for x in anc]
            meta['frames'][fn] = F
    json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1)
    tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith('.webp'))
    print(f'  -> {name}: {len(meta["frames"])} frames, {tot // 1024} KB')

STRIPS = {
    'madbear': ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'scratch1', 'scratch2', 'punch1', 'punch2', 'slam1', 'slam2', 'guard', 'hurt', 'leap', 'fall', 'roar', 'idle2', 'cheer', 'down'],
    'zombiedoll': ['idle', 'walk1', 'walk3', 'walk5', 'walk7', 'run1', 'run2', 'swell1', 'swell2', 'grab', 'fall', 'idle2', 'cheer'],
    'thornhut': ['g1', 'g2', 'g3', 'g4', 'g5', 'idle', 'wiggle1', 'wiggle2', 'stab', 'open', 'w1', 'w2', 'w3'],
}
def strip(name):
    """游戏比例连拍：summon_strip 的画法，最左边是魔法师站姿；疯疯熊按 str 挂点补上往天上的傀儡线"""
    import summon_strip as SS
    SS.OUT = A.SRC
    f0 = SS.frame
    def frame(key, n):
        r = f0(key, n)
        if not r or key != 'madbear': return r
        im, ax, ay = r; meta = json.load(open(os.path.join(A.HERE, 'final', 'spr', key, 'spr.json'))); F = meta['frames'][n]; kk = SS.ZOOM / meta['res']
        if not F.get('str'): return r
        top = 150; big = Image.new('RGBA', (im.width, im.height + top), (0, 0, 0, 0)); big.alpha_composite(im, (0, top)); dr = ImageDraw.Draw(big)
        for x, y in F['str']: dr.line([(x * kk, 0), (x * kk, top + y * kk)], fill=(236, 226, 206, 220), width=1)
        return big, ax, ay + top
    SS.frame = frame
    SS.strip(name, 'town', ('mage',), [n for n in STRIPS[name] if os.path.exists(os.path.join(A.HERE, 'final', 'spr', name, n + '.webp'))])

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'cut':
        only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else ''
        for n in A.M:
            if n.startswith(only): cut_one(n)
    elif len(sys.argv) > 1 and sys.argv[1] == 'strip':
        for n in (sys.argv[2:] or list(STRIPS)): strip(n)
    else: A.main()
