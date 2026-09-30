#!/usr/bin/env python3
"""格斗家（男）B1 原装人物帧（docs/CLASS_PLAN_FIGHTER.md §3、docs/FIGHTER_ART_SAMPLES.md）。
4×4 动作表：第 1 格是站姿参考（统一比例），其余 15 格是动作帧；每格都有姿势参考小人（poseguide 同一套画法，蓝 = 近侧、红 = 远侧），
双拳各握一根从指节伸出、沿前臂方向的纯绿 #00FF00 占位棒（D5：拳上武器的双手锚点 wpn / wpn2），一次出图，不再单独跑占位轮。
切帧复用 avatar_frames（抠占位棒 + 补色 + 握点 / 拳头轮廓）、avatar_head（头部锚点）、avatar_cuts（混搭分割线），只在本文件里把 3×3 换成 4×4，不改它们的表。
原图写到主仓库 art/src/fighter/（不进 git）。
  fighter_art.py guides                      姿势参考图 → <主仓库>/art/src/fighter/guide_<表>.png
  fighter_art.py ref | design [--force]      原装立绘 <主仓库>/art/src/fighter_ref.png（参考鬼剑士的比例 / 画风）| 设计定稿三视图 fighter/design.png
  fighter_art.py sheets [--only 表] [-j 2]   4×4 动作表 → <主仓库>/art/src/fighter/sheets/fighter_<表>.png（已存在的跳过）
  fighter_art.py frames [表...] [--dry]      切帧 → art/final/spr/fighter/（只替换这些表的帧）+ 头部锚点 + 分割线；预览 <主仓库>/art/src/fighter/cut/
  fighter_art.py class                       选角立绘 art/final/class/fighter.webp（原装立绘去白底）
  fighter_art.py review                      审图总览 → art/work/fighter_samples/
生图约定：同时最多 2 个请求（同一个 ChatGPT 账号别压），参考图直接传本地路径（local:），429 退避 65 秒。
"""
import os, sys, math, json, time, argparse, itertools
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import sheets as SH
from prep import remove_bg, components
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SRC = os.path.join(MAIN, 'src')
FS = os.path.join(SRC, 'fighter')
REF = os.path.join(SRC, 'fighter_ref.png')
SPR = os.path.join(HERE, 'final', 'spr', 'fighter')
WORK = os.path.join(HERE, 'work', 'fighter_samples')
HEIGHT = 112                    # 站姿参考格（格斗架势，膝盖微弯）的目标高度（世界单位）：鬼剑士 118；并排截图按头 / 身体大小对齐，112 和鬼剑士看起来一样大
RES = 1.8                       # 帧像素 / 世界单位（和三职业一样）
GREEN = '#00FF00'

WHO = ('a young male martial artist (DNF-style male Striker fighter): short spiky dark chestnut-brown hair, amber eyes, a confident determined face; '
       'a sleeveless crimson-red kung-fu vest with a black mandarin collar, black trim and small gold frog buttons, bare arms; '
       'both fists and forearms wrapped in cream-beige cloth hand wraps (bare fists, no gloves); a black cloth sash belt with two short tails; '
       'loose charcoal-black martial arts trousers, shins wrapped in beige cloth wraps, black cloth kung-fu shoes. No headband, no hat, no accessories')

# ---- 姿势参考小人（4×4，每格 512） ----
N = 4; S = 2048; CELL = S // N
NEAR, FAR, BODY, HEADC, OUT = (40, 110, 235), (225, 55, 55), (150, 150, 158), (200, 200, 206), (30, 30, 36)
_k = 0.75
HEAD_R, NECK, TORSO, UA, FA, TH, SH_, FOOT, W = [round(v * _k) for v in (88, 14, 120, 66, 60, 78, 74, 44, 30)]
STICK, STW, FIST = round(FA * 0.95), 11, 15
KEYS = ('lean', 'nth', 'nsh', 'fth', 'fsh', 'nua', 'nfa', 'fua', 'ffa', 'lift')
P = lambda *v: dict(zip(KEYS, v))
# 角度：0 = 竖直向下，正 = 向前（面朝右），180 = 竖直向上；lean 躯干前倾；lift 额外离地（参考图像素）
IDLE = P(4, 20, -2, -16, -30, 40, 150, 15, 165, 0)
IDLE_T = ('standing idle in a light agile fighting stance on the balls of the feet: near (blue) leg forward, far leg back, knees slightly bent, '
          'the near fist raised forward at face height and the far fist guarding the chin')
# 跑：长步幅（接触帧前后脚距离约 1.5 倍），第 3、7 帧是真正的腾空帧（前后腿大开），不是站直的过渡帧（docs/ANIMATION.md §5）
RUN = [('run1', P(14, 38, 20, -40, -72, -40, 50, 45, 135, 0), 'run contact: near leg reaching forward landing on the heel, far leg pushing off far behind, near fist swung back, far fist forward'),
       ('run2', P(16, 10, -26, 30, -62, -15, 75, 20, 110, 0), 'run down: weight on the bent near leg under the body (lowest point), far knee driving forward, arms passing'),
       ('run3', P(16, -42, -52, 66, -4, 35, 125, -35, 55, 26), 'run FLIGHT: both feet off the ground, legs spread wide front and back: near leg stretched straight behind, far knee high in front'),
       ('run4', P(14, -30, -96, 46, 28, 45, 135, -40, 50, 12), 'run reach: still airborne, far leg reaching forward to land, near leg folded up behind'),
       ('run5', P(14, -40, -72, 38, 20, 45, 135, -40, 50, 0), 'run contact MIRRORED: far leg landing forward, near leg pushing off far behind, near fist forward'),
       ('run6', P(16, 30, -62, 10, -26, 20, 110, -15, 75, 0), 'run down MIRRORED: weight on the bent far leg, near knee driving forward'),
       ('run7', P(16, 66, -4, -42, -52, -35, 55, 35, 125, 26), 'run FLIGHT MIRRORED: both feet off the ground, near knee high in front, far leg stretched straight behind'),
       ('run8', P(14, 46, 28, -30, -96, -40, 50, 45, 135, 12), 'run reach MIRRORED: near leg reaching forward to land, far leg folded up behind')]
JUMP = [('jump1', P(10, 55, -10, 40, -25, -40, -20, -30, -10, 0), 'jump take-off: crouched low with both knees deeply bent, fists swung back, ready to spring up'),
        ('jump2', P(0, 5, -5, -10, -20, 150, 165, 140, 160, 70), 'jumping up: body stretched rising into the air, legs trailing below, fists raised'),
        ('jump3', P(5, 80, -10, 60, -20, 40, 150, 20, 160, 90), 'jump apex: floating high with both knees tucked up, fists in guard'),
        ('jump4', P(0, 15, 5, -5, -10, 120, 140, 100, 130, 60), 'falling: legs reaching down, arms raised out for balance'),
        ('jump5', P(12, 50, -15, 30, -30, 60, 90, 40, 70, 0), 'landing: knees bent absorbing the impact, crouched, fists forward')]
JKICK = [('f_jkick1', P(-5, 95, -5, 40, -40, 40, 150, 20, 160, 80), 'mid-air kick chamber: airborne, near knee pulled up to the chest, far leg tucked, fists in guard'),
         ('f_jkick2', P(-15, 70, 70, 30, -60, -20, 30, 60, 140, 80), 'mid-air flying kick: airborne, near leg thrust straight out diagonally forward-down, far leg tucked back, body leaning back')]
COMBO = [('f_jab1', P(8, 22, 0, -18, -32, 65, 115, 15, 165, 0), 'jab start: the near fist starting to shoot forward from the guard, shoulder turning'),
         ('f_jab2', P(12, 28, 4, -22, -36, 88, 90, 10, 165, 0), 'quick jab: the near arm fully extended STRAIGHT forward at face height, far fist guarding the chin, slight lunge'),
         ('f_low1', P(2, 38, 2, -6, -10, 40, 150, 15, 165, 0), 'low kick start: weight shifting onto the far (back) leg, the near knee lifting a little'),
         ('f_low2', P(-8, 80, 84, 32, -16, 35, 150, 10, 160, 0), 'fast low sweep kick: near leg snapped straight forward LOW near the ground, supporting far leg bent, fists in guard'),
         ('f_mid1', P(-2, 4, -4, 90, -5, 35, 150, 20, 150, 0), 'middle kick chamber: standing on the near leg, the far knee raised to waist height'),
         ('f_mid2', P(-18, -6, -10, 96, 96, 30, 145, -35, 10, 0), 'middle kick: the far leg kicking STRAIGHT forward horizontally at waist height, body leaning back, far arm swung back for balance'),
         ('f_axe1', P(-14, 140, 150, -4, -8, -40, -10, 60, 140, 0), 'axe kick raise: the near leg swung high up in front (foot at shoulder height), standing tall on the far leg'),
         ('f_axe2', P(20, 58, 62, 38, -38, 60, 105, 30, 150, 0), 'axe kick down: the near heel smashed down in front, low wide stance, body leaning forward'),
         ('f_high1', P(14, 52, -22, 32, -42, 20, 150, 10, 160, 0), 'rising kick start: crouched low, coiled, fists up'),
         ('f_high2', P(-34, 160, 168, -12, -6, 100, 115, -60, -30, 10), 'rising high kick: the near leg kicking straight UP to the sky, body leaning far back, arms flung out, on the toes of the far foot'),
         ('f_shoulder1', P(28, 42, -20, -12, -42, 5, 120, -5, 115, 0), 'shoulder charge wind-up: dropping low and leaning forward, fists tucked in front of the chest'),
         ('f_shoulder2', P(44, 58, 2, -48, -52, -10, 110, 15, 120, 0), 'shoulder tackle: lunging far forward leading with the near shoulder, body diagonal, far leg stretched straight behind'),
         ('f_grab', P(10, 26, 0, -20, -30, 80, 95, 84, 100, 0), 'grab: both arms reaching straight forward at chest height, both fists clenched as if clutching an enemy'),
         ('f_knee', P(-4, 112, 12, -6, -10, 45, 62, 50, 72, 6), 'knee strike: the near knee driven up high to chest height, both fists pulled down in front as if pulling the enemy onto the knee'),
         ('f_crouch', P(16, 72, -28, 52, -58, 40, 150, 20, 160, 0), 'crouch: squatting very low close to the ground, fists up in guard')]
SHEETS = {   # 表名 → 16 格 [(帧名, 姿势, 说明)]；第 1 格 move 表当 idle，其它表只作比例参考
    'move': [('idle', IDLE, IDLE_T)] + RUN + JUMP + JKICK,
    'combo': [(None, IDLE, IDLE_T)] + COMBO,
}
CYCLE = ('run', 'walk')          # 这些帧按“躯干中线 + 同一行脚底基线”对齐（腾空帧保留离地高度）

def seg(p, ang, ln): return (p[0] + math.sin(math.radians(ang)) * ln, p[1] + math.cos(math.radians(ang)) * ln)

def joints(Q):
    """小人的关节（髋 = 原点，y 向下）"""
    J = {'hip': (0.0, 0.0)}
    for s in 'nf':
        J[s + 'k'] = seg(J['hip'], Q[s + 'th'], TH); J[s + 'a'] = seg(J[s + 'k'], Q[s + 'sh'], SH_); J[s + 't'] = (J[s + 'a'][0] + FOOT, J[s + 'a'][1] + 3)
    up = 180 - Q['lean']; J['neck'] = seg(J['hip'], up, TORSO); J['head'] = seg(J['neck'], up, NECK + HEAD_R); J['sho'] = seg(J['hip'], up, TORSO - 12)
    for s in 'nf':
        J[s + 'e'] = seg(J['sho'], Q[s + 'ua'], UA); J[s + 'h'] = seg(J[s + 'e'], Q[s + 'fa'], FA)
    return J

def jbox(J):
    """小人的外框：头（圆）+ 所有关节"""
    xs = [p[0] for p in J.values()] + [J['head'][0] - HEAD_R, J['head'][0] + HEAD_R]; ys = [p[1] for p in J.values()] + [J['head'][1] - HEAD_R]
    return min(xs), min(ys), max(xs), max(ys)

def figure(d, cx, base, Q):
    J = joints(Q); hip, head, neck, sho = J['hip'], J['head'], J['neck'], J['sho']
    nk, na, nt, fk, fa, ft, ne, nh, fe, fh = (J[k] for k in ('nk', 'na', 'nt', 'fk', 'fa', 'ft', 'ne', 'nh', 'fe', 'fh'))
    lowest = max(na[1], fa[1], nt[1], ft[1]) + 8
    dx, dy = cx, base - lowest - Q['lift']
    T = lambda p: (p[0] + dx, p[1] + dy)
    def limb(a, b, col, w=W):
        d.line([T(a), T(b)], fill=OUT, width=w + 7); d.line([T(a), T(b)], fill=col, width=w)
        for p in (a, b): x, y = T(p); d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    def fist(e, h, col):   # 拳头 + 从指节伸出的绿色占位棒（沿前臂方向）
        ux, uy = (h[0] - e[0]) / FA, (h[1] - e[1]) / FA
        d.line([T(h), T((h[0] + ux * STICK, h[1] + uy * STICK))], fill=GREEN, width=STW)
        x, y = T(h); d.ellipse([x - FIST, y - FIST, x + FIST, y + FIST], fill=col, outline=OUT, width=3)
    limb(sho, fe, FAR); limb(fe, fh, FAR); fist(fe, fh, FAR)
    limb(hip, fk, FAR); limb(fk, fa, FAR); limb(fa, ft, FAR, 20)
    limb(hip, neck, BODY, 48)
    x, y = T(head); d.ellipse([x - HEAD_R, y - HEAD_R, x + HEAD_R, y + HEAD_R], fill=HEADC, outline=OUT, width=5)
    d.polygon([(x + HEAD_R - 5, y - 6), (x + HEAD_R + 20, y + 5), (x + HEAD_R - 5, y + 17)], fill=HEADC, outline=OUT)
    d.ellipse([x + 28, y - 14, x + 41, y + 2], fill=OUT)
    limb(hip, nk, NEAR); limb(nk, na, NEAR); limb(na, nt, NEAR, 20)
    limb(sho, ne, NEAR); limb(ne, nh, NEAR); fist(ne, nh, NEAR)

def guide(name):
    im = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(im)
    for i, (_, Q, _) in enumerate(SHEETS[name]):
        r, c = divmod(i, N); figure(d, c * CELL + CELL * 0.42, r * CELL + CELL * 0.94, Q)
    return im

def guide_path(name): return os.path.join(FS, f'guide_{name}.png')
def sheet_path(name): return os.path.join(FS, 'sheets', f'fighter_{name}.png')

def sheet_prompt(name):
    per = '; '.join(f'({i + 1}) {t}' for i, (_, _, t) in enumerate(SHEETS[name]))
    return ('The FIRST image is the character. The SECOND image is a pose guide: 16 simple mannequin figures in a 4x4 grid. '
            'Draw a professional 2D game sprite animation sheet of this exact chibi character: redraw the character from the first image 16 times, in exactly the same 4x4 layout as the pose guide, '
            'each copy copying EXACTLY the pose of the mannequin in the same cell: the same body lean, the same angle of every upper arm, forearm, thigh and shin, the same foot placement and the same height above the ground. '
            "In the pose guide the BLUE arm and BLUE leg are the character's NEAR side (closer to the viewer, drawn in front of the body) and the RED arm and RED leg are the FAR side (behind the body). "
            f'Both hands are always tightly clenched fists wrapped in the cloth hand wraps. In EVERY frame EACH fist holds one short, perfectly straight, rigid stick painted in ONE flat pure green color ({GREEN}), '
            'exactly like the green sticks in the pose guide: the stick sticks straight out of the front of the fist (out of the knuckles), continuing the line of the forearm, about as long as the forearm; '
            'no outline, no shading, no highlight, uniform thickness about two fingers wide. The green sticks are the ONLY thing copied literally from the pose guide. '
            'Only the two fists hold green sticks: the feet, shoes and legs NEVER have any green on them, not even in kicking frames. '
            f'Frame by frame (left to right, top to bottom): {per}. '
            "Keep the character's own design, face, hair, colors, clothing, proportions and cute chibi art style with thick outlines exactly as in the first image; do NOT draw the mannequin colors or shapes on the character. "
            'Every figure faces RIGHT in strict side view, all at exactly the same scale as frame (1), with wide white gaps between the cells so that no figure touches or overlaps another; '
            'the feet of the grounded figures in each row stand on the same baseline. Plain pure white background, no ground, no shadows, no text, no numbers, no speed lines, no effects.')

REF_PROMPT = ('The image shows a chibi character from our 2D action game. Draw a NEW, different character in EXACTLY the same art style: the same chibi proportions '
              '(the same big head relative to the body, the same total height, the same body build), the same thick outlines, the same cel shading and colors saturation, '
              f'the same framing (full body, centered, the same size in the image) and the same side view facing RIGHT: {WHO}. '
              'He stands in a light, agile fighting stance on the balls of his feet, knees slightly bent, fists raised in a guard in front of his chest and chin, nothing in his hands. '
              'Plain pure white background, no text, no effects, no shadow.')
DESIGN_PROMPT = ('Character model sheet of this exact chibi character (same face, same hair, same outfit, same colors, same proportions, same cute art style with thick outlines): '
                 'three full-body views side by side at exactly the same scale, all standing relaxed and upright with the wrapped fists loosely at the sides: '
                 '(1) front view, (2) three-quarter view turned toward the right, (3) strict side view facing right. Evenly spaced with wide white gaps. '
                 'Plain pure white background, no text, no labels, no effects, no shadow.')

def gen(out, prompt, refs, size, force=False):
    if os.path.exists(out) and not force: return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    base, key, _ = SH.gi.load_cfg()
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': prompt, 'n': 1, 'size': size, 'quality': 'high', 'response_format': 'b64_json',
               'image': ['local:' + os.path.abspath(p) for p in refs]}
    t = time.time(); err = ''
    for i in range(3):
        try:
            SH.gi.save_images(SH.gi.post_json(f'{base}/images/generations', key, payload, 900), out, False, False)
            return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        except (SystemExit, OSError) as e:
            err = str(e)
            if 'HTTP 400' in err: break
            time.sleep(65 if '429' in err else 10)
    return f'FAIL {os.path.basename(out)}: {err[:200]}'

# ---- 切帧：avatar_frames 的 3×3 → 4×4 ----
def cut16(alpha, n=16):
    """最大的 16 个连通块 = 16 帧（小碎块并入 100 像素内最近的一帧）；按中心落在哪一格排序"""
    lab, comps = components(alpha, min_cells=4)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); big, small = boxes[:n], boxes[n:]
    for s in small:
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        dist = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=dist)
        if dist(b) > 100: continue
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    Hh, Ww = alpha.shape
    for b in big:
        b['row'] = min(N - 1, int((b['y0'] + b['y1']) / 2 / (Hh / N))); b['col'] = min(N - 1, int((b['x0'] + b['x1']) / 2 / (Ww / N)))
    order = sorted(big, key=lambda b: (b['row'], b['col']))
    cells = [(b['row'], b['col']) for b in order]
    if len(set(cells)) != len(cells) or len(order) != n: print(f'  <-- CHECK 4×4：{len(order)} 块，格子 {cells}')
    return lab, order

def stick_groups(S, lab_g, ids):
    """替换 avatar_frames.stick_groups：刀剑的一根棍子会被拳头隔成几段（共线就合并）；格斗家每只拳头各一根短棒、常常平行，
    只合并首尾几乎挨着（沿轴缺口 < 24、横向偏移 < 12）的两段，不然两只拳头的棒子会被连成一根长棍"""
    segs = []
    for i in ids:
        ys, xs = np.where((lab_g == i) & S)
        if len(ys) < 25: continue
        Pt = np.stack([xs, ys], 1).astype(np.float32); c = Pt.mean(0)
        w, v = np.linalg.eigh(np.cov((Pt - c).T) + 1e-6 * np.eye(2)); segs.append({'P': Pt, 'c': c, 'd': v[:, 1], 'n': len(Pt)})
    segs.sort(key=lambda s: -s['n']); groups = []
    for s in segs:
        for g in groups:
            h = g[0]; nrm = np.array([-h['d'][1], h['d'][0]])
            if abs(float(np.dot(h['d'], s['d']))) < math.cos(math.radians(14)) or abs(float(np.dot(s['c'] - h['c'], nrm))) > 12: continue
            tg = np.concatenate([(q['P'] - h['c']) @ h['d'] for q in g]); ts = (s['P'] - h['c']) @ h['d']
            if max(0.0, float(ts.min() - tg.max()), float(tg.min() - ts.max())) < 24: g.append(s); break
        else: groups.append([s])
    return [np.concatenate([s['P'] for s in g]) for g in groups]

def clean_frames(fr):
    """格斗家原装没有白色、没有绿色的衣物：① 被围住的纯白块（下巴 / 衣领 / 拳头之间、腰带飘带和裤子之间透出来的白底）
    外圈是深色描边的挖掉（≥150 像素，眼睛高光留着；外圈是浅色的是绑带高光，留着）；② 占位棒留下的绿色偏色压回去（G ≤ max(R, B)）"""
    from avatar_frames import dil
    n = 0
    for F in fr.values():
        a = F['sub']; op = a[..., 3] > 100; rgb = a[..., :3].astype(np.int16)
        Wm = (rgb.min(-1) >= 236) & (rgb.max(-1) - rgb.min(-1) <= 16) & op
        lab, comps = components((Wm * 255).astype(np.uint8), f=1, min_cells=150)
        lum = rgb @ np.array([3, 6, 1]) / 10
        for c, _ in comps:
            reg = lab == c; ring = dil(reg, 5) & ~dil(reg, 2) & op & ~Wm
            if ring.sum() < 10 or ((lum[ring] > 150).mean() > 0.5 and (lum[ring] < 90).mean() < 0.3): continue
            grow = reg.copy()
            for _ in range(2): grow |= dil(grow) & (rgb.min(-1) >= 200) & op
            a[..., 3] = np.where(grow, 0, a[..., 3]); n += 1
        mx = np.maximum(rgb[..., 0], rgb[..., 2]); a[..., 1] = np.minimum(rgb[..., 1], mx).astype(np.uint8)
    return n

def fist_sticks(fr, name):
    """只留拳头握着的占位棒：按这一格的姿势参考小人（外框归一化后）看握点离哪只手 / 哪只脚尖最近；
    离脚尖近的丢掉（踢腿帧生图会在脚尖也画一截绿棒，绿色像素照样抠掉）；同一只手有两根的留离得近的那根。st['side'] = 'n' 近侧拳 / 'f' 远侧拳"""
    Qs = {f: Q for f, Q, _ in SHEETS[name]}; log = []; cnt = {'n': 0, 'f': 0}
    for fn, F in fr.items():
        J = joints(Qs[fn]); bx0, by0, bx1, by1 = jbox(J)
        norm = lambda p: ((p[0] - bx0) / (bx1 - bx0), (p[1] - by0) / (by1 - by0))
        cand = {k: norm(J[k]) for k in ('nh', 'fh', 'nt', 'ft')}
        h, w = F['sub'].shape[:2]; sts = F['sticks'][:4]
        uv = [((st['gx'] - F['org_l'][0]) / w, (st['gy'] - F['org_l'][1]) / h) for st in sts]
        best = min(itertools.permutations(cand, len(sts)), key=lambda perm: sum(math.hypot(u - cand[t][0], v - cand[t][1]) for (u, v), t in zip(uv, perm))) if sts else ()
        keep = []
        for st, t in zip(sts, best):   # 一一对应（总距离最小）：两只手靠得很近时也不会把两根都算给同一只手
            if t.endswith('t'): log.append(f'{fn}:脚'); continue
            st['side'] = t[0]; keep.append(st)
        if keep:
            L0 = max(s['t1'] - s['t0'] for s in keep)
            for s in keep: s['minor'] = (s['t1'] - s['t0']) < 0.5 * L0
        for s in keep: cnt[s['side']] += 1
        F['sticks'] = keep
    if log: print('  丢掉的占位棒：' + ' '.join(log))
    print(f'  拳头锚点：近侧拳 {cnt["n"]}/{len(fr)} 帧，远侧拳 {cnt["f"]}/{len(fr)} 帧')
    return cnt

def frames(names, dry=False):
    import frames as FR, frames2, avatar_frames as AF, avatar_head as AH, avatar_cuts as AC
    FR.HEIGHT['fighter'] = HEIGHT; AF.cut_boxes = cut16; AF.stick_groups = stick_groups; AC.FRAC.setdefault('fighter', (0.5, 0.86))
    fixes = json.load(open(AF.FIX)) if os.path.exists(AF.FIX) else {}
    pv = os.path.join(FS, 'cut'); os.makedirs(pv, exist_ok=True); os.makedirs(SPR, exist_ok=True)
    mp = os.path.join(SPR, 'spr.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {'res': RES, 'frames': {}}
    stats = {}
    for name in names:
        p = sheet_path(name)
        if not os.path.exists(p): print('没有原图', p); continue
        fn = [f for f, _, _ in SHEETS[name]]
        fr, base, k, _ = AF.process_sheet('fighter', name, p, fn, meta['res'], fixes, None)
        cnt = fist_sticks(fr, name); print(f'  挖掉被围住的白底 {clean_frames(fr)} 块')
        cyc = {f: F for f, F in fr.items() if f.startswith(CYCLE)}; rest = {f: F for f, F in fr.items() if f not in cyc}
        if cyc: AF.finish('fighter', 'run', cyc, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}_cycle.png'), dry)
        if rest: AF.finish('fighter', name, rest, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}.png'), dry)
        stats[name] = {'frames': len(fr), 'near': cnt['n'], 'far': cnt['f']}
    if dry: return stats
    meta['frames'] = dict(sorted(meta['frames'].items())); json.dump(meta, open(mp, 'w'), indent=1)
    m2, out, d = AH.heads_for_dir('fighter')
    for f, H in out.items():
        if H['q'] <= AH.Q_MAX:
            m2['frames'][f]['head'] = {x: H[x] for x in ('x', 'y', 'a')}
            if AH.face_hidden(H): m2['frames'][f]['head']['f'] = 0
        else: m2['frames'][f].pop('head', None)
    json.dump(m2, open(mp, 'w'), indent=1); AH.preview(d, out, os.path.join(pv, 'head.png'))
    bad = [f for f, H in out.items() if H['q'] > AH.Q_MAX]
    print(f'头部锚点：{len(out) - len(bad)}/{len(out)}，没找到：{" ".join(bad) or "无"}')
    cuts, skip, far = AC.cuts_for('fighter'); print(f'分割线：{len(cuts)} 帧，不可靠 {len(skip)}：{" ".join(skip)}')
    return stats

def class_art():
    """选角立绘：原装立绘去白底、裁到人物，高 420（同 class/sword.webp）"""
    a = np.array(remove_bg(Image.open(REF))); ys, xs = np.where(a[..., 3] > 30)
    sub = Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA'); k = 420 / sub.height
    out = os.path.join(HERE, 'final', 'class', 'fighter.webp')
    sub.resize((round(sub.width * k), 420), Image.LANCZOS).save(out, 'WEBP', quality=86, method=6); print(out)

def review():
    """审图总览：设计定稿 + 两张 4×4 原表（缩略）+ 切好的帧（和鬼剑士同比例并排）"""
    os.makedirs(WORK, exist_ok=True)
    def fit(im, h): im = im.convert('RGB'); return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    parts = [fit(Image.open(REF), 900)] + ([fit(Image.open(os.path.join(FS, 'design.png')), 900)] if os.path.exists(os.path.join(FS, 'design.png')) else [])
    cv = Image.new('RGB', (sum(p.width for p in parts) + 20 * len(parts), 920), 'white'); x = 10
    for p in parts: cv.paste(p, (x, 10)); x += p.width + 20
    cv.save(os.path.join(WORK, 'design.jpg'), quality=86)
    for name in SHEETS:
        for src, tag in ((sheet_path(name), 'sheet'), (guide_path(name), 'guide')):
            if os.path.exists(src): fit(Image.open(src), 1024).save(os.path.join(WORK, f'{tag}_{name}.jpg'), quality=84)
    meta = json.load(open(os.path.join(SPR, 'spr.json'))); sw = json.load(open(os.path.join(HERE, 'final', 'spr', 'sword', 'spr.json')))
    rows = [['idle'] + [f'run{i}' for i in range(1, 9)], [f'jump{i}' for i in range(1, 6)] + ['f_jkick1', 'f_jkick2'],
            [f for f, _, _ in COMBO[:8]], [f for f, _, _ in COMBO[8:]]]
    Z, cw, ch = 1, 190, 250
    M = Image.new('RGB', (cw * 10, ch * len(rows)), (58, 62, 72)); d = ImageDraw.Draw(M)
    swi = Image.open(os.path.join(HERE, 'final', 'spr', 'sword', 'idle.webp')).convert('RGBA'); S0 = sw['frames']['idle']
    for r, row in enumerate(rows):
        oy = r * ch + ch - 22
        M.paste(swi, (round(cw * 0.5 - S0['ax']), round(oy - S0['ay'])), swi); d.text((6, r * ch + 4), 'sword idle', fill=(160, 200, 255))
        for i, f in enumerate(row):
            F = meta['frames'].get(f); pth = os.path.join(SPR, f'{f}.webp')
            if not F or not os.path.exists(pth): continue
            im = Image.open(pth).convert('RGBA'); ox = (i + 1) * cw + cw * 0.5
            M.paste(im, (round(ox - F['ax']), round(oy - F['ay'])), im)
            for kk, col in (('wpn', (255, 60, 60)), ('wpn2', (60, 200, 255))):
                w = F.get(kk)
                if w:
                    gx, gy = ox - F['ax'] + w['gx'], oy - F['ay'] + w['gy']
                    d.line([gx, gy, gx + math.cos(w['ang']) * 24, gy + math.sin(w['ang']) * 24], fill=col, width=2); d.ellipse([gx - 3, gy - 3, gx + 3, gy + 3], outline=(255, 230, 0))
            if F.get('head'): hx, hy = ox - F['ax'] + F['head']['x'], oy - F['ay'] + F['head']['y']; d.ellipse([hx - 4, hy - 4, hx + 4, hy + 4], outline=(0, 255, 120), width=2)
            d.line([ox - 6, oy, ox + 6, oy], fill=(255, 255, 255)); d.text(((i + 1) * cw + 4, r * ch + 4), f, fill=(255, 230, 120))
    M.save(os.path.join(WORK, 'frames.jpg'), quality=86)
    # 一张总览（主线程只看这一张）：设计定稿 → 切好的帧 + 锚点 → 游戏内和鬼剑士并排（站立 / 跑 / 普攻 4 段，fighter_shots.mjs 先跑）
    Wd = 2400; fitw = lambda r: r.resize((Wd, round(r.height * Wd / r.width)), Image.LANCZOS)
    rows = [fitw(Image.open(os.path.join(WORK, 'design.jpg'))), fitw(M.convert('RGB'))]
    for n, nrow in (('engine_idle', 0), ('engine_run', 1), ('engine_combo', 3)):
        p = os.path.join(WORK, n + '.jpg')
        if not os.path.exists(p): continue
        E = Image.open(p).convert('RGB')
        if not nrow: rows.append(E.resize((round(E.width * 520 / E.height), 520), Image.LANCZOS)); continue
        ch = E.width / 6 * 170 / 300; rows.append(fitw(E.crop((0, 0, E.width, round(ch * nrow)))))   # 连拍每格 300×170（世界像素），6 列
    O = Image.new('RGB', (Wd, sum(r.height + 12 for r in rows)), (30, 32, 38)); y = 0
    for r in rows: O.paste(r, ((Wd - r.width) // 2, y)); y += r.height + 12
    O.save(os.path.join(WORK, 'overview.jpg'), quality=82); print('审图', WORK, O.size)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('names', nargs='*'); ap.add_argument('--only', default='')
    ap.add_argument('-j', type=int, default=2); ap.add_argument('--force', action='store_true'); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    os.makedirs(FS, exist_ok=True)
    if a.cmd == 'guides':
        for n in SHEETS: guide(n).save(guide_path(n)); print(guide_path(n))
    elif a.cmd == 'ref': print(gen(REF, REF_PROMPT, [os.path.join(SRC, 'sword_ref.png')], '1024x1536', a.force))
    elif a.cmd == 'design': print(gen(os.path.join(FS, 'design.png'), DESIGN_PROMPT, [REF], '1536x1024', a.force))
    elif a.cmd == 'sheets':
        L = [n for n in SHEETS if n.startswith(a.only)]
        for n in L:
            if not os.path.exists(guide_path(n)): guide(n).save(guide_path(n))
        with ThreadPoolExecutor(min(2, a.j)) as ex:
            for f in as_completed([ex.submit(gen, sheet_path(n), sheet_prompt(n), [REF, guide_path(n)], '2048x2048', a.force) for n in L]): print(f.result(), flush=True)
    elif a.cmd == 'frames': print(frames(a.names or list(SHEETS), a.dry))
    elif a.cmd == 'class': class_art()
    elif a.cmd == 'review': review()
    else: raise SystemExit('cmd: guides | ref | design | sheets | frames | class | review')

if __name__ == '__main__':
    main()
