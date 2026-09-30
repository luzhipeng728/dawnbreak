#!/usr/bin/env python3
"""男圣职者（priest）原装人物帧（docs/PRIEST_ART.md）。流水线照搬格斗家的 4×4 做法（docs/FIGHTER_ART_SAMPLES.md、fighter_art.py）：
原装立绘（参考鬼剑士的比例 / 画风）→ 三视图 → 姿势参考小人 4×4 → 一次出表 → 切帧 + 锚点。
和格斗家不同的只有武器：十字架是拿在手里的武器（同鬼剑士 / 魔法师的标准做法），姿势小人的近侧手握一根纯绿 #00FF00 占位棒（= 十字架的轴线：
拳头握在下端，另一侧露出一小截握柄；双手握时远侧拳握在同一根棒的更下面）。表里直接画占位棒（不画十字架，不再跑占位轮），
切帧用 avatar_frames 读出 wpn（握点 / 握点→尖端方向 / 身前身后 / 握拳轮廓），运行时按这条轨迹画任意一把十字架。
原图写到主仓库 art/src/priest/（不进 git）。
  priest_art.py guides                       姿势参考图 → <主仓库>/art/src/priest/guide_<表>.png（不花钱）
  priest_art.py ref | design [--force]       原装立绘 <主仓库>/art/src/priest_ref.png | 三视图 priest/design.png
  priest_art.py sheets [--only 表] [--force]  4×4 动作表 → priest/sheets/priest_<表>.png（已存在的跳过）
  priest_art.py frames [表...] [--dry]       切帧 → art/final/spr/priest/（只替换这些表的帧）+ 武器 / 头部锚点 + 分割线；预览 priest/cut/
  priest_art.py check                        体检（衣服闪烁 / 表内逐格 / 头部比例 / 走跑头部起伏和步幅 / 锚点），和鬼剑士、格斗家同一把尺子 → art/work/priest_samples/check.json
  priest_art.py class                        选角立绘 art/final/class/priest.webp（原装立绘去白底）
  priest_art.py review                       审图总览 → art/work/priest_samples/overview.jpg（设计 → 表 → 帧和锚点 → 占位十字架 → 和鬼剑士 / 格斗家并排 1 倍、4 倍）
生图约定：同一时间只发 1 个请求（共用账号），参考图传本地路径（local:），429 退避 65 秒（fighter_art.gen）。
"""
import os, sys, math, json, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
import fighter_art as FT
from prep import remove_bg
HERE, MAIN, SRC = FT.HERE, FT.MAIN, FT.SRC
PS = os.path.join(SRC, 'priest')
REF = os.path.join(SRC, 'priest_ref.png')
SPR = os.path.join(HERE, 'final', 'spr', 'priest')
WORK = os.path.join(HERE, 'work', 'priest_samples')
HEIGHT = 118                    # 站姿参考格的目标高度（世界单位）：鬼剑士 118、格斗家 112（膝盖微弯）；样表切完按头部大小和鬼剑士对过（docs/PRIEST_ART.md §4）
RES = 1.8                       # 帧像素 / 世界单位（和其他职业一样）
GREEN = FT.GREEN
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'

WHO = ('a tall, broad-shouldered young male priest warrior (DNF-style male Priest): short neat honey-blond hair, calm blue eyes, a kind but resolute face; '
       'a long high-collared holy-order coat in warm IVORY (cream white, never pure paper white) reaching to the knees, with gold trim along its edges and a royal-blue collar and cuffs; '
       'a royal-blue tabard panel down the front of the coat with a big gold cross emblem on the chest; small rounded ivory shoulder guards with gold rims; '
       'a brown leather belt with a round gold buckle bearing a cross; dark navy trousers; sturdy brown leather boots; brown leather gloves. '
       'No hat, no helmet, no headband, no cape, no jewelry')
CROSS = ('a big holy battle cross (a blunt two-handed weapon): a long straight silver-steel shaft with a brown leather-wrapped grip and a small round gold pommel at the lower end, '
         'and at the upper end a large solid cross head in silver with gold edges and a blue gem in the center; the whole cross is about as long as he is tall')

# ---- 姿势参考小人（4×4，每格 512；画法、比例同格斗家：蓝 = 近侧、红 = 远侧） ----
N, S, CELL = FT.N, FT.S, FT.CELL
NEAR, FAR, BODY, HEADC, OUT = FT.NEAR, FT.FAR, FT.BODY, FT.HEADC, FT.OUT
HEAD_R, NECK, TORSO, UA, FA, TH, SH_, FOOT, W, FIST = FT.HEAD_R, FT.NECK, FT.TORSO, FT.UA, FT.FA, FT.TH, FT.SH_, FT.FOOT, FT.W, FT.FIST
FIGH = TH + SH_ + TORSO + NECK + 2 * HEAD_R          # 小人站直的身高（约 346 像素）
STICK, BUTT, STW = round(FIGH * 0.46), round(FIGH * 0.07), 14   # 占位棒：握点 → 尖端约半个身高（整根十字架的轴线方向；运行时十字架按武器类型的大小画），握柄露出一小截
KEYS = ('lean', 'nth', 'nsh', 'fth', 'fsh', 'nua', 'nfa', 'fua', 'ffa', 'lift', 'wang', 'two')
P = lambda *v: dict(zip(KEYS, v + (0,) * (len(KEYS) - len(v))))
# 角度同格斗家：0 = 竖直向下，正 = 向前（面朝右），180 = 竖直向上；wang = 占位棒从握点指向尖端的方向；two = 远侧拳也握在棒上（握在近侧拳下面）
HANDS_T = ('He wears brown leather gloves on both hands (no green on them). ')
IDLE = P(2, 6, 4, -8, -8, 36, 90, -6, 6, 0, 160)
IDLE_T = ('standing idle: upright and calm, broad chest, feet slightly apart; the near hand holds the green stick at waist height in front of him, the stick standing upright '
          'and tilted slightly forward (like holding a tall staff), rising above his head in front of his face; the far arm hangs relaxed at his side with a loose fist')

# 走：日常放松的走路（格斗家的教训：别画成战斗架势）：身体直立、肩膀放松，腿和远侧手臂按 poseguide 的标准步态（和三职业同一套，±26°）；
# 近侧手像拄着手杖一样竖着拿十字架，只跟着摆一点（±8°）；头整圈一样高（别写 body at its lowest / highest）
WALK_T = {0: 'walk contact: near leg stepping forward on the heel, far leg stretched behind on its toes',
          90: 'walk passing: near leg straight under the body, far leg lifted with the knee bent passing forward',
          180: 'walk contact MIRRORED: far leg stepping forward on the heel, near leg stretched behind on its toes',
          270: 'walk passing MIRRORED: far leg straight under the body, near leg lifted passing forward'}
WALK_RELAX = ('a natural relaxed everyday walk, NOT a fighting stance: upright posture, shoulders relaxed; the near hand carries the green stick upright in front of him '
              'like a walking staff (it moves only a little), the free far arm hangs loosely and swings naturally opposite to the legs; '
              'the head stays at exactly the same height as in the other walk frames')
def walk_pose(ph):
    import poseguide as PG
    L = PG.pose_at(ph, False); arm = 26 * math.cos(math.radians(ph))
    return P(3, L['nth'], L['nsh'], L['fth'], L['fsh'], 36 - 0.3 * arm, 92, L['fua'], L['ffa'], 0, 160 - 0.3 * arm)
def walk_arm(ph):
    a = 26 * math.cos(math.radians(ph))
    return 'the far fist swung FORWARD' if a > 8 else 'the far fist swung BACK behind the hip' if a < -8 else 'the far arm hanging straight down at the side'
WALK = [(f'walk{i * 2 + 1}', walk_pose(ph), f'{WALK_T[ph]}; {walk_arm(ph)}; {WALK_RELAX}') for i, ph in enumerate((0, 90, 180, 270))]

# 跑：腿同格斗家 run1 / run3 / run5 / run7（长步幅、腾空帧只离地一点、头整圈差不多一样高）；远侧手臂大幅前后摆，
# 近侧手握十字架拖在身后下方（尖端朝后下，同鬼剑士跑步拖刀），手臂跟着小幅摆
RUN_T = ' Keep the head at almost the same height in every run frame (only a slight bob).'
RUN = [('run1', P(14, 38, 20, -40, -72, -40, 0, 45, 135, 0, -75),
        'run contact: body leaning forward, near leg reaching forward landing on the heel, far leg pushing off far behind; the far fist pumped forward; '
        'the near fist swung back low, the green stick trailing low behind him pointing down and back'),
       ('run3', P(14, -42, -52, 66, -4, -14, 26, -35, 55, 16, -68),
        'run FLIGHT: both feet just off the ground, legs spread wide: near leg stretched straight behind, far knee high in front; the far fist pumped back; '
        'the near fist low at the hip, the green stick still trailing low behind him pointing down and back'),
       ('run5', P(14, -40, -72, 38, 20, -10, 30, -40, 50, 0, -66),
        'run contact MIRRORED: far leg landing forward, near leg pushing off far behind; the far fist pumped back; the near fist low at the hip, '
        'the green stick trailing low behind him pointing down and back'),
       ('run7', P(14, 66, -4, -42, -52, -36, 4, 35, 125, 16, -76),
        'run FLIGHT MIRRORED: both feet just off the ground, near knee high in front, far leg stretched straight behind; the far fist pumped forward; '
        'the near fist swung back low, the green stick trailing low behind him')]
RUN = [(n, Q, t + RUN_T) for n, Q, t in RUN]

# 普攻：1 段 = 大力下劈（举过头 → 平挥 → 砸到身前地面），2 段 = 反手上撩（低位后摆 → 向前上挥 → 举过头），3 段起手 = 双手举过头（样表只出起手，测双手握的锚点）
ATK = [('a1_1', P(-6, 22, 6, -22, -34, -115, -135, 60, 85, 0, -130),
        'attack 1 wind-up: stepping forward, the near arm pulled back BEHIND the head at head height, the green stick pointing up and back behind him (it does not cross the face), ready for a big overhead downward swing; the far arm stretched forward for balance'),
       ('a1_2', P(18, 36, 10, -26, -42, 95, 95, -20, 25, 0, 95),
        'attack 1 strike: a powerful overhead swing coming down: lunging forward, the near arm swung forward at shoulder height, the green stick pointing straight FORWARD horizontally'),
       ('a1_3', P(26, 42, 16, -30, -46, 45, 30, -30, 10, 0, 52),
        'attack 1 follow-through: bent forward in a low lunge, the green stick swung all the way down in front, pointing diagonally down and forward with its tip just above the ground'),
       ('a2_1', P(8, 26, 0, -20, -36, -40, -20, 40, 70, 0, -55),
        'attack 2 wind-up: body twisted, the near fist pulled back low beside the hip, the green stick pointing down and back behind him, the far arm forward'),
       ('a2_2', P(-10, 30, 10, -20, -30, 90, 110, -30, 0, 0, 115),
        'attack 2 rising swing: the green stick swept forward and up in a big arc from below, now pointing forward and a little up at chest height, the near arm extended forward, leaning back slightly'),
       ('a2_3', P(-12, 22, 6, -16, -26, 110, 120, -40, -10, 0, 165),
        'attack 2 follow-through: the near arm raised up and forward in front of the face, the green stick pointing almost straight UP in front of him (not crossing the face)'),
       ('a3_1', P(-12, 34, 10, -28, -40, -115, -135, 0, 0, 0, -130, 1),
        'heavy smash wind-up: wide stance, leaning back, gripping the green stick with BOTH fists close together at its lower end, both hands pulled back BEHIND the head, the stick pointing up and back behind him, ready to smash down')]
SHEETS = {   # 表名 → 16 格 [(帧名, 姿势, 说明)]；第 1 格是站姿参考（idle，统一比例）
    'sample': [('idle', IDLE, IDLE_T)] + WALK + RUN + ATK,
}
CYCLE = ('run', 'walk')          # 这些帧按“躯干中线 + 同一行脚底基线”对齐（腾空帧保留离地高度）
FIX = {}                         # 手工修正（同 avatar_fix.json 的格式，key = '<表>/<帧>'；共享的 avatar_fix.json 不改）

def ik(S0, T, a=UA, b=FA):
    """两节手臂够到 T（够不到就伸直指向 T），肘朝下"""
    dx, dy = T[0] - S0[0], T[1] - S0[1]; d = min(max(math.hypot(dx, dy), abs(a - b) + 1), a + b - 1)
    base = math.atan2(dy, dx); A = math.acos((a * a + d * d - b * b) / (2 * a * d))
    E = max(((S0[0] + a * math.cos(base + s * A), S0[1] + a * math.sin(base + s * A)) for s in (1, -1)), key=lambda e: e[1])
    return E, (S0[0] + d * math.cos(base), S0[1] + d * math.sin(base))

def joints(Q):
    J = FT.joints(Q); u = (math.sin(math.radians(Q['wang'])), math.cos(math.radians(Q['wang']))); h = J['nh']
    bt = BUTT + (FIST * 2.6 if Q['two'] else 0)
    J['wt'] = (h[0] + u[0] * STICK, h[1] + u[1] * STICK); J['wb'] = (h[0] - u[0] * bt, h[1] - u[1] * bt)
    if Q['two']: J['fe'], J['fh'] = ik(J['sho'], (h[0] - u[0] * FIST * 2.2, h[1] - u[1] * FIST * 2.2))
    return J

def figure(d, cx, base, Q):
    """一个小人：身体 + 占位棒外框在格子里水平居中（伸出去的棒不进隔壁格），脚底在基线上"""
    J = joints(Q); hip, head, neck, sho = J['hip'], J['head'], J['neck'], J['sho']
    body = [p for k, p in J.items() if k not in ('wt', 'wb')]
    lowest = max(max(p[1] for p in body), head[1] + HEAD_R) + 8
    xs = [p[0] for p in J.values()] + [head[0] - HEAD_R, head[0] + HEAD_R + 20]
    dx, dy = cx - (min(xs) + max(xs)) / 2, base - lowest - Q['lift']
    T = lambda p: (p[0] + dx, p[1] + dy)
    def limb(a, b, col, w=W):
        d.line([T(a), T(b)], fill=OUT, width=w + 7); d.line([T(a), T(b)], fill=col, width=w)
        for p in (a, b): x, y = T(p); d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    def fist(h, col): x, y = T(h); d.ellipse([x - FIST, y - FIST, x + FIST, y + FIST], fill=col, outline=OUT, width=3)
    limb(sho, J['fe'], FAR); limb(J['fe'], J['fh'], FAR); fist(J['fh'], FAR)
    limb(hip, J['fk'], FAR); limb(J['fk'], J['fa'], FAR); limb(J['fa'], J['ft'], FAR, 20)
    limb(hip, neck, BODY, 48)
    x, y = T(head); d.ellipse([x - HEAD_R, y - HEAD_R, x + HEAD_R, y + HEAD_R], fill=HEADC, outline=OUT, width=5)
    d.polygon([(x + HEAD_R - 5, y - 6), (x + HEAD_R + 20, y + 5), (x + HEAD_R - 5, y + 17)], fill=HEADC, outline=OUT)
    d.ellipse([x + 28, y - 14, x + 41, y + 2], fill=OUT)
    limb(hip, J['nk'], NEAR); limb(J['nk'], J['na'], NEAR); limb(J['na'], J['nt'], NEAR, 20)
    d.line([T(J['wb']), T(J['wt'])], fill=GREEN, width=STW)
    limb(sho, J['ne'], NEAR); limb(J['ne'], J['nh'], NEAR); fist(J['nh'], NEAR)

def guide(name):
    im = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(im)
    for i, (_, Q, _) in enumerate(SHEETS[name]):
        r, c = divmod(i, N); figure(d, c * CELL + CELL * 0.5, r * CELL + CELL * 0.94, Q)
    return im

def guide_path(name): return os.path.join(PS, f'guide_{name}.png')
def sheet_path(name): return os.path.join(PS, 'sheets', f'priest_{name}.png')

def sheet_prompt(name):
    per = '; '.join(f'({i + 1}) {t}' for i, (_, _, t) in enumerate(SHEETS[name]))
    return ('The FIRST image is the character (he carries a big holy battle cross). The SECOND image is a pose guide: 16 simple mannequin figures in a 4x4 grid. '
            'Draw a professional 2D game sprite animation sheet of this exact chibi character: redraw the character from the first image 16 times, in exactly the same 4x4 layout as the pose guide, '
            'each copy copying EXACTLY the pose of the mannequin in the same cell: the same body lean, the same angle of every upper arm, forearm, thigh and shin, the same foot placement and the same height above the ground. '
            "In the pose guide the BLUE arm and BLUE leg are the character's NEAR side (closer to the viewer, drawn in front of the body) and the RED arm and RED leg are the FAR side (behind the body). "
            f'WEAPON: in this sheet do NOT draw the battle cross at all. Instead, in EVERY frame the near (blue) hand is a clenched fist gripping ONE long, perfectly straight, rigid stick painted in ONE flat pure green color ({GREEN}) '
            'that stands in for the whole cross weapon: exactly the same position, angle and length as the green stick in the pose guide; the fist grips it close to its lower end, '
            'so a short piece of the stick sticks out on the other side of the fist; no outline, no shading, no highlight, no cross-bar, no head, no decoration, uniform thickness about two fingers wide. '
            'The green stick is the ONLY thing copied literally from the pose guide. Where the pose guide shows both fists on the stick, both hands grip the same stick; '
            f'otherwise the far hand holds nothing. {HANDS_T}Nothing else is green: the clothes, gloves, boots and belt have no green at all. '
            f'Frame by frame (left to right, top to bottom): {per}. '
            "Keep the character's own design, face, hair, colors, clothing (the long ivory coat with gold trim, the royal-blue tabard with the gold cross, the belt with the cross buckle), "
            'proportions and cute chibi art style with thick outlines exactly as in the first image; the coat is warm ivory, never pure white; do NOT draw the mannequin colors or shapes on the character. '
            'Every figure faces RIGHT in strict side view, all at exactly the same scale as frame (1), with wide white gaps between the cells so that no figure or stick touches or overlaps another; '
            'the feet of the grounded figures in each row stand on the same baseline. Plain pure white background, no ground, no shadows, no text, no numbers, no speed lines, no motion trails, no glow, no effects.')

REF_PROMPT = ('The image shows a chibi character from our 2D action game. Draw a NEW, different character in EXACTLY the same art style: the same chibi proportions '
              '(the same big head relative to the body), the same thick outlines, the same cel shading and color saturation, '
              f'the same framing (full body, centered) and the same strict side view facing RIGHT: {WHO}. '
              'His body is a little taller and clearly broader in the shoulders and chest than the reference character (a big, sturdy holy warrior), but he keeps the same head size and the same cute chibi proportions. '
              f'He carries his weapon, {CROSS}. '
              'Pose: standing calm and upright, feet slightly apart; his near hand grips the cross low on its shaft at waist height in front of him, the cross standing upright and tilted slightly forward '
              'so that its cross head is above his head, in front of his face; his far arm hangs relaxed at his side. '
              'No green and no magenta anywhere. Plain pure white background, no text, no effects, no glow, no shadow.')
DESIGN_PROMPT = ('Character model sheet of this exact chibi character (same face, same hair, same outfit, same colors, same proportions, same weapon, same cute art style with thick outlines): '
                 'three full-body views side by side at exactly the same scale, all standing relaxed and upright, holding the battle cross upright in the right hand with its lower end resting on the ground beside the foot: '
                 '(1) front view, (2) three-quarter view turned toward the right, (3) strict side view facing right. Evenly spaced with wide white gaps. '
                 'Plain pure white background, no text, no labels, no effects, no shadow.')

# ---- 切帧（avatar_frames：抠占位棒 + 补色 + 握点 / 握拳轮廓；4×4 用格斗家的 cut16） ----
def deteal(fr):
    """握点附近的青色残留（占位棒的绿和手套的阴影混出来的，样表里 ≤42 像素 / 帧）：按亮度改成手套的棕色（设计里只有宝蓝、没有青色）"""
    n = 0
    for F in fr.values():
        a = F['sub']; rgb = a[..., :3].astype(np.float32) / 255; mx, mn = rgb.max(-1), rgb.min(-1); dd = np.maximum(mx - mn, 1e-6)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        hue = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
        m = (a[..., 3] > 0) & (hue >= 150) & (hue <= 200) & ((mx - mn) / np.maximum(mx, 1e-6) > 0.3)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; near = np.zeros_like(m); ox, oy = F['org_l']
        for st in F['sticks']:
            near |= np.hypot(xx - (st['gx'] - ox), yy - (st['gy'] - oy)) < 80
        m &= near; n += int(m.sum())
        a[..., :3] = np.where(m[..., None], np.clip(np.stack([mx, mx * 0.66, mx * 0.45], -1) * 255, 0, 255), a[..., :3]).astype(np.uint8)
    return n

def frames(names, dry=False):
    """切帧：4×4 → 帧 + 武器锚点（wpn）+ 头部锚点 + 分割线。比例两遍（同格斗家）：第一遍按第 1 格（idle）高度定缩放，
    第二遍按“动作格的头 / idle 的头”的中位数把动作格放大回来（同一张表第 1 格总被画得大一点）"""
    import frames as FR, avatar_frames as AF, avatar_head as AH, avatar_cuts as AC, avatar_sizecheck as SZ
    FR.HEIGHT['priest'] = HEIGHT; AF.cut_boxes = FT.cut16; AC.FRAC.setdefault('priest', (0.5, 0.86))
    pv = os.path.join(PS, 'cut'); os.makedirs(pv, exist_ok=True); os.makedirs(SPR, exist_ok=True)
    mp = os.path.join(SPR, 'spr.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {'res': RES, 'frames': {}}
    stats = {}; done = []
    def fin(name, fr, base, k, only=None):
        sel = {f: F for f, F in fr.items() if only is None or f in only}
        cyc = {f: F for f, F in sel.items() if f.startswith(CYCLE)}; rest = {f: F for f, F in sel.items() if f not in cyc}
        if cyc: AF.finish('priest', 'run', cyc, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}_cycle.png'), dry)
        if rest: AF.finish('priest', name, rest, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}.png'), dry)
    def heads():
        json.dump(meta, open(mp, 'w'), indent=1); m2, out, d = AH.heads_for_dir('priest')
        for f, H in out.items():
            if H['q'] <= AH.Q_MAX:
                m2['frames'][f]['head'] = {x: H[x] for x in ('x', 'y', 'a')}
                if AH.face_hidden(H): m2['frames'][f]['head']['f'] = 0
            else: m2['frames'][f].pop('head', None)
        return m2, out, d
    for name in names:
        p = sheet_path(name)
        if not os.path.exists(p): print('没有原图', p); continue
        fn = [f for f, _, _ in SHEETS[name]]
        fr, base, k, _ = AF.process_sheet('priest', name, p, fn, meta['res'], FIX, None)
        print(f'  挖掉被围住的白底 {FT.clean_frames(fr)} 块，握点附近青色残留改成手套色 {deteal(fr)} 像素')
        fin(name, fr, base, k)
        stats[name] = {'frames': len(fr), 'wpn': sum(1 for F in fr.values() if any(not s.get('minor') for s in F['sticks']))}; done.append((name, fr, base, k))
    if dry: return stats
    meta['frames'] = dict(sorted(meta['frames'].items())); m2, out, d = heads(); meta.update(m2)
    T, M = SZ.head_tpl(SZ.load(SPR, 'idle')); again = False
    for name, fr, base, k in done:
        sc = [SZ.head_scale(SZ.load(SPR, f), m2['frames'][f]['head'], T, M) for f in fr if f != 'idle' and m2['frames'][f].get('head')]
        sc = sorted(v for v, e in sc if e < SZ.ERR_MAX); med = sc[len(sc) // 2] if sc else 1.0; stats[name]['scale'] = med
        if abs(med - 1) > 0.03: fin(name, fr, base, k / med, [f for f in fr if f != 'idle']); again = True
    print('每张表动作格的头 / idle 的头（第一遍）：' + '  '.join(f'{n} {stats[n]["scale"]:.2f}' for n, *_ in done))
    if again: meta['frames'] = dict(sorted(meta['frames'].items())); m2, out, d = heads(); meta.update(m2)
    AH.preview(d, out, os.path.join(pv, 'head.png'))
    bad = [f for f, H in out.items() if H['q'] > AH.Q_MAX]
    print(f'头部锚点：{len(out) - len(bad)}/{len(out)}，没找到：{" ".join(bad) or "无"}')
    json.dump(m2, open(mp, 'w'), indent=1)
    cuts, skip, far = AC.cuts_for('priest'); print(f'分割线：{len(cuts)} 帧，不可靠 {len(skip)}：{" ".join(skip)}')
    return stats

def class_art():
    """选角立绘：原装立绘去白底（十字架杆和脸之间围住的白底一起挖掉）、裁到人物（含十字架），高 420（同 class/sword.webp）"""
    from avatar_frames import fill_holes
    a = np.array(fill_holes(remove_bg(Image.open(REF)), min_area=90, thr=251)); ys, xs = np.where(a[..., 3] > 30)
    sub = Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA'); k = 420 / sub.height
    out = os.path.join(HERE, 'final', 'class', 'priest.webp')
    sub.resize((round(sub.width * k), 420), Image.LANCZOS).save(out, 'WEBP', quality=86, method=6); print(out)

# ---- 体检：走 / 跑的头部起伏和步幅（test/animfeel.mjs 的口径，离线算：样表只有 4 相位，三个职业都取同样 4 帧比） ----
SPEED = {'walk': (165, 8 / 12), 'run': (300, 8 / 20)}   # 移速（世界单位 / 秒，鬼剑士 / 格斗家同值）、一圈时长（8 帧 × 游戏里每帧停留）

def spr(cls):
    d = os.path.join(HERE, 'final', 'spr', cls); return d, json.load(open(os.path.join(d, 'spr.json')))

def feet(d, F, f, res):
    """这一帧贴地的脚：锚点上方 6 像素内的不透明列聚成块 → 相对锚点的世界坐标（同 animfeel）"""
    a = np.array(Image.open(os.path.join(d, f + '.webp')).convert('RGBA'))[..., 3] > 60
    y1 = min(a.shape[0], round(F['ay']) + 1); y0 = max(0, min(y1 - 1, round(F['ay']) - 6)); col = a[y0:y1].any(0)
    out = []; s = -1
    for i in range(len(col) + 1):
        if i < len(col) and col[i]:
            if s < 0: s = i
        elif s >= 0:
            if i - s >= 3: out.append(((s + i - 1) / 2 - F['ax']) / res)
            s = -1
    return out

def loco(cls, fs, kind):
    """一圈 fs（首尾相接）：头部相对脚底锚点的逐帧跳动（最大 / 平均）、上下起伏、前后晃；步幅匹配 = 贴地的脚逐帧往后挪的距离加起来 / 同一圈身体走的距离"""
    d, meta = spr(cls); res = meta['res']; Fs = meta['frames']
    fs = [f for f in fs if f in Fs]
    if len(fs) < 2: return None
    hp = [((Fs[f]['head']['x'] - Fs[f]['ax']) / res, (Fs[f]['head']['y'] - Fs[f]['ay']) / res) if Fs[f].get('head') else None for f in fs]
    jumps = [math.hypot(hp[i][0] - hp[i - 1][0], hp[i][1] - hp[i - 1][1]) for i in range(len(fs)) if hp[i] and hp[i - 1]]
    ft = [feet(d, Fs[f], f, res) for f in fs]; art = 0.0
    for i in range(len(fs)):
        best = None
        for a in ft[i - 1]:
            for b in ft[i]:
                v = a - b
                if -1 <= v <= 36 and (best is None or v < best): best = v
        if best is not None: art += max(0.0, best)
    sp, cyc = SPEED[kind]; hy = [h[1] for h in hp if h]; hx = [h[0] for h in hp if h]
    return {'frames': fs, 'headJumpMax': round(max(jumps), 2) if jumps else None, 'headJumpMean': round(float(np.mean(jumps)), 2) if jumps else None,
            'headBobY': round(max(hy) - min(hy), 2) if hy else None, 'headSwayX': round(max(hx) - min(hx), 2) if hx else None, 'strideMatch': round(art / (sp * cyc), 3)}

def check():
    """样表体检（结果 art/work/priest_samples/check.json）：① 走 / 跑头部起伏和步幅（三个职业同样取 1/3/5/7 四帧）；② 衣服闪烁（avatar_flicker 离群分，
    鬼剑士 / 格斗家也按同样的 4 帧算）；③ 表内逐格直方图差（同一个动作的相邻格）；④ 头部比例（每帧的头是 idle 的几倍）；⑤ 锚点（武器 / 头 / 分割线）"""
    import avatar_flicker as FL, avatar_sheetflicker as SF, avatar_frames as AF, avatar_sizecheck as SZ
    rep = {'loco': {}, 'flicker': {}, 'sheet': {}, 'scale': {}}
    W4, R4 = [f'walk{i}' for i in (1, 3, 5, 7)], [f'run{i}' for i in (1, 3, 5, 7)]
    for cls in ('priest', 'sword', 'fighter'):
        rep['loco'][cls] = {'walk': loco(cls, W4, 'walk'), 'run': loco(cls, R4, 'run')}
        if cls != 'priest': rep['loco'][cls + '_8'] = {'walk': loco(cls, [f'walk{i}' for i in range(1, 9)], 'walk'), 'run': loco(cls, [f'run{i}' for i in range(1, 9)], 'run')}
        FL.CLIPS['walk4'] = ['idle'] + W4; FL.CLIPS['run4'] = R4
        rep['flicker'][cls] = {c: max(FL.outliers(cls, c).values()) for c in ('walk4', 'run4')}
        d, meta = spr(cls); T, M = SZ.head_tpl(SZ.load(d, 'idle')); sc = {}
        for f, F in meta['frames'].items():
            if F.get('head'): s_, e_ = SZ.head_scale(SZ.load(d, f), F['head'], T, M); sc[f] = (s_, e_)
        ok = {f: v[0] for f, v in sc.items() if v[1] < SZ.ERR_MAX}; dev = sorted(abs(v - 1) for v in ok.values())
        rep['scale'][cls] = {'frames': len(sc), 'trusted': len(ok), 'median_dev': round(dev[len(dev) // 2], 3) if dev else None,
                             'over12': sorted((f, round(v, 2)) for f, v in ok.items() if abs(v - 1) > 0.12)}
    cb = AF.cut_boxes; AF.cut_boxes = FT.cut16
    for n in SHEETS:
        if not os.path.exists(sheet_path(n)): continue
        c = SF.cells(sheet_path(n)); names = [f for f, _, _ in SHEETS[n]]; H = lambda i, j: round(0.5 * float(np.abs(c[i][0] - c[j][0]).sum()), 3)
        grp = {}
        for i, f in enumerate(names): grp.setdefault(f.rstrip('0123456789').rstrip('_') if not f.startswith('a') else f[:2], []).append(i)
        rep['sheet'][n] = {g: [H(ix[k], ix[(k + 1) % len(ix)]) for k in range(len(ix))] for g, ix in grp.items() if len(ix) > 1}
        rep['sheet'][n]['idle_vs_walk'] = [H(0, i) for i in grp.get('walk', [])]
    AF.cut_boxes = cb
    d, meta = spr('priest'); Fs = meta['frames']; want = [f for v in SHEETS.values() for f, _, _ in v if f]
    rep['anchors'] = {'frames': len(Fs), 'missing': [f for f in want if f not in Fs], 'head': sum(1 for F in Fs.values() if F.get('head')), 'cut': sum(1 for F in Fs.values() if F.get('cut')),
                      'wpn': sum(1 for F in Fs.values() if F.get('wpn')), 'no_wpn': [f for f, F in Fs.items() if not F.get('wpn')], 'wpn2': [f for f, F in Fs.items() if F.get('wpn2')],
                      'front': {f: F['wpn']['front'] for f, F in Fs.items() if F.get('wpn')}, 'hand_polys': {f: len(F['wpn'].get('hand', [])) for f, F in Fs.items() if F.get('wpn')},
                      'ang': {f: round(math.degrees(F['wpn']['ang'])) for f, F in Fs.items() if F.get('wpn')},
                      'outside': [f for f, F in Fs.items() if F.get('wpn') and not (-10 <= F['wpn']['gx'] <= F['w'] + 10 and -10 <= F['wpn']['gy'] <= F['h'] + 10)]}
    rep['size'] = {cls: {'idle_h': round(spr(cls)[1]['frames']['idle']['h'] / RES, 1), 'idle_w': round(spr(cls)[1]['frames']['idle']['w'] / RES, 1)} for cls in ('priest', 'sword', 'fighter')}
    os.makedirs(WORK, exist_ok=True); json.dump(rep, open(os.path.join(WORK, 'check.json'), 'w'), ensure_ascii=False, indent=1)
    for cls, v in rep['loco'].items():
        for k, m in v.items():
            if m: print(f'{cls:10s} {k:4s} 头部每帧最大跳 {m["headJumpMax"]} 平均 {m["headJumpMean"]} 起伏 {m["headBobY"]} 前后 {m["headSwayX"]} 步幅匹配 {m["strideMatch"]}')
    for k, v in rep['flicker'].items(): print(f'闪烁 {k:8s} {v}')
    for k, v in rep['scale'].items(): print(f'比例 {k:8s} {v["trusted"]}/{v["frames"]} 帧可信，偏差中位 {v["median_dev"]}，>12%：{v["over12"]}')
    print('表内逐格', rep['sheet']); print('锚点', rep['anchors']); print('大小', rep['size'])

# ---- 审图 ----
def draw_cross(d, gx, gy, ang, L):
    """占位十字架（只用于审图：看锚点拿在手里的样子；正式武器图另做）：握点 (gx, gy) → 尖端方向 ang，全长 L（握柄在握点后露出 0.1L）"""
    u, n = (math.cos(ang), math.sin(ang)), (-math.sin(ang), math.cos(ang))
    Q = lambda pts: [(gx + x * u[0] + y * n[0], gy + x * u[1] + y * n[1]) for x, y in pts]
    w = max(3.0, L * 0.04); bar, bx = L * 0.22, L * 0.72; ol, sil, gold = (40, 36, 44, 255), (205, 210, 224, 255), (222, 178, 70, 255)
    rect = lambda x0, x1, h: [(x0, -h), (x1, -h), (x1, h), (x0, h)]
    d.polygon(Q(rect(-L * 0.1, L * 0.9, w)), fill=sil, outline=ol, width=2)
    d.polygon(Q(rect(bx - w * 1.2, bx + w * 1.2, bar)), fill=sil, outline=ol, width=2)
    d.polygon(Q(rect(-L * 0.1, L * 0.08, w * 1.15)), fill=(120, 80, 50, 255), outline=ol, width=2)
    c = Q([(bx, 0)])[0]; r = w * 1.4; d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=(70, 110, 220, 255), outline=gold, width=2)

def with_cross(f, meta_f, d, L_px):
    """帧 + 占位十字架（身后的画在帧之前，身前的画在帧之后再把握拳轮廓盖回去：同运行时 avatar.js 的顺序）"""
    im = Image.open(os.path.join(d, f + '.webp')).convert('RGBA'); w = meta_f.get('wpn')
    pad = L_px + 10; C = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    if not w: C.alpha_composite(im, (pad, pad)); return C, pad
    X = Image.new('RGBA', C.size, (0, 0, 0, 0)); draw_cross(ImageDraw.Draw(X), pad + w['gx'], pad + w['gy'], w['ang'], L_px)
    if not w['front']: C.alpha_composite(X); C.alpha_composite(im, (pad, pad)); return C, pad
    C.alpha_composite(im, (pad, pad)); C.alpha_composite(X)
    for poly in w.get('hand', []):
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).polygon([(poly[j], poly[j + 1]) for j in range(0, len(poly), 2)], fill=255)
        hand = Image.new('RGBA', im.size, (0, 0, 0, 0)); hand.paste(im, (0, 0), Image.fromarray(np.minimum(np.array(m), np.array(im)[..., 3]).astype(np.uint8)))
        C.alpha_composite(hand, (pad, pad))
    return C, pad

def review():
    """一张总览（主线程只看这一张）：设计（原装立绘 + 三视图）→ 姿势小人 + 样表 → 切好的 16 帧和锚点（左边是鬼剑士 / 格斗家 idle，同比例）
    → 占位十字架拿在手里（运行时同样的叠放顺序）→ 1 倍（世界比例）和 4 倍：鬼剑士、格斗家、圣职者并排"""
    os.makedirs(WORK, exist_ok=True); font = lambda s: ImageFont.truetype(FONT, s)
    def fit(im, h): im = im.convert('RGB'); return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    def bg(im, col=(58, 62, 72)): o = Image.new('RGB', im.size, col); o.paste(im, (0, 0), im); return o
    parts = [fit(Image.open(REF), 820)] + ([fit(Image.open(os.path.join(PS, 'design.png')), 820)] if os.path.exists(os.path.join(PS, 'design.png')) else [])
    D = Image.new('RGB', (sum(p.width for p in parts) + 20 * len(parts), 840), 'white'); x = 10
    for p in parts: D.paste(p, (x, 10)); x += p.width + 20
    D.save(os.path.join(WORK, 'design.jpg'), quality=86)
    G = [fit(Image.open(p), 900) for p in (guide_path('sample'), sheet_path('sample')) if os.path.exists(p)]
    SH = Image.new('RGB', (sum(g.width for g in G) + 20 * len(G), 920), 'white'); x = 10
    for g in G: SH.paste(g, (x, 10)); x += g.width + 20
    dP, mP = spr('priest'); dS, mS = spr('sword'); dF, mF = spr('fighter')
    names = [f for f, _, _ in SHEETS['sample']]
    # 帧 + 锚点（帧像素 1:1，三个职业同一个 res）：红线 = 武器方向（身前），蓝线 = 身后，黄圈 = 握点，青 = 握拳轮廓，绿圈 = 头部锚点
    cw, ch = 260, 330; per = 9
    rows = [['S:idle', 'F:idle'] + names[:7], names[7:]]
    Fr = Image.new('RGB', (cw * per, ch * len(rows)), (58, 62, 72)); d = ImageDraw.Draw(Fr)
    for r, row in enumerate(rows):
        oy = r * ch + ch - 30
        for i, f in enumerate(row):
            dd, mm, fn = (dS, mS, 'idle') if f == 'S:idle' else (dF, mF, 'idle') if f == 'F:idle' else (dP, mP, f)
            F = mm['frames'].get(fn)
            if not F: continue
            im = Image.open(os.path.join(dd, fn + '.webp')).convert('RGBA'); ox = i * cw + cw / 2
            Fr.paste(im, (round(ox - F['ax']), round(oy - F['ay'])), im)
            for kk in ('wpn', 'wpn2'):
                w = F.get(kk) if dd == dP else None
                if not w: continue
                gx, gy = ox - F['ax'] + w['gx'], oy - F['ay'] + w['gy']; col = (255, 60, 60) if w['front'] else (60, 140, 255)
                d.line([gx, gy, gx + math.cos(w['ang']) * w['len'], gy + math.sin(w['ang']) * w['len']], fill=col, width=3)
                d.ellipse([gx - 5, gy - 5, gx + 5, gy + 5], outline=(255, 230, 0), width=2)
                for poly in w.get('hand', []):
                    pts = [(ox - F['ax'] + poly[j], oy - F['ay'] + poly[j + 1]) for j in range(0, len(poly), 2)]; d.line(pts + [pts[0]], fill=(0, 255, 255), width=1)
            if dd == dP and F.get('head'): hx, hy = ox - F['ax'] + F['head']['x'], oy - F['ay'] + F['head']['y']; d.ellipse([hx - 5, hy - 5, hx + 5, hy + 5], outline=(0, 255, 120), width=2)
            d.line([ox - 10, oy, ox + 10, oy], fill=(255, 255, 255)); d.text((i * cw + 6, r * ch + 6), {'S:idle': '鬼剑士 idle', 'F:idle': '格斗家 idle'}.get(f, f), fill=(255, 230, 120), font=font(22))
    Fr.save(os.path.join(WORK, 'frames.jpg'), quality=86)
    # 占位十字架（运行时预览；长度 = 0.8 个身高）
    Lc = round(HEIGHT * 0.8 * RES); cw2 = 330; Cr = Image.new('RGB', (cw2 * 8, 2 * 400), (58, 62, 72)); d2 = ImageDraw.Draw(Cr)
    for i, f in enumerate(names):
        F = mP['frames'].get(f)
        if not F: continue
        C, pad = with_cross(f, F, dP, Lc); r, c = divmod(i, 8); ox, oy = c * cw2 + cw2 / 2, r * 400 + 400 - 40
        Cr.paste(C, (round(ox - F['ax'] - pad), round(oy - F['ay'] - pad)), C); d2.text((c * cw2 + 6, r * 400 + 6), f, fill=(255, 230, 120), font=font(22))
    Cr.save(os.path.join(WORK, 'cross.jpg'), quality=86)
    # 1 倍（世界比例：帧像素 / res）和 4 倍（最近邻）：鬼剑士 / 格斗家 / 圣职者 idle、walk1、run1，圣职者再加 a1_2（带占位十字架）
    line = [(dS, mS, 'idle', '鬼剑士'), (dF, mF, 'idle', '格斗家'), (dP, mP, 'idle', '圣职者'), (dS, mS, 'walk1', ''), (dF, mF, 'walk1', ''), (dP, mP, 'walk1', ''),
            (dS, mS, 'run1', ''), (dF, mF, 'run1', ''), (dP, mP, 'run1', ''), (dP, mP, 'a1_2', '')]
    k = 1 / RES; uw, uh = 80, 196; X1 = Image.new('RGBA', (uw * len(line), uh), (58, 62, 72, 255))
    for i, (dd, mm, f, _) in enumerate(line):
        F = mm['frames'].get(f)
        if not F: continue
        if dd == dP: C, pad = with_cross(f, F, dd, Lc)
        else: C, pad = Image.open(os.path.join(dd, f + '.webp')).convert('RGBA'), 0
        C = C.resize((max(1, round(C.width * k)), max(1, round(C.height * k))), Image.LANCZOS)
        X1.alpha_composite(C, (round(i * uw + uw / 2 - (F['ax'] + pad) * k), round(uh - 12 - (F['ay'] + pad) * k)))
    X1 = X1.convert('RGB'); X1.save(os.path.join(WORK, 'scale_1x.png'))
    X4 = X1.crop((0, 0, uw * 6 + 24, uh)).resize(((uw * 6 + 24) * 4, uh * 4), Image.NEAREST); X4.save(os.path.join(WORK, 'scale_4x.png'))
    # 总览
    Wd = 2400; fitw = lambda r: r.resize((Wd, round(r.height * Wd / r.width)), Image.LANCZOS)
    def title(t): T = Image.new('RGB', (Wd, 54), (30, 32, 38)); ImageDraw.Draw(T).text((14, 10), t, fill=(255, 230, 150), font=font(30)); return T
    chk = json.load(open(os.path.join(WORK, 'check.json'))) if os.path.exists(os.path.join(WORK, 'check.json')) else None
    blocks = [title('1 设计定稿：原装立绘（参考鬼剑士比例 / 画风）+ 三视图'), fitw(D), title('2 姿势小人（蓝 = 近侧，绿棒 = 十字架轴线）→ 4×4 样表（1 次生图）'), fitw(SH),
              title('3 切好的 16 帧 + 锚点（红 / 蓝线 = 武器方向 身前 / 身后，黄圈 = 握点，青 = 握拳轮廓，绿圈 = 头）；左边两格鬼剑士 / 格斗家同比例'), fitw(Fr),
              title('4 占位十字架按锚点拿在手里（运行时同样的叠放顺序；正式武器图另做）'), fitw(Cr),
              title('5 游戏比例 1 倍（鬼剑士 / 格斗家 / 圣职者：站、走、跑，最后一格圣职者普攻 1）'), X1.resize((X1.width * 2, X1.height * 2), Image.NEAREST),
              title('   4 倍（最近邻）：站、走'), X4.resize((min(Wd, X4.width), round(X4.height * min(Wd, X4.width) / X4.width)), Image.NEAREST)]
    if chk:
        L = chk['loco']; t = lambda c, k2: L[c][k2] or {}
        txt = ('指标（4 帧：walk1/3/5/7、run1/3/5/7，三个职业同口径；世界单位；跑步 4 帧里着地 / 腾空帧交替，步幅量不到，不列）\n' + '\n'.join(
            f'{n}：走 头部每帧最大跳 {t(c, "walk").get("headJumpMax")} 起伏 {t(c, "walk").get("headBobY")} 步幅匹配 {t(c, "walk").get("strideMatch")}   '
            f'跑 最大跳 {t(c, "run").get("headJumpMax")} 起伏 {t(c, "run").get("headBobY")}   '
            f'闪烁 walk {chk["flicker"][c]["walk4"]} run {chk["flicker"][c]["run4"]}   头部比例偏差中位 {chk["scale"][c]["median_dev"]}'
            for n, c in (('圣职者', 'priest'), ('鬼剑士', 'sword'), ('格斗家', 'fighter'))) +
            f'\n锚点：武器 {chk["anchors"]["wpn"]}/{chk["anchors"]["frames"]} 帧，头 {chk["anchors"]["head"]}，分割线 {chk["anchors"]["cut"]}')
        T = Image.new('RGB', (Wd, 230), (30, 32, 38)); ImageDraw.Draw(T).multiline_text((14, 10), txt, fill=(220, 230, 240), font=font(26), spacing=10); blocks.append(T)
    O = Image.new('RGB', (Wd, sum(b.height + 8 for b in blocks)), (30, 32, 38)); y = 0
    for b in blocks: O.paste(b, ((Wd - b.width) // 2, y)); y += b.height + 8
    O.save(os.path.join(WORK, 'overview.jpg'), quality=82); print('审图', os.path.join(WORK, 'overview.jpg'), O.size)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('names', nargs='*'); ap.add_argument('--only', default='')
    ap.add_argument('--force', action='store_true'); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    os.makedirs(PS, exist_ok=True)
    if a.cmd == 'guides':
        for n in SHEETS: guide(n).save(guide_path(n)); print(guide_path(n))
    elif a.cmd == 'ref': print(FT.gen(REF, REF_PROMPT, [os.path.join(SRC, 'sword_ref.png')], '1024x1536', a.force))
    elif a.cmd == 'design': print(FT.gen(os.path.join(PS, 'design.png'), DESIGN_PROMPT, [REF], '1536x1024', a.force))
    elif a.cmd == 'sheets':
        for n in [n for n in SHEETS if n.startswith(a.only)]:   # 串行：同一时间只发 1 个请求
            if not os.path.exists(guide_path(n)): guide(n).save(guide_path(n))
            print(FT.gen(sheet_path(n), sheet_prompt(n), [REF, guide_path(n)], '2048x2048', a.force), flush=True)
    elif a.cmd == 'frames': print(frames(a.names or list(SHEETS), a.dry))
    elif a.cmd == 'check': check()
    elif a.cmd == 'class': class_art()
    elif a.cmd == 'review': review()
    else: raise SystemExit('cmd: guides | ref | design | sheets | frames | check | class | review')

if __name__ == '__main__':
    main()
