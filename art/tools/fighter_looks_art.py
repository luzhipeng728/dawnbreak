#!/usr/bin/env python3
"""格斗家（男）时装帧（B2）：6 套时装（含天空套 2 套）× 6 张 4×4 表 → art/final/spr/fighter@<套装>/（91 帧，和原装同名）
  fighter_looks_art.py ref [套装,...]              时装参考立绘（原装立绘 + 鬼剑士同一套的参考当设计参照）→ 主仓库 art/src/avatar/refs/fighter@<套装>.png
  fighter_looks_art.py sheets [套装/表,...] [-j 2]  时装动作表（原装 4×4 表带绿棒 + 时装参考）→ art/src/avatar/sets/<套装>/fighter_<表>.png
  fighter_looks_art.py frames [套装,...] [--only 表]  切帧 → art/final/spr/fighter@<套装>/ + spr.json
  fighter_looks_art.py review [套装,...]           审图：每套一行（原装 / 时装同名帧并排）→ art/work/fighter_b2/costume_<套装>.jpg
表：move / combo / walkreact / base2 / base3 / jobs（walkreact = 原装 walk 表的走路格 + react 表的受击格拼成一张，省一次生图）。
切帧：复用 avatar_frames.process_sheet（抠绿棒、补色、白色衣物和白底口袋分开）+ fighter_art 的 4×4 切格；
  缩放 = 原装同名帧“原表像素 → 帧像素”的倍数（B1 第二遍按头归一过，这里照抄，所以时装帧和原装一样大）；
  位置 = 和原装同名帧轮廓对齐（avatar_align.align，残差缩放 ±6%）；锚点（拳头 wpn / wpn2、头 head、分割线 cut）从原装平移过来。
"""
import os, sys, json, math, argparse, statistics
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import fighter_art as FA
import avatar_gen as G

HERE = FA.HERE
AV = G.OUT
REFS = os.path.join(AV, 'refs')
BSD = os.path.join(AV, 'fighter_base')          # 拼好的 walkreact 原表 + 原装缩放缓存
WORK = os.path.join(HERE, 'work', 'fighter_b2')
SPR = os.path.join(HERE, 'final', 'spr')
SETS = ['summer', 'festival', 'spring', 'academy', 'sky1', 'sky2']
TABLES = ['move', 'combo', 'walkreact', 'base2', 'base3', 'jobs']
NAMES = {t: [f for f, _, _ in FA.SHEETS[t]] for t in ('move', 'combo', 'base2', 'base3', 'jobs')}
NAMES['walkreact'] = [f for f, _, _ in FA.SHEETS['walk']][:9] + [f for f, _, _ in FA.SHEETS['react']][9:]
OUTFIT = {   # 格斗家版（照鬼剑士那套的设计，改成适合拳脚的短款 / 无袖）
    'summer': 'an open blue-and-white Hawaiian short-sleeve shirt with a hibiscus flower pattern over a white tank top; sky-blue knee-length beach shorts printed with palm trees; brown sandals; '
              'a woven straw belt with small seashells; a seashell necklace on the chest.',
    'festival': 'a short red double-breasted festive jacket with thick white fluffy fur trim on the collar, cuffs and hem, gold buttons and small gold star ornaments; a red bow tie with a gold-framed ruby gem at the collar; '
                'a red satin sash belt with a gold square buckle; red knee-length shorts with gold trim and white knee socks; glossy red shoes with gold buckles.',
    'spring': 'a red Chinese Tang-style short sleeveless jacket with a mandarin stand-up collar, gold frog-knot buttons, auspicious cloud trim along the edges, a koi fish embroidered on the hem and a ring of white fluffy fur around the collar; '
              'loose black lantern trousers with gold leg wraps at the shins; red embroidered cloth shoes; a wide gold waist sash with a red Chinese knot tassel hanging at the side; a gold longevity-lock pendant necklace on the chest.',
    'academy': 'a navy blue school blazer with gold buttons and a school crest on the chest over a white shirt, the sleeves pushed up to the elbows; grey plaid long trousers; brown leather shoes; a black leather belt; a loosened red necktie.',
    'sky1': 'a short white knight tunic reaching the hips with gold trim and gilded shoulder armor, a sky-blue lining, and a pair of small white angel wings on the back; loose white trousers with gold knee guards; '
            'white-and-gold boots; a wide gold belt with a blue sapphire in the middle; a gold cross brooch on the chest.',
    'sky2': 'a black sleeveless dragon-scale vest with a red lining and gold dragon embroidery, a dragon-head pauldron on one shoulder, and a pair of small black-and-red dragon wings on the back; '
            'wide black trousers with red leg guards; black-and-gold battle boots; a red waist sash with a gold dragon-head buckle; a dragon-claw necklace holding a red gem on the chest.',
}
HANDS = 'Both fists and forearms stay wrapped in the same light cream cloth bandages as before (the bandages are NOT part of the outfit and keep their cream color).'

def ref_prompt(sid):
    return ('The FIRST image is our chibi martial-artist character. The SECOND image only shows the design of an outfit, worn by a different character. '
            'Edit the FIRST image: keep exactly the same character, the same face, the same spiky dark chestnut-brown hair, the same amber eyes, the same fighting-stance pose, the same proportions, '
            f'the same framing and the same cute art style with thick outlines, but change his clothes to this outfit (same style and colors as in the second image): {OUTFIT[sid]} {HANDS} '
            'The hands are empty (no weapon). No hat, no glasses, no hair ornament. Plain pure white background, no text.')

def sheet_prompt(sid):
    return ('The FIRST image is a 2D game sprite animation sheet (4x4 grid, 16 frames) of a chibi martial artist; each of his fists holds a short flat pure green stick. '
            'The SECOND image shows the same character in a new outfit. Redraw the FIRST image exactly: the same 4x4 layout, the same poses, the same positions and sizes of every figure, '
            'the same flat pure green (#00FF00) sticks sticking out of the fists in exactly the same places and angles (the sticks stay flat pure green, with no outline or shading), '
            f'but dress the character in EVERY frame in the outfit of the second image: {OUTFIT[sid]} {HANDS} '
            'The outfit must look IDENTICAL in all 16 frames (same patterns in the same places, same colors). Keep the face, the hair and the art style. '
            'No hat, no glasses, no hair ornament, no effects. Plain pure white background, no text.')

def base_sheet(t):
    return os.path.join(BSD, 'fighter_walkreact.png') if t == 'walkreact' else FA.sheet_path(t)
def set_sheet(sid, t): return os.path.join(AV, 'sets', sid, f'fighter_{t}.png')

def composite():
    """walkreact：walk 表第 0~8 格（站姿参考 + 走路 8 帧）+ react 表第 9~15 格（受击 7 帧），按 512 像素的格子拼"""
    out = base_sheet('walkreact')
    if os.path.exists(out): return out
    os.makedirs(BSD, exist_ok=True)
    W, R = Image.open(FA.sheet_path('walk')).convert('RGB'), Image.open(FA.sheet_path('react')).convert('RGB')
    c = FA.CELL; im = Image.new('RGB', W.size, 'white')
    for i in range(16):
        x, y = (i % 4) * c, (i // 4) * c; im.paste((W if i <= 8 else R).crop((x, y, x + c, y + c)), (x, y))
    im.save(out); print(out); return out

def gen(out, prompt, refs, size, force=False):
    return FA.gen(out, prompt, refs, size, force)

def cmd_ref(sets, force, j):
    jobs = [(os.path.join(REFS, f'fighter@{s}.png'), ref_prompt(s), [FA.REF, os.path.join(REFS, f'sword@{s}.png')], '1024x1536') for s in sets]
    with ThreadPoolExecutor(min(3, j)) as ex:
        for f in as_completed([ex.submit(gen, o, p, r, sz, force) for o, p, r, sz in jobs]): print(f.result(), flush=True)

def cmd_sheets(items, force, j):
    composite(); jobs = []
    for sid, t in items:
        ref = os.path.join(REFS, f'fighter@{sid}.png')
        if not os.path.exists(ref): print('缺时装参考，先跑 ref：', ref); continue
        jobs.append((set_sheet(sid, t), sheet_prompt(sid), [base_sheet(t), ref], '2048x2048'))
    with ThreadPoolExecutor(min(3, j)) as ex:
        for f in as_completed([ex.submit(gen, o, p, r, sz, force) for o, p, r, sz in jobs]): print(f.result(), flush=True)

# ---- 切帧 ----
def _patch():
    import avatar_frames as AF, frames as FR
    FR.HEIGHT['fighter'] = FA.HEIGHT; AF.cut_boxes = FA.cut16; AF.stick_groups = FA.stick_groups
    return AF

def base_scale():
    """原装每帧：原表像素 → 帧像素的倍数（第一遍按站姿格 + 第二遍按头归一，B1 的 frames 算出来的结果），缓存到 fighter_base/scale.json"""
    p = os.path.join(BSD, 'scale.json')
    if os.path.exists(p): return json.load(open(p))
    AF = _patch(); meta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json')))
    fixes = json.load(open(AF.FIX)) if os.path.exists(AF.FIX) else {}
    out = {}
    for t in ('move', 'combo', 'walk', 'react', 'base2', 'base3', 'jobs'):
        fn = [f for f, _, _ in FA.SHEETS[t]]
        fr, _, _, _ = AF.process_sheet('fighter', t, FA.sheet_path(t), fn, meta['res'], fixes, None)
        FA.fist_sticks(fr, t); FA.clean_frames(fr)
        for f, F in fr.items():
            B = meta['frames'].get(f); al = F['sub'][..., 3] > 40; ys, xs = np.where(al)
            if B is None or not len(xs): continue
            out[f] = (B['w'] / (xs.max() - xs.min() + 1) + B['h'] / (ys.max() - ys.min() + 1)) / 2
        vals = sorted(out[f] for f in fr if f in out and f != 'idle'); med = vals[len(vals) // 2]
        for f in fr:
            if f in out and f != 'idle' and abs(out[f] / med - 1) < 0.08: out[f] = med   # 同一张表的动作格同一个倍数（第二遍是按表整体放大的）
        print(f'  原装 {t}: 倍数中位 {med:.4f}')
    os.makedirs(BSD, exist_ok=True); json.dump(out, open(p, 'w'), indent=1); return out

def _mask(a):
    return Image.fromarray(((a[..., 3] > 60) * 255).astype(np.uint8), 'L')

def _shift(B, dx, dy):
    """原装帧的锚点平移到时装帧"""
    o = {}
    for k in ('wpn', 'wpn2'):
        W = B.get(k)
        if not W: continue
        W = dict(W); W['gx'] = round(W['gx'] + dx, 1); W['gy'] = round(W['gy'] + dy, 1)
        if 'hand' in W: W['hand'] = [[round(v + (dy if j % 2 else dx), 1) for j, v in enumerate(P)] for P in W['hand']]
        o[k] = W
    if B.get('head'): o['head'] = {**B['head'], 'x': round(B['head']['x'] + dx, 1), 'y': round(B['head']['y'] + dy, 1)}
    if B.get('cut'): o['cut'] = {**B['cut'], 'wx': round(B['cut']['wx'] + dx, 1), 'wy': round(B['cut']['wy'] + dy, 1)}
    return o

def cmd_frames(sets, only):
    import avatar_align as AL
    AF = _patch(); bscale = base_scale()
    bmeta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json'))); res = bmeta['res']
    fixes = json.load(open(AF.FIX)) if os.path.exists(AF.FIX) else {}
    for sid in sets:
        od = os.path.join(SPR, f'fighter@{sid}'); os.makedirs(od, exist_ok=True); mp = os.path.join(od, 'spr.json')
        meta = json.load(open(mp)) if os.path.exists(mp) else {'res': res, 'frames': {}}
        rep = []
        for t in TABLES:
            if only and t not in only: continue
            src = set_sheet(sid, t)
            if not os.path.exists(src): print(f'  {sid}: 没有 {t}'); continue
            bp = base_sheet(t) if t != 'walkreact' else composite()
            ref_h = AF.ref_height(bp)
            fr, _, _, _ = AF.process_sheet('fighter', t, src, NAMES[t], res, fixes, None, ref_h, bp, bmeta['frames'], sid in AF.NO_WHITE)
            for f, F in fr.items():
                B = bmeta['frames'].get(f)
                if not B or f not in bscale: continue
                sub = F['sub']; al = sub[..., 3] > 40; ys, xs = np.where(al)
                sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                k = bscale[f]; im = Image.fromarray(sub, 'RGBA'); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
                bim = Image.open(os.path.join(SPR, 'fighter', f + '.webp')).convert('RGBA')
                s, tx, ty, iou = AL.align(_mask(np.array(bim)), _mask(np.array(im)), np.arange(0.94, 1.061, 0.02))
                if iou >= AL.IOU_OK and abs(s - 1) > 0.03:   # 残差缩放：这一格画大 / 画小了
                    im = im.resize((max(1, round(im.width / s)), max(1, round(im.height / s))), Image.LANCZOS)
                    s2, tx, ty, iou = AL.align(_mask(np.array(bim)), _mask(np.array(im)), np.array([1.0])); s = 1.0
                ax, ay = s * B['ax'] + tx, s * B['ay'] + ty
                ent = {'w': im.width, 'h': im.height, 'ax': round(ax, 1), 'ay': round(ay, 1), **_shift(B, ax - B['ax'], ay - B['ay'])}
                im.save(os.path.join(od, f + '.webp'), 'WEBP', quality=AF.Q, method=6)
                meta['frames'][f] = ent; rep.append((f, round(iou, 3)))
            print(f'  {sid}/{t}: {len(fr)} 帧')
        meta['frames'] = dict(sorted(meta['frames'].items())); json.dump(meta, open(mp, 'w'), indent=1)
        low = [f'{f}({v})' for f, v in rep if v < 0.6]
        print(f'fighter@{sid}: {len(meta["frames"])} 帧；和原装轮廓重合度 < 0.6：{" ".join(low) or "无"}')

def cmd_review(sets):
    """每套：原装 / 时装同名帧并排（每张表挑 4 帧），加一行 6 套 idle"""
    os.makedirs(WORK, exist_ok=True); font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 14)
    pick = ['idle', 'run3', 'walk2', 'hit2', 'f_jab2', 'f_mid2', 'f_axe2', 'f_high2', 'down', 'f_lift', 'f_spin1', 'f_palm1', 'f_focus', 'fn_ride', 'fs_dashpunch', 'fb_throw1', 'fg_swing1', 'fg_press']
    bmeta = json.load(open(os.path.join(SPR, 'fighter', 'spr.json')))['frames']; cw, ch = 150, 230
    for sid in sets:
        d = os.path.join(SPR, f'fighter@{sid}')
        if not os.path.isdir(d): continue
        M = Image.new('RGB', (cw * len(pick), ch * 2 + 10), (70, 74, 84)); D = ImageDraw.Draw(M)
        m2 = json.load(open(os.path.join(d, 'spr.json')))['frames']
        for i, f in enumerate(pick):
            for r, (dd, mm) in enumerate(((os.path.join(SPR, 'fighter'), bmeta), (d, m2))):
                F = mm.get(f); p = os.path.join(dd, f + '.webp')
                if not F or not os.path.exists(p): continue
                im = Image.open(p).convert('RGBA'); ox, oy = i * cw + cw // 2, r * (ch + 10) + ch - 14
                M.paste(im, (round(ox - F['ax']), round(oy - F['ay'])), im)
                if F.get('head'): hx, hy = ox - F['ax'] + F['head']['x'], oy - F['ay'] + F['head']['y']; D.ellipse([hx - 3, hy - 3, hx + 3, hy + 3], outline=(0, 255, 120))
                for k, col in (('wpn', (255, 80, 80)), ('wpn2', (80, 200, 255))):
                    W = F.get(k)
                    if W: gx, gy = ox - F['ax'] + W['gx'], oy - F['ay'] + W['gy']; D.line([gx, gy, gx + math.cos(W['ang']) * 16, gy + math.sin(W['ang']) * 16], fill=col, width=2)
                D.line([ox - 5, oy, ox + 5, oy], fill=(255, 255, 255))
            D.text((i * cw + 3, 2), f, fill=(255, 230, 120), font=font)
        M.save(os.path.join(WORK, f'costume_{sid}.jpg'), quality=86); print(os.path.join(WORK, f'costume_{sid}.jpg'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('names', nargs='?', default=''); ap.add_argument('-j', type=int, default=2)
    ap.add_argument('--force', action='store_true'); ap.add_argument('--only', default=''); a = ap.parse_args()
    names = [n for n in a.names.split(',') if n]
    if a.cmd == 'ref': return cmd_ref(names or SETS, a.force, a.j)
    if a.cmd == 'sheets':
        items = [tuple(n.split('/')) for n in names] if names else [(s, t) for s in SETS for t in TABLES]
        items = [(s, t) for s, *r in items for t in (r or TABLES)]
        return cmd_sheets(items, a.force, a.j)
    if a.cmd == 'frames': return cmd_frames(names or SETS, [t for t in a.only.split(',') if t])
    if a.cmd == 'review': return cmd_review(names or SETS)
    if a.cmd == 'composite': return print(composite())
    if a.cmd == 'scale': return print(len(base_scale()))
    sys.exit('cmd: ref | sheets | frames | review | composite | scale')

if __name__ == '__main__':
    main()
