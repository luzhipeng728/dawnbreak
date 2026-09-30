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
  priest_art.py regreen [表...]              黄绿色的占位棒刷回纯绿（祈祷 / 祝福类格子常见），原图备份 sheets/_pre/
  priest_art.py frames [表...] [--dry]       切帧 → art/final/spr/priest/（只替换这些表的帧）+ 武器 / 头部锚点 + 分割线；预览 priest/cut/
  priest_art.py class                        选角立绘 art/final/class/priest.webp（按身体和鬼剑士同高，十字架顶端出框）
  priest_art.py ccomposite                   时装：98 帧原装格子拼成 2 张 10×5 大表 → priest/costume/base_{A,B}.png
  priest_art.py csheets [套装/组,...]        时装大表换装（3840×2160，参考 = 鬼剑士同一套的立绘；串行）→ art/src/avatar/sets/<套装>/priest_{A,B}.png
  priest_art.py cframes [套装,...]           时装切帧 → art/final/spr/priest@<套装>/（刷绿、四边刷白、按格切、对齐原装、锚点平移、红眼睛改蓝）
  priest_art.py check                        体检（走跑头部起伏 / 游戏里修正后、十字架离地、衣服闪烁、表内逐格、头部比例、锚点、时装）→ art/work/priest_samples/check.json
  priest_art.py creview | review             时装对照 costumes.jpg | 审图总览 overview.jpg（设计 → 表 → 全部帧和锚点 → 占位十字架 → 1 倍 / 4 倍 → 时装 → 指标）
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
CROSS_K = 0.7                   # 审图里占位十字架的长度 = 0.7 个身高（主线程定：官方十字架很大，但跑步时尖端不能擦地；砸地帧碰地可以）
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
KEYS = ('lean', 'nth', 'nsh', 'fth', 'fsh', 'nua', 'nfa', 'fua', 'ffa', 'lift', 'wang', 'two', 'fo')
P = lambda *v: dict(zip(KEYS, v + (0,) * (len(KEYS) - len(v))))
# 角度同格斗家：0 = 竖直向下，正 = 向前（面朝右），180 = 竖直向上；wang = 占位棒从握点指向尖端的方向；two = 远侧拳也握在棒上（握在近侧拳下面）；fo = 远侧手张开（画三根手指）
# Q 版手臂短：手举过头也到不了头顶，棒子会横穿脸 → 举高的姿势把手放到头后（上臂往后）或头前方够远（离头中心 > 头半径），竖着拿的棒子稍微前倾
HANDS_T = ('He wears brown leather gloves on both hands (no green on them). ')
IDLE = P(2, 6, 4, -8, -8, 36, 90, -6, 6, 0, 160)
IDLE_T = ('standing idle: upright and calm, broad chest, feet slightly apart; the near hand holds the green stick at waist height in front of him, the stick standing upright '
          'and tilted slightly forward (like holding a tall staff), rising above his head in front of his face; the far arm hangs relaxed at his side with a loose fist')
REFC = (None, IDLE, IDLE_T)       # 每张新表第 1 格：站姿参考（统一比例，不切；idle 用样表那一帧）

# 走：日常放松的走路（格斗家的教训：别画成战斗架势）：身体直立、肩膀放松，腿和远侧手臂按 poseguide 的标准步态（和三职业同一套，±26°）；
# 近侧手像拄着手杖一样竖着拿十字架，只跟着摆一点（±8°）；头整圈一样高（别写 body at its lowest / highest）
WALK_RELAX = ('a natural relaxed everyday walk, NOT a fighting stance: upright posture, shoulders relaxed; the near hand carries the green stick upright in front of him '
              'like a walking staff (it moves only a little), the free far arm hangs loosely and swings naturally opposite to the legs')
def walk_pose(ph):
    import poseguide as PG
    L = PG.pose_at(ph, False); arm = 26 * math.cos(math.radians(ph))
    return P(3, L['nth'], L['nsh'], L['fth'], L['fsh'], 36 - 0.3 * arm, 92, L['fua'], L['ffa'], 0, 160 - 0.3 * arm)
def walk_arm(ph):
    a = 26 * math.cos(math.radians(ph))
    return 'the far fist swung FORWARD' if a > 8 else 'the far fist swung BACK behind the hip' if a < -8 else 'the far arm hanging straight down at the side'
WALK8 = [(f'walk{i + 1}', walk_pose(i * 45), f'{FT.WALK_T[i]}; {walk_arm(i * 45)}; {WALK_RELAX}') for i in range(8)]
WALK = [(None, walk_pose(ph), f'{FT.WALK_T[ph // 45]}; {walk_arm(ph)}; {WALK_RELAX}') for ph in (0, 90, 180, 270)]   # 样表的 4 帧（已由 walkreact 表的整圈 8 帧替换，不再切）

# 跑（全套 8 帧）：腿和远侧手臂 = 格斗家返修后的 run1~8（长步幅、腾空帧只离地一点、头整圈差不多一样高；格斗家离线起伏 2.3）；
# 近侧手在胯旁握十字架、几乎水平地拖在身后：十字架 0.7 个身高，样表拖得太斜（画出来比小人斜 10~15°），尖端离地只剩 3.5 → 小人画成水平
RUN_T = (' Keep the head at almost the same height in every run frame (only a slight bob). The near fist stays low beside the hip and the green stick trails almost '
         'HORIZONTALLY straight back behind him at hip height, its tip well above the ground.')
RUN8_T = ['run contact: near leg reaching forward landing on the heel, far leg pushing off far behind',
          'run passing: weight on the near leg under the body with the knee only SLIGHTLY bent, far knee driving forward',
          'run FLIGHT: both feet just off the ground, legs spread wide front and back: near leg stretched straight behind, far knee high in front',
          'run reach: far leg reaching forward to land, near leg folded up behind',
          'run contact MIRRORED: far leg landing forward, near leg pushing off far behind',
          'run passing MIRRORED: weight on the far leg with the knee only SLIGHTLY bent, near knee driving forward',
          'run FLIGHT MIRRORED: both feet just off the ground, near knee high in front, far leg stretched straight behind',
          'run reach MIRRORED: near leg reaching forward to land, far leg folded up behind']
def run8():
    out = []
    for k, (n, Q, _) in enumerate(FT.RUN):
        s = 1 if Q['nua'] > 0 else -1   # 格斗家近侧手臂往前 / 往后 → 近侧手在胯旁前后小摆
        R = P(Q['lean'], Q['nth'], Q['nsh'], Q['fth'], Q['fsh'], -30 + 12 * s, 15 + 12 * s, Q['fua'], Q['ffa'], Q['lift'], -90 - 2 * s)
        far = 'the far fist pumped FORWARD' if Q['fua'] > 0 else 'the far fist pumped BACK'
        out.append((n, R, f'{RUN8_T[k]}; body leaning forward; {far}.{RUN_T}'))
    return out
RUN8 = run8()
RUN = [(None, P(14, 38, 20, -40, -72, -40, 0, 45, 135, 0, -75), 'run contact: near leg forward, far leg behind; the far fist forward; the green stick trailing low behind him'),
       (None, P(14, -42, -52, 66, -4, -14, 26, -35, 55, 16, -68), 'run FLIGHT: near leg behind, far knee high in front; the far fist back; the green stick trailing low behind him'),
       (None, P(14, -40, -72, 38, 20, -10, 30, -40, 50, 0, -66), 'run contact MIRRORED: far leg forward, near leg behind; the far fist back; the green stick trailing low behind him'),
       (None, P(14, 66, -4, -42, -52, -36, 4, 35, 125, 16, -76), 'run FLIGHT MIRRORED: near knee high in front, far leg behind; the far fist forward; the green stick trailing low behind him')]
RUN = [(n, Q, t + ' Keep the head at almost the same height in every run frame (only a slight bob).') for n, Q, t in RUN]   # 样表的 4 帧（已由 move 表的 8 帧替换）

# 普攻（样表，已审）：1 段 = 大力下劈（举到头后 → 平挥 → 砸到身前地面），2 段 = 反手上撩（低位后摆 → 向前上挥 → 竖举在身前），3 段起手 = 双手举到头后
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

# ---- 全套：跳 / 空中攻击 ----
JUMP = [('jump1', P(10, 55, -10, 40, -25, -34, 6, -30, -10, 0, -84), 'jump take-off: crouched low with both knees deeply bent, ready to spring up; the green stick held low trailing horizontally behind him'),
        ('jump2', P(0, 5, -5, -10, -20, 50, 115, 110, 150, 70, 158), 'jumping up: body stretched rising into the air, legs trailing below, the far fist raised; the green stick held upright in front of him, tilted forward'),
        ('jump3', P(5, 80, -10, 60, -20, 40, 100, 20, 150, 90, 160), 'jump apex: floating high with both knees tucked up; the green stick held upright in front of him, tilted forward; the far fist in front of the chest'),
        ('jump4', P(0, 15, 5, -5, -10, -55, -30, 100, 130, 60, -105), 'falling: legs reaching down, the far arm raised forward for balance; the near arm swung back holding the green stick pointing back and a little up behind him'),
        ('jump5', P(12, 50, -15, 30, -30, 30, 60, 40, 70, 0, 108), 'landing: knees bent absorbing the impact, crouched; the green stick held low in front pointing forward and a little up')]
JATK = [('jatk1', P(-4, 60, -20, 40, -40, -115, -135, 60, 90, 80, -130), 'air attack wind-up: airborne with the knees tucked, the near arm pulled back BEHIND the head, the green stick pointing up and back behind him, ready to swing down'),
        ('jatk2', P(20, 30, -10, -20, -50, 60, 50, -20, 20, 80, 50), 'air attack: airborne, the green stick swung down in front pointing diagonally down and forward, body leaning forward, legs trailing')]
# ---- 受击 / 倒地 / 通用 ----
REACT = [('hit1', P(-12, 14, -4, -12, -24, 20, 70, 50, 160, 0, 150), 'hurt: flinching backward, eyes shut in pain, the far fist raised defensively; the green stick held upright in front of him'),
         ('hit2', P(-26, 20, 0, -8, -20, 30, 70, -20, 30, 0, 125), 'hurt harder: knocked back with the upper body bent backward, arms thrown forward, the green stick pointing forward and up'),
         ('hit3', P(-38, 45, 20, -5, -10, 40, 80, -10, 40, 0, 115), 'hit hard: knocked backward off balance, body bent far back, head thrown back, the near foot lifted off the ground, the green stick pointing forward'),
         ('airUp', P(-40, 40, 10, 20, -10, 110, 140, 120, 150, 90, 150), 'launched up into the air by a hit: body arched backward and rising, arms flung up, legs trailing, clearly airborne high above the ground, the green stick still in the near hand'),
         ('tumble', P(210, 160, 175, 195, 215, 10, -10, -20, -40, 80, 60), 'tumbling helplessly in mid-air UPSIDE DOWN in an uncontrolled backward flip, head pointing down, airborne, still gripping the green stick'),
         ('air', P(-90, 100, 110, 80, 70, 200, 220, 170, 190, 70, 150), 'knocked into the air: body horizontal tumbling backward mid-air, arms and legs flailing, still gripping the green stick'),
         ('bounce', P(-90, 140, 160, 120, 140, 170, 180, 150, 170, 10, 140), 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air, still gripping the green stick')]
BASE = [('down', P(-90, 92, 92, 88, 90, 80, 95, 100, 110, 0, 140), 'lying knocked down flat on the back on the ground, head to the left, limp, the green stick still in the near hand lying diagonally'),
        ('getup', P(10, 90, 0, 0, -90, 45, 80, 20, 60, 0, 176), 'getting up from the ground: on one knee, pushing himself up with the green stick planted upright on the ground in front of him as a support'),
        ('tech', P(8, 90, 0, 0, -90, 40, 100, 20, 160, 0, 165), 'quick recovery: crouched low on one knee, alert, the green stick held upright in front of him, the far fist up'),
        ('held', P(0, 10, -10, -15, -35, 20, 10, -30, 10, 70, 8), 'lifted off the ground as if grabbed by the collar by an invisible force: dangling helplessly, feet off the ground, legs kicking, pained face, the green stick hanging down from the loose near hand, NO other person'),
        ('charge', P(8, 45, -20, -40, -60, 35, 95, 0, 0, 0, 172, 1), 'charging holy power: low wide horse stance, holding the green stick upright in front of him with BOTH hands, focused, eyes narrowed'),
        ('roll', P(70, 130, 10, 120, 0, 110, 40, 100, 30, 0, -120), 'dodge roll: curled up into a tight ball rolling forward, knees pulled to the chest, head tucked, the green stick held tight along his back'),
        ('victory', P(-4, 8, -4, -8, -14, 95, 135, -40, 80, 0, 166), 'victory pose: the green stick raised high up in front of him in the near hand, the far fist on the hip, confident smile'),
        ('a3_2', P(30, 55, 20, -40, -50, 60, 40, 0, 0, 0, 40, 1), 'heavy smash: deep lunge, both hands have smashed the green stick down in front, its tip hitting the ground in front of him'),
        ('dash1', P(20, 40, 10, -30, -50, -30, 60, 40, 80, 0, 88), 'dash attack start: running lunge, the near fist pulled back beside the hip, the green stick pointing straight FORWARD horizontally, ready to thrust; the far arm forward'),
        ('dash2', P(35, 60, 20, -50, -60, 85, 88, -30, 20, 0, 88), 'dash attack thrust: lunging far forward, the near arm fully extended, the green stick thrust straight FORWARD like a spear, body leaning forward'),
        ('p_up1', P(20, 60, -20, 40, -50, -40, -10, 40, 90, 0, -45), 'rising strike wind-up: crouched low, the green stick held low behind him pointing down and back'),
        ('p_up2', P(-15, 20, 0, -10, -20, 100, 140, -40, 0, 20, 166), 'rising strike: a big upward swing, the near arm raised up and forward, the green stick pointing straight UP in front of him, springing up off the toes'),
        ('p_jab1', P(8, 26, 0, -18, -32, 30, 95, 88, 90, 0, 162), 'punch rush 1: the far fist punched straight forward at face height; the near hand holds the green stick upright at his chest'),
        ('p_jab2', P(12, 28, 4, -22, -36, 85, 92, 20, 130, 0, 172), 'punch rush 2: the near fist (still holding the green stick upright) punched straight forward, the far fist pulled back to the chin'),
        ('p_jabEnd', P(26, 50, 15, -40, -50, -30, 20, 88, 88, 0, -86), 'finishing straight: a big lunging straight punch with the far fist fully extended forward, body leaning forward; the green stick trailing horizontally behind him')]
SKILLS = [('p_hookDash', P(30, 55, 10, -40, -60, -35, 10, -10, 60, 0, -86), 'dashing forward low, the far fist cocked beside the hip, the green stick trailing horizontally behind him'),
          ('p_hook', P(-10, 40, -10, -10, -30, -30, 20, 120, 170, 30, -84), 'rising uppercut: the far fist driven straight up, springing off the ground; the green stick trailing horizontally behind him'),
          ('p_grab', P(10, 26, 0, -20, -30, -30, 10, 88, 92, 0, -84, 0, 1), 'grab: the far hand reaching straight forward at chest height, OPEN and clutching (NO enemy drawn); the green stick held low behind him'),
          ('p_tiger', P(30, 50, 10, -45, -60, -40, 0, 80, 85, 0, -88), 'tiger rush: running forward leaning, the far arm extended forward with the fist clenched as if dragging an enemy (NO enemy drawn); the green stick trailing behind him'),
          ('p_slamUp', P(-10, 70, -10, 40, -40, -115, -135, 0, 0, 90, -130, 1), 'leaping smash: airborne high with the knees tucked, both hands gripping the green stick pulled back BEHIND the head, ready to smash down'),
          ('p_slamDown', P(35, 90, 0, 0, -90, 60, 40, 0, 0, 0, 45, 1), 'landing smash: down on one knee, both hands have smashed the green stick down in front, its tip hitting the ground'),
          ('p_pray1', P(0, 6, 4, -6, -6, 25, 150, 0, 0, 0, 150, 1), 'praying: standing, holding the green stick upright in front of the chest with BOTH hands, tilted forward, head bowed, eyes closed'),
          ('p_pray2', P(-6, 6, 0, -8, -8, 95, 135, -60, -40, 0, 166, 0, 1), 'blessing: the green stick raised high up in front of him in the near hand, the far arm opened out and down behind with the hand OPEN'),
          ('p_bless', P(4, 20, 0, -12, -20, 30, 95, 85, 88, 0, 160, 0, 1), 'casting a blessing on an ally: the far hand extended forward with the palm OPEN, the near hand holds the green stick upright'),
          ('p_hand1', P(-8, 20, 0, -15, -25, -20, 20, 130, 160, 0, -80, 0, 1), 'dark summon: the far hand raised high, OPEN like a claw; the green stick held low behind him'),
          ('p_hand2', P(35, 90, 0, 0, -90, -30, 10, 60, 20, 0, -84, 0, 1), 'dark hand strike: down on one knee, the far hand slammed palm down on the ground in front, OPEN; the green stick held low behind him'),
          ('p_guard', P(4, 30, 0, -25, -35, 40, 100, 0, 0, 0, 170, 1), 'guard: braced low stance, holding the green stick upright in front of the body with BOTH hands like a shield'),
          ('p_focus', P(6, 26, 0, -18, -30, 80, 100, 20, 60, 0, 112), 'holy cast: the near arm extended forward pointing the green stick forward and up at the enemy, the far fist at the chest'),
          ('pc_raise', P(-10, 10, 0, -10, -10, 95, 135, 0, 0, 0, 166, 1), 'grand blessing: holding the green stick high up in front of him with BOTH hands, looking up, chest out'),
          ('pc_heal', P(2, 10, 0, -8, -10, 30, 100, 110, 140, 0, 162, 0, 1), 'healing: the far hand raised forward and up with the palm OPEN, the near hand holds the green stick upright, gentle face')]
JOBS1 = [('pc_wall', P(20, 45, 10, -35, -45, 75, 85, 0, 0, 0, 172, 1), 'shield wall: leaning forward, BOTH hands pushing the upright green stick forward at arm\'s length'),
         ('pc_spear1', P(-10, 30, 0, -20, -30, 20, 90, -130, -160, 0, 162), 'spear throw wind-up: the far fist raised high BEHIND the head as if holding a spear (NOTHING drawn in it), leaning back; the near hand holds the green stick upright'),
         ('pc_spear2', P(20, 40, 10, -30, -40, 0, 40, 95, 90, 0, 150, 0, 1), 'spear throw release: lunging, the far arm thrust forward with the hand OPEN after throwing; the green stick held low in the near hand'),
         ('pc_hammer1', P(-5, 40, 0, -30, -40, -60, -30, 0, 0, 0, -62, 1), 'hammer wind-up: body twisted back, BOTH hands swinging the green stick low behind him pointing down and back'),
         ('pc_hammer2', P(25, 50, 15, -40, -50, 88, 88, 0, 0, 0, 90, 1), 'hammer swing: a big horizontal swing with BOTH hands, the green stick swept straight FORWARD at waist height, body twisted forward'),
         ('pc_judge', P(10, 90, 0, 0, -90, 40, 90, 30, 150, 0, 170), 'judgement prayer: kneeling on one knee, the near hand holds the green stick upright in front with its lower end on the ground, the far fist on the chest, head bowed'),
         ('pm_duck', P(45, 60, -20, -40, -60, -20, 30, 40, 150, 0, -86), 'boxer ducking dash: bent forward very low, the far fist up at the chin; the green stick trailing horizontally behind him'),
         ('pm_sway', P(-25, 10, -10, -30, -20, -30, 10, 50, 150, 0, -82), 'boxer sway back: leaning far back on the back foot, the far fist guarding the chin; the green stick held low behind him'),
         ('pm_jab', P(10, 28, 2, -20, -34, -20, 30, 88, 90, 0, -86), 'boxer jab: the far fist punched straight forward; the green stick trailing horizontally behind him'),
         ('pm_straight', P(12, 30, 4, -24, -36, 85, 90, 20, 140, 0, 172), 'boxer straight: the near fist (still holding the green stick upright) punched straight forward, the far fist at the chin'),
         ('pm_upper', P(-10, 40, -10, -10, -30, 100, 140, 30, 140, 20, 168), 'boxer uppercut: the near fist (holding the green stick upright) driven up in front of the face, springing up'),
         ('pm_rush1', P(10, 26, 2, -20, -34, -10, 60, 88, 92, 0, -86), 'gatling punches 1: the far fist fully extended forward, the near fist pulled back to the hip with the green stick trailing behind'),
         ('pm_rush2', P(12, 26, 2, -20, -34, 88, 92, 20, 140, 0, 172), 'gatling punches 2: the near fist (holding the green stick upright) fully extended forward, the far fist pulled back to the chin'),
         ('pm_counter', P(4, 40, -10, -30, -40, 30, 110, 0, 0, 0, 135, 1), 'counter stance: low defensive crouch, BOTH hands holding the green stick diagonally across the front of the body'),
         ('pe_throw', P(10, 30, 0, -20, -30, 20, 90, 95, 80, 0, 165, 0, 1), 'talisman throw: the far hand flicked forward at shoulder height, OPEN (NO paper drawn); the near hand holds the green stick upright')]
JOBS2 = [('pe_charge', P(20, 60, -10, -30, -50, -50, -20, 0, 0, 0, -70, 1), 'dragon charge: crouched low, BOTH hands holding the green stick low behind him, gathering power'),
         ('pe_spin', P(-10, 30, 0, -20, -30, 75, 80, -70, -60, 0, 95), 'whirling swing: leaning back, the near arm extended forward holding the green stick straight forward at waist height, the far arm swung back for balance'),
         ('pe_sweep', P(20, 50, 10, -35, -50, 60, 30, 0, 0, 0, 70, 1), 'low sweep: BOTH hands sweeping the green stick forward low at knee height, deep stance'),
         ('pe_seal', P(0, 10, 0, -8, -10, 25, 70, 60, 150, 0, 170, 0, 1), 'hand seal: the far hand OPEN in a seal in front of the chest with two fingers up; the near hand holds the green stick upright'),
         ('pe_summon', P(-8, 20, 0, -15, -20, 30, 90, 132, 165, 0, 165, 0, 1), 'summoning: the far arm raised straight up to the sky with the hand OPEN; the near hand holds the green stick upright'),
         ('pe_plant', P(30, 60, 10, -30, -50, 60, 30, 0, 0, 0, 18, 1), 'ground slam: BOTH hands driving the green stick straight down into the ground in front of him'),
         ('pe_thrust', P(30, 55, 15, -45, -55, 80, 85, 0, 0, 0, 92, 1), 'dragon thrust: lunging far forward, BOTH hands thrusting the green stick straight FORWARD like a spear'),
         ('pa_slash1', P(-10, 30, 0, -20, -30, -80, -70, 60, 90, 0, -95), 'scythe wind-up: body twisted back, the near arm pulled back holding the green stick horizontally behind him at shoulder height'),
         ('pa_slash2', P(20, 40, 10, -30, -40, 90, 110, -30, 10, 0, 130), 'wide slash follow-through: the near arm swept forward, the green stick pointing forward and up'),
         ('pa_grab', P(15, 30, 0, -25, -35, -30, 10, 88, 95, 0, -84, 0, 1), 'demon grip: the far hand thrust forward like a claw, OPEN with bent fingers; the green stick held low behind him'),
         ('pa_stab', P(35, 60, 20, -50, -60, 80, 88, -40, 0, 0, 100), 'vengeful stab: a low dashing lunge, the green stick thrust forward and slightly down'),
         ('pa_roar', P(-25, 25, 0, -20, -25, -60, -40, -70, -50, 0, -120, 0, 1), 'demonic roar: arms spread wide back, chest thrust forward, head up howling; the green stick held back in the near hand'),
         ('pa_hunch', P(50, 70, -20, 30, -60, -20, 20, 30, 10, 0, -76, 0, 1), 'demon form: crouched and hunched forward, the far hand OPEN like a claw near the ground, menacing; the green stick held low behind him'),
         ('pa_execute', P(-5, 25, 0, -15, -25, -30, 10, 125, 150, 0, -84), 'execution: the far fist raised high as if lifting an enemy by the throat (NO enemy drawn); the green stick held low behind him'),
         ('pa_dive', P(10, 70, -20, 50, -40, 40, 10, 60, 90, 90, 5, 1), 'plunge: airborne with the knees tucked, BOTH hands stabbing the green stick straight DOWN below him')]
SHEETS = {   # 表名 → 16 格 [(帧名, 姿势, 说明)]；帧名是 None 的格不切（参考格 / 被替换的样表格）
    'sample': [('idle', IDLE, IDLE_T)] + WALK + RUN + ATK,
    'move': [REFC] + RUN8 + JUMP + JATK,
    'walkreact': [REFC] + WALK8 + REACT,
    'base': [REFC] + BASE,
    'skills': [REFC] + SKILLS,
    'jobs1': [REFC] + JOBS1,
    'jobs2': [REFC] + JOBS2,
}
def face_gap(Q):
    """占位棒离头（圆）/ 鼻尖的最近距离（小人像素）：太近 = 生图会让棒子横穿脸，头部锚点也找不准"""
    J = joints(Q); h = J['head']; a, b = J['wb'], J['wt']
    def sd(p):
        dx, dy = b[0] - a[0], b[1] - a[1]; t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    nose = (h[0] + (HEAD_R + 12) * math.cos(math.radians(Q['lean'])), h[1] + 6)
    return sd(h) - HEAD_R, sd(nose)

def clear_face(Q):
    """竖着拿在身前的棒（朝上、偏前）：往前倾到离脸够远（头 ≥14、鼻尖 ≥26），最多前倾 48°"""
    if not 100 < Q['wang'] <= 185 or abs(Q['lean']) > 60: return Q   # 躺 / 翻滚的帧不管
    Q = dict(Q)
    for _ in range(12):
        d1, d2 = face_gap(Q)
        if d1 >= 14 and d2 >= 26: break
        Q['wang'] -= 4
    return Q

CYCLE = ('run', 'walk')          # 这些帧按“躯干中线 + 同一行脚底基线”对齐（腾空帧保留离地高度）
# 手工修正（同 avatar_fix.json 的格式，key = '<表>/<帧>'；共享的 avatar_fix.json 不改）：
# 跑步 / 起跳时近侧手在胯旁、十字架水平拖在身后，棒子穿过外套下摆被判成“身后”→ 一圈里前后乱跳；统一画在身前（近侧手握着）
FIX = {f'move/{f}': {'front': 1} for f in ('run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'run8', 'jump1')}
FIX.update({'base/p_jabEnd': {'front': 1}, 'jobs1/pm_jab': {'front': 1},        # 同跑步：水平拖在身后
            'skills/p_bless': {'flip': 1, 'front': 1},                            # 棒顶挨着张开的远侧手 → 尖端被认到下面（切帧预览逐个看过）
            'jobs1/pc_judge': {'one': 1}})                                        # 棒子被膝盖挡成两段不共线的，只留一根

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

for _k in ('move', 'walkreact', 'base', 'skills', 'jobs1', 'jobs2'):   # 样表已审过，不动
    SHEETS[_k] = [(f, clear_face(Q) if f else Q, t) for f, Q, t in SHEETS[_k]]

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
    def hand_open(e, h, col):   # 张开的手：三根手指（同格斗家）
        ux, uy = (h[0] - e[0]) / FA, (h[1] - e[1]) / FA; x, y = T(h)
        for a in (-0.5, 0, 0.5):
            c, s_ = math.cos(a), math.sin(a); d.line([x, y, x + (ux * c - uy * s_) * 26, y + (uy * c + ux * s_) * 26], fill=OUT, width=9)
        d.ellipse([x - FIST, y - FIST, x + FIST, y + FIST], fill=(250, 250, 250), outline=OUT, width=3)
    limb(sho, J['fe'], FAR); limb(J['fe'], J['fh'], FAR)
    if Q['fo']: hand_open(J['fe'], J['fh'], FAR)
    else: fist(J['fh'], FAR)
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
def _hsv(a):
    rgb = a[..., :3].astype(np.float32) / 255; mx, mn = rgb.max(-1), rgb.min(-1); dd = np.maximum(mx - mn, 1e-6); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    return hue, (mx - mn) / np.maximum(mx, 1e-6), mx

def regreen_img(p, raw, cells):
    """祈祷 / 祝福类的格子，生图常把占位棒画成黄绿渐变（“圣光”），切帧只认纯绿 → 这一格没有锚点、黄棒留在帧里。
    按格处理（cells = [(帧名, (x0, y0, x1, y1))]）：纯绿偏黄 / 偏青的像素（色相 60~160）当种子拟合出棒的轴线，轴线两侧半个棒宽之内、
    颜色像棒（色相 38~160、饱和）的像素，只要和种子连在一起，就刷成纯绿，再往外长 4 圈吃掉棒边淡黄的“光”（金边 / 金发离轴线远，不会被刷）。
    原图备份到 raw（已有备份就从备份重做，结果不叠加）"""
    from prep import components
    from avatar_frames import dil
    src = raw if os.path.exists(raw) else p
    a = np.array(Image.open(src).convert('RGB')); hue, sat, val = _hsv(a); fixed = []
    pure = (a[..., 1].astype(int) - np.maximum(a[..., 0], a[..., 2]).astype(int)) > 128
    for f, (x0, y0, x1, y1) in cells:
        sl = (slice(y0, y1), slice(x0, x1)); H, Sa, V, Pu = hue[sl], sat[sl], val[sl], pure[sl]
        seed = (H >= 60) & (H <= 160) & (Sa > 0.45) & (V > 0.5)
        if f is None or seed.sum() < 150 or (seed & ~Pu).sum() < 0.25 * max(1, Pu.sum()): continue
        ys, xs = np.where(seed); Pt = np.stack([xs, ys], 1).astype(np.float32); ctr = Pt.mean(0)
        w_, v_ = np.linalg.eigh(np.cov((Pt - ctr).T)); u = v_[:, 1]; nrm = np.array([-u[1], u[0]])
        hw = float(np.clip(np.percentile(np.abs((Pt - ctr) @ nrm), 90), 4, 12)) + 2
        yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0]; perp = np.abs((xx - ctr[0]) * nrm[0] + (yy - ctr[1]) * nrm[1])
        cand = (perp <= hw) & (H >= 38) & (H <= 160) & (Sa > 0.35) & (V > 0.45)
        lab, comps = components((cand * 255).astype(np.uint8), f=1, min_cells=20)
        keep = np.zeros_like(cand)
        for cid, _ in comps:
            reg = lab == cid
            if (reg & seed).sum() >= 20: keep |= reg
        edge = (perp <= hw + 6) & (H >= 38) & (H <= 160) & (Sa > 0.22) & (V > 0.4)
        for _ in range(4): keep |= dil(keep) & edge
        sub = a[sl]; sub[keep] = (0, 255, 0); fixed.append(f'{f}:{int(keep.sum())}')
    if fixed:
        if not os.path.exists(raw): os.makedirs(os.path.dirname(raw), exist_ok=True); Image.open(p).save(raw)
        Image.fromarray(a).save(p)
    return fixed

def regreen(name):
    cells = [(f, ((i % N) * CELL, (i // N) * CELL, (i % N + 1) * CELL, (i // N + 1) * CELL)) for i, (f, _, _) in enumerate(SHEETS[name])]
    fixed = regreen_img(sheet_path(name), os.path.join(PS, 'sheets', '_pre', f'priest_{name}_raw.png'), cells)
    print(f'{name}：黄绿占位棒刷回纯绿 {" ".join(fixed) or "无"}'); return fixed

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
    """选角立绘：原装立绘去白底（十字架杆和脸之间围住的白底一起挖掉），按**身体**（头顶 → 脚底，不含十字架）缩到 420 高，和鬼剑士一样大；
    十字架伸出头顶的那截裁掉（主线程定：不为了装下十字架把人缩小）。头顶 = 人物外框左半边（十字头在右边、和头发挨着，连通块分不开）最高的不透明像素"""
    from avatar_frames import fill_holes
    a = np.array(fill_holes(remove_bg(Image.open(REF)), min_area=90, thr=251)); op = a[..., 3] > 30
    cols = np.where(op.any(0))[0]; xa, xb = int(cols.min()), int(cols.max())
    top = int(np.where(op[:, xa:xa + (xb - xa) // 2].any(1))[0].min()); bot = int(np.where(op.any(1))[0].max()) + 1
    ys, xs = np.where(op[top:bot]); x0, x1 = int(xs.min()), int(xs.max()) + 1
    sub = Image.fromarray(a[top:bot, x0:x1], 'RGBA'); k = 420 / sub.height
    out = os.path.join(HERE, 'final', 'class', 'priest.webp')
    sub.resize((round(sub.width * k), 420), Image.LANCZOS).save(out, 'WEBP', quality=86, method=6); print(out, f'身体高 {bot - top} 像素（原图），十字架伸出头顶 {top - int(np.where(op.any(1))[0].min())} 像素裁掉')

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
    out = {'frames': fs, 'headJumpMax': round(max(jumps), 2) if jumps else None, 'headJumpMean': round(float(np.mean(jumps)), 2) if jumps else None,
           'headBobY': round(max(hy) - min(hy), 2) if hy else None, 'headSwayX': round(max(hx) - min(hx), 2) if hx else None, 'strideMatch': round(art / (sp * cyc), 3)}
    n = len(fs)
    if n >= 4 and n % 2 == 0 and all(hp):   # 游戏里的循环起伏修正（imgmodel.js sprLoopNorm）：头部 y 拟合成均值 + 二次谐波（每步一个起伏），帧按 0.94~1.06 竖向缩放贴上去；x 留一半
        def fit(i, keep):
            mu = sum(h[i] for h in hp) / n; a = sum(h[i] * math.cos(4 * math.pi * j / n) for j, h in enumerate(hp)) * 2 / n; b = sum(h[i] * math.sin(4 * math.pi * j / n) for j, h in enumerate(hp)) * 2 / n
            return [mu + keep * (a * math.cos(4 * math.pi * j / n) + b * math.sin(4 * math.pi * j / n)) for j in range(n)]
        TX, TY = fit(0, 0.5), fit(1, 1)
        g = [(hx_ + max(-0.08, min(0.08, (TX[j] - hx_) / hy_)) * hy_, hy_ * max(0.94, min(1.06, TY[j] / hy_))) for j, (hx_, hy_) in enumerate(hp)]
        gj = [math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]) for i in range(n)]
        out.update(gameJumpMax=round(max(gj), 2), gameBobY=round(max(v[1] for v in g) - min(v[1] for v in g), 2))
    return out

def cross_low(F):
    """占位十字架（0.7 个身高，draw_cross 的形状）最低点离地多少（世界单位，负 = 插进地里）"""
    w = F.get('wpn')
    if not w: return None
    L = HEIGHT * CROSS_K * RES; u = (math.cos(w['ang']), math.sin(w['ang'])); n = (-u[1], u[0])
    pts = [(w['gx'] + u[0] * L * 0.9, w['gy'] + u[1] * L * 0.9)] + [(w['gx'] + u[0] * L * 0.72 + n[0] * L * 0.22 * s, w['gy'] + u[1] * L * 0.72 + n[1] * L * 0.22 * s) for s in (1, -1)]
    return round((F['ay'] - max(p[1] for p in pts)) / RES, 1)

def check():
    """全套体检（结果 art/work/priest_samples/check.json）：① 走 / 跑一圈 8 帧的头部跳动 / 起伏（原始 + 游戏里的循环起伏修正之后，sprLoopNorm 同算法）和步幅，
    同口径对比鬼剑士 / 格斗家；② 跑步 / 起跳帧 0.7 身高的十字架离地；③ 衣服闪烁（avatar_flicker 离群分，原装 + 6 套时装）；④ 表内逐格直方图差（同一个动作的相邻格）；
    ⑤ 头部比例（每帧的头是 idle 的几倍）；⑥ 锚点（武器 / 头 / 分割线）；⑦ 时装：帧数、和原装轮廓的重合度"""
    import avatar_flicker as FL, avatar_sheetflicker as SF, avatar_frames as AF, avatar_sizecheck as SZ
    rep = {'loco': {}, 'flicker': {}, 'sheet': {}, 'scale': {}, 'costume': {}}
    W8, R8 = [f'walk{i}' for i in range(1, 9)], [f'run{i}' for i in range(1, 9)]
    for cls in ('priest', 'sword', 'fighter'):
        rep['loco'][cls] = {'walk': loco(cls, W8, 'walk'), 'run': loco(cls, R8, 'run')}
        rep['flicker'][cls] = {c: max(FL.outliers(cls, c).values()) for c in ('walk', 'run')}
        d, meta = spr(cls); T, M = SZ.head_tpl(SZ.load(d, 'idle')); sc = {}
        for f, F in meta['frames'].items():
            if F.get('head'): s_, e_ = SZ.head_scale(SZ.load(d, f), F['head'], T, M); sc[f] = (s_, e_)
        ok = {f: v[0] for f, v in sc.items() if v[1] < SZ.ERR_MAX}; dev = sorted(abs(v - 1) for v in ok.values())
        rep['scale'][cls] = {'frames': len(sc), 'trusted': len(ok), 'median_dev': round(dev[len(dev) // 2], 3) if dev else None,
                             'over12': sorted((f, round(v, 2)) for f, v in ok.items() if abs(v - 1) > 0.12)}
    d, meta = spr('priest'); Fs = meta['frames']
    rep['cross_low'] = {f: cross_low(Fs[f]) for f in R8 + ['jump1', 'p_hookDash', 'p_tiger', 'pm_duck', 'p_jabEnd'] if f in Fs}
    cb = AF.cut_boxes; AF.cut_boxes = FT.cut16
    for n in SHEETS:
        if not os.path.exists(sheet_path(n)): continue
        c = SF.cells(sheet_path(n)); names = [f for f, _, _ in SHEETS[n]]; H = lambda i, j: round(0.5 * float(np.abs(c[i][0] - c[j][0]).sum()), 3)
        grp = {}
        for i, f in enumerate(names):
            if f: grp.setdefault(f.rstrip('0123456789').rstrip('_') if f[:2] in ('wa', 'ru', 'ju', 'a1', 'a2') else 'other', []).append(i)
        rep['sheet'][n] = {g: [H(ix[k], ix[k + 1]) for k in range(len(ix) - 1)] for g, ix in grp.items() if len(ix) > 1 and g != 'other'}
    AF.cut_boxes = cb
    want = [f for v in SHEETS.values() for f, _, _ in v if f]
    rep['anchors'] = {'frames': len(Fs), 'missing': [f for f in want if f not in Fs], 'head': sum(1 for F in Fs.values() if F.get('head')), 'cut': sum(1 for F in Fs.values() if F.get('cut')),
                      'wpn': sum(1 for F in Fs.values() if F.get('wpn')), 'no_wpn': [f for f, F in Fs.items() if not F.get('wpn')], 'wpn2': [f for f, F in Fs.items() if F.get('wpn2')],
                      'back': [f for f, F in Fs.items() if F.get('wpn') and not F['wpn']['front']], 'no_hand': [f for f, F in Fs.items() if F.get('wpn') and not F['wpn'].get('hand')],
                      'face_hidden': [f for f, F in Fs.items() if F.get('head', {}).get('f') == 0],
                      'outside': [f for f, F in Fs.items() if F.get('wpn') and not (-10 <= F['wpn']['gx'] <= F['w'] + 10 and -10 <= F['wpn']['gy'] <= F['h'] + 10)]}
    rep['size'] = {cls: {'idle_h': round(spr(cls)[1]['frames']['idle']['h'] / RES, 1), 'idle_w': round(spr(cls)[1]['frames']['idle']['w'] / RES, 1)} for cls in ('priest', 'sword', 'fighter')}
    iou = json.load(open(os.path.join(WORK, 'costume_iou.json'))) if os.path.exists(os.path.join(WORK, 'costume_iou.json')) else {}
    for sid in SETS:
        key = f'priest@{sid}'
        if not os.path.exists(os.path.join(HERE, 'final', 'spr', key, 'spr.json')): continue
        cm = spr(key)[1]['frames']; v = sorted(iou.get(sid, {}).values())
        rep['costume'][sid] = {'frames': len(cm), 'missing': [f for f in Fs if f not in cm], 'iou_min': v[0] if v else None, 'iou_median': v[len(v) // 2] if v else None,
                               'iou_low': sorted(f for f, x in iou.get(sid, {}).items() if x < 0.6), 'wpn': sum(1 for F in cm.values() if F.get('wpn')),
                               'flicker': {c: max(FL.outliers(key, c).values()) for c in ('walk', 'run')}}
    os.makedirs(WORK, exist_ok=True); json.dump(rep, open(os.path.join(WORK, 'check.json'), 'w'), ensure_ascii=False, indent=1)
    for cls, v in rep['loco'].items():
        for k, m in v.items():
            if m: print(f'{cls:8s} {k:4s} 头部每帧最大跳 {m["headJumpMax"]} 起伏 {m["headBobY"]}（游戏里修正后 {m.get("gameJumpMax")} / {m.get("gameBobY")}） 前后 {m["headSwayX"]} 步幅匹配 {m["strideMatch"]}')
    print('十字架离地（世界单位）', rep['cross_low'])
    for k, v in rep['flicker'].items(): print(f'闪烁 {k:8s} {v}')
    for k, v in rep['scale'].items(): print(f'比例 {k:8s} {v["trusted"]}/{v["frames"]} 帧可信，偏差中位 {v["median_dev"]}，>12%：{v["over12"]}')
    print('表内逐格', rep['sheet']); print('锚点', {k: v for k, v in rep['anchors'].items()}); print('大小', rep['size'])
    for k, v in rep['costume'].items(): print(f'时装 {k:9s} {v}')

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

# ---- 时装（6 套）：做法同格斗家 B2（原装带绿棒的表整张换衣服 → 切帧 → 按原装同名帧缩放 / 轮廓对齐 → 锚点从原装平移过来），
# 但省生图：98 帧拼成 2 张 10×5 的大表（3840×2160，每格 384×432），一套只出 2 张图（格斗家一套 1 张参考 + 6 张表 = 7 张）；
# 时装设计参考直接用鬼剑士同一套的参考立绘（art/src/avatar/refs/sword@<套装>.png，不另出圣职者的时装立绘）
SETS = ['summer', 'festival', 'spring', 'academy', 'sky1', 'sky2']
AVS = os.path.join(SRC, 'avatar')
CB = os.path.join(PS, 'costume')                 # 拼好的原装大表 base_<组>.png + 缩放缓存 scale.json
CCOLS, CROWS, CW, CH = 10, 5, 384, 432
CGROUPS = {
    'A': ['idle'] + [f'walk{i}' for i in range(1, 9)] + [f'run{i}' for i in range(1, 9)] + [f'jump{i}' for i in range(1, 6)] + ['jatk1', 'jatk2',
          'hit1', 'hit2', 'hit3', 'airUp', 'tumble', 'air', 'bounce', 'down', 'getup', 'tech', 'held', 'charge', 'roll', 'victory',
          'a1_1', 'a1_2', 'a1_3', 'a2_1', 'a2_2', 'a2_3', 'a3_1', 'a3_2', 'dash1', 'dash2', 'p_up1', 'p_up2'],
    'B': ['idle'] + [f for sh in ('base', 'skills', 'jobs1', 'jobs2') for f, _, _ in SHEETS[sh][1:] if f and f not in (
          'down', 'getup', 'tech', 'held', 'charge', 'roll', 'victory', 'a3_2', 'dash1', 'dash2', 'p_up1', 'p_up2')],
}   # 第 1 格都是 idle：同一张表里衣服统一的参照（B 表的 idle 不切）
def cset_dir(sid): return os.path.join(AVS, 'sets', sid)
def csheet(sid, g): return os.path.join(cset_dir(sid), f'priest_{g}.png')
def cbase(g): return os.path.join(CB, f'base_{g}.png')

def outfit(sid):
    import avatar_gen as G
    t = G.SETS[sid]['sword']
    for x in ('The red scarf and the long coat are removed.', 'The red scarf is removed.'): t = t.replace(x, '')
    return t.strip()

def cell_of(f):
    """帧 → (原装表, 第几格)"""
    for sh in ('sample', 'move', 'walkreact', 'base', 'skills', 'jobs1', 'jobs2'):
        for i, (n, _, _) in enumerate(SHEETS[sh]):
            if n == f: return sh, i
    raise KeyError(f)

def cell_crop(f):
    """原装表里这一格：人 + 手里的绿棒（最大的连通块和挨着它的块），别的格伸过来的棒尖刷白"""
    from prep import components
    sh, i = cell_of(f); r, c = divmod(i, N)
    a = np.array(Image.open(sheet_path(sh)).convert('RGB'))[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL].copy()
    ink = (a.min(-1) < 236) | ((a.max(-1).astype(int) - a.min(-1)) > 20)
    lab, comps = components((ink * 255).astype(np.uint8), f=2, min_cells=3)
    big = max(comps, key=lambda x: x[1])[0]; keep = lab == big
    from avatar_frames import dil
    near = dil(keep, 6)
    for cid, n in comps:
        reg = lab == cid
        if cid != big and (reg & near).any(): keep |= reg
    a[~dil(keep, 2)] = 255
    ys, xs = np.where(keep); return Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])

def ccomposite(g, force=False):
    """原装格子拼成 10×5 大表（同一张表统一缩放，装得下最大的那格），每格居中；返回每帧的缩放"""
    out = cbase(g); sp = os.path.join(CB, f'base_{g}.json')
    if os.path.exists(out) and os.path.exists(sp) and not force: return json.load(open(sp))
    os.makedirs(CB, exist_ok=True); crops = {f: cell_crop(f) for f in CGROUPS[g]}
    s = min(1.0, min(min(CW * 0.92 / im.width, CH * 0.92 / im.height) for im in crops.values()))
    M = Image.new('RGB', (CCOLS * CW, CROWS * CH), 'white')
    for k, f in enumerate(CGROUPS[g]):
        im = crops[f].resize((round(crops[f].width * s), round(crops[f].height * s)), Image.LANCZOS); r, c = divmod(k, CCOLS)
        M.paste(im, (c * CW + (CW - im.width) // 2, r * CH + (CH - im.height) // 2))
    M.save(out); json.dump({'scale': s}, open(sp, 'w')); print(out, f'统一缩放 {s:.3f}'); return {'scale': s}

def csheet_prompt(sid):
    return ('The FIRST image is a 2D game sprite animation sheet (10 columns x 5 rows) of our chibi priest character; in every frame his near hand holds a flat pure green stick '
            '(a placeholder for his weapon). The SECOND image only shows the design of an outfit, worn by a different character. '
            'Redraw the FIRST image exactly: the same 10x5 layout, the same poses, the same positions and sizes of every figure, the same face and the same short honey-blond hair, '
            'the same flat pure green (#00FF00) sticks held in exactly the same places and angles (the sticks stay flat pure green, with no outline, no shading and no glow), '
            f'but dress the character in EVERY frame in this outfit (same style and colors as in the second image): {outfit(sid)} '
            'He keeps his brown leather gloves. His ivory priest coat, blue tabard, shoulder guards and cross belt are NOT worn with this outfit. '
            'The outfit must look IDENTICAL in all frames (same patterns in the same places, same colors). '
            'No hat, no glasses, no hair ornament, no other weapon, no effects. Plain pure white background, no text, no grid lines.')

def cut_grid(alpha, n=CCOLS * CROWS):
    """10×5 大表是自己拼的、格子位置已知：连通块按中心落在哪一格归到那一帧（一帧被画成几块、翅膀和身体断开都没关系）；
    不按“最大的 n 块”挑（academy / sky1 的 B 表有一格断成两大块，按大小挑会把后面的帧名全部错开一位）。返回前 n 格，空格报 CHECK"""
    from prep import components
    lab, comps = components(alpha, min_cells=4)
    Hh, Ww = alpha.shape; cells = {}
    for c, cnt in comps:
        ys, xs = np.where(lab == c)
        r, k = min(CROWS - 1, int(ys.mean() / (Hh / CROWS))), min(CCOLS - 1, int(xs.mean() / (Ww / CCOLS)))
        b = cells.setdefault((r, k), {'ids': [], 'y0': Hh, 'y1': 0, 'x0': Ww, 'x1': 0, 'cells': 0, 'row': r, 'col': k})
        b['ids'].append(c); b['y0'] = min(b['y0'], ys.min()); b['y1'] = max(b['y1'], ys.max() + 1); b['x0'] = min(b['x0'], xs.min()); b['x1'] = max(b['x1'], xs.max() + 1); b['cells'] += cnt
    want = [divmod(i, CCOLS) for i in range(n)]
    empty = [w for w in want if w not in cells]
    if empty: print(f'  <-- CHECK 10×5：这些格子是空的 {empty}')
    return lab, [cells[w] for w in want if w in cells]

def base_scale():
    """原装每帧：原表像素（身体，棒已抠掉）→ 帧像素的倍数（第一遍按站姿格 + 第二遍按头归一的结果），缓存 costume/scale.json"""
    p = os.path.join(CB, 'scale.json')
    if os.path.exists(p): return json.load(open(p))
    import frames as FR, avatar_frames as AF
    FR.HEIGHT['priest'] = HEIGHT; AF.cut_boxes = FT.cut16
    meta = json.load(open(os.path.join(SPR, 'spr.json'))); out = {}
    for sh in SHEETS:
        fn = [f for f, _, _ in SHEETS[sh]]
        fr, _, _, _ = AF.process_sheet('priest', sh, sheet_path(sh), fn, meta['res'], FIX, None)
        for f, F in fr.items():
            B = meta['frames'].get(f); al = F['sub'][..., 3] > 40; ys, xs = np.where(al)
            if B is None or not len(xs): continue
            out[f] = (B['w'] / (xs.max() - xs.min() + 1) + B['h'] / (ys.max() - ys.min() + 1)) / 2
    os.makedirs(CB, exist_ok=True); json.dump(out, open(p, 'w'), indent=1); return out

def cshift(B, dx, dy):
    """原装帧的锚点平移到时装帧（同 fighter_looks_art._shift）"""
    o = {}
    W = B.get('wpn')
    if W:
        W = dict(W); W['gx'] = round(W['gx'] + dx, 1); W['gy'] = round(W['gy'] + dy, 1)
        if 'hand' in W: W['hand'] = [[round(v + (dy if j % 2 else dx), 1) for j, v in enumerate(Pl)] for Pl in W['hand']]
        o['wpn'] = W
    if B.get('head'): o['head'] = {**B['head'], 'x': round(B['head']['x'] + dx, 1), 'y': round(B['head']['y'] + dy, 1)}
    if B.get('cut'): o['cut'] = {**B['cut'], 'wx': round(B['cut']['wx'] + dx, 1), 'wy': round(B['cut']['wy'] + dy, 1)}
    return o

def eyes_blue(im, H):
    """时装设计参考是鬼剑士（红眼睛），换装时眼睛常被画成红 / 红棕（festival、sky1、sky2 最明显）→ 改回原装的蓝：
    只看头部锚点前下方的眼睛框（按原装 70 帧蓝色瞳孔量的：沿脸朝向 16~40、往下 2~22 帧像素，跟着头的转角转），
    框里偏红 / 棕、够饱和、不亮（皮肤亮、嘴在框外）的像素 → 色相 222，亮度不变。脸被挡住的帧（f: 0）不动"""
    if not H or H.get('f') == 0 or os.environ.get('NO_EYES'): return 0
    a = np.array(im); hue, sat, val = _hsv(a)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; ca, sa = math.cos(-H['a']), math.sin(-H['a'])
    dx, dy = xx - H['x'], yy - H['y']; u = dx * ca - dy * sa; v = dx * sa + dy * ca
    # 只改明显的红（色相 ≤14 / ≥330）：发际线的深棕描边色相 20~27、festival / academy 的棕眼睛 17~27 分不开，不动（第一版按 ≤30 改，把发际线描成了蓝色）
    m = (a[..., 3] > 120) & (u > 16) & (u < 40) & (v > 6) & (v < 22) & ((hue <= 14) | (hue >= 330)) & (sat > 0.4) & (val > 0.18) & (val < 0.8)
    if not m.any(): return 0
    import colorsys
    for y, x in zip(*np.where(m)):
        r, g, b = colorsys.hsv_to_rgb(222 / 360, max(0.55, float(sat[y, x])), min(1.0, float(val[y, x]) * 1.05))
        a[y, x, :3] = (round(r * 255), round(g * 255), round(b * 255))
    im.paste(Image.fromarray(a, 'RGBA')); return int(m.sum())

def cframes(sets, groups=('A', 'B')):
    """时装表切帧 → art/final/spr/priest@<套装>/：切 10×5 → 身体按“原装倍数 / 拼表缩放”放大 → 和原装同名帧轮廓对齐（残差 ±6%）→ 锚点从原装平移"""
    import frames as FR, avatar_frames as AF, avatar_align as AL
    FR.HEIGHT['priest'] = HEIGHT; bs = base_scale(); AF.cut_boxes = cut_grid
    bmeta = json.load(open(os.path.join(SPR, 'spr.json'))); res = bmeta['res']; rep = {}
    mk = lambda a: Image.fromarray(((a[..., 3] > 60) * 255).astype(np.uint8), 'L'); eyes = {}
    for sid in sets:
        od = os.path.join(HERE, 'final', 'spr', f'priest@{sid}'); os.makedirs(od, exist_ok=True); mp = os.path.join(od, 'spr.json')
        meta = json.load(open(mp)) if os.path.exists(mp) else {'res': res, 'frames': {}}; low = []
        for g in groups:
            src = csheet(sid, g)
            if not os.path.exists(src): print(f'  {sid}: 没有 {g} 表'); continue
            cells = [(f, ((k % CCOLS) * CW, (k // CCOLS) * CH, (k % CCOLS + 1) * CW, (k // CCOLS + 1) * CH)) for k, f in enumerate(CGROUPS[g])]
            raw = os.path.join(cset_dir(sid), '_pre', f'priest_{g}_raw.png')
            # 生图偶尔在整张表四边画一圈浅灰边（academy / sky1 的 B 表、festival 的 A 表）：连成一个横跨整行的连通块，被切进某一帧（帧宽 2395 像素）。
            # 拼表时每格内容离格边 ≥ 15 像素 → 四边 14 像素刷白（同 PLAYBOOK 图标表的坑）；原图先备份
            fx = regreen_img(src, raw, cells)   # 先刷绿（它从备份重做），再刷白四边
            b = np.array(Image.open(src).convert('RGB')); nw = (b.min(-1) < 233) | ((b.max(-1).astype(int) - b.min(-1)) > 14); E = 14
            if nw[:E].any() or nw[-E:].any() or nw[:, :E].any() or nw[:, -E:].any():
                if not os.path.exists(raw): os.makedirs(os.path.dirname(raw), exist_ok=True); Image.fromarray(b).save(raw)
                b[:E] = 255; b[-E:] = 255; b[:, :E] = 255; b[:, -E:] = 255; Image.fromarray(b).save(src); print(f'  {sid}/{g} 四边的浅灰边刷白')
            if fx: print(f'  {sid}/{g} 黄绿占位棒刷回纯绿：{" ".join(fx)}')
            names = list(CGROUPS[g]) + [None] * (CCOLS * CROWS - len(CGROUPS[g]))
            if g != 'A': names[0] = None   # B 表的 idle 只当衣服参照
            sc = ccomposite(g)['scale']; AF.cut_boxes = lambda al, n=len(CGROUPS[g]): cut_grid(al, n)   # 这张表有几个人就切几块
            fr, _, _, _ = AF.process_sheet('priest', f'costume{g}', src, names, res, {}, None, None, cbase(g), bmeta['frames'], sid in AF.NO_WHITE)
            for f, F in fr.items():
                B = bmeta['frames'].get(f)
                if not B or f not in bs: continue
                sub = F['sub']; al = sub[..., 3] > 40; ys, xs = np.where(al); sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                k = bs[f] / sc; im = Image.fromarray(sub, 'RGBA'); im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
                bim = Image.open(os.path.join(SPR, f + '.webp')).convert('RGBA')
                s, tx, ty, iou = AL.align(mk(np.array(bim)), mk(np.array(im)), np.arange(0.94, 1.061, 0.02))
                if iou >= AL.IOU_OK and abs(s - 1) > 0.03:
                    im = im.resize((max(1, round(im.width / s)), max(1, round(im.height / s))), Image.LANCZOS)
                    s, tx, ty, iou = AL.align(mk(np.array(bim)), mk(np.array(im)), np.array([1.0]))
                ax, ay = s * B['ax'] + tx, s * B['ay'] + ty
                meta['frames'][f] = {'w': im.width, 'h': im.height, 'ax': round(ax, 1), 'ay': round(ay, 1), **cshift(B, ax - B['ax'], ay - B['ay'])}
                eyes[sid] = eyes.get(sid, 0) + eyes_blue(im, meta['frames'][f].get('head'))
                im.save(os.path.join(od, f + '.webp'), 'WEBP', quality=AF.Q, method=6)
                rep.setdefault(sid, {})[f] = round(iou, 3)
                if iou < 0.6: low.append(f'{f}({iou:.2f})')
        meta['frames'] = dict(sorted(meta['frames'].items())); json.dump(meta, open(mp, 'w'), indent=1)
        miss = [f for f in bmeta['frames'] if f not in meta['frames']]
        print(f'priest@{sid}: {len(meta["frames"])} 帧，缺 {miss or "无"}；和原装轮廓重合度 < 0.6：{" ".join(low) or "无"}；红眼睛改蓝 {eyes.get(sid, 0)} 像素')
    os.makedirs(WORK, exist_ok=True)
    old = json.load(open(os.path.join(WORK, 'costume_iou.json'))) if os.path.exists(os.path.join(WORK, 'costume_iou.json')) else {}
    old.update(rep); json.dump(old, open(os.path.join(WORK, 'costume_iou.json'), 'w'), indent=1)

CPICK = ['idle', 'walk3', 'walk7', 'run3', 'run7', 'jump3', 'a1_1', 'a1_2', 'a2_2', 'a3_2', 'hit2', 'down', 'getup', 'p_up2',
         'p_jab1', 'p_pray1', 'p_slamDown', 'pc_wall', 'pc_spear1', 'pm_duck', 'pm_upper', 'pe_seal', 'pe_thrust', 'pa_roar', 'pa_dive']

def creview(sets=None):
    """时装审图：第一行原装，下面每套一行（同名帧，带占位十字架；绿圈 = 头部锚点）→ art/work/priest_samples/costumes.jpg"""
    sets = [s for s in (sets or SETS) if os.path.isdir(os.path.join(HERE, 'final', 'spr', f'priest@{s}'))]
    font = ImageFont.truetype(FONT, 18); cw, ch = 150, 250; Lc = round(HEIGHT * CROSS_K * RES)
    rows = [('原装', 'priest')] + [(s, f'priest@{s}') for s in sets]
    M = Image.new('RGB', (cw * len(CPICK) + 90, ch * len(rows)), (58, 62, 72)); d = ImageDraw.Draw(M)
    for r, (label, key) in enumerate(rows):
        dd, mm = spr(key); d.text((6, r * ch + ch // 2), label, fill=(255, 230, 120), font=font)
        for i, f in enumerate(CPICK):
            F = mm['frames'].get(f)
            if not F: continue
            C, pad = with_cross(f, F, dd, Lc); k = 0.62
            C = C.resize((round(C.width * k), round(C.height * k)), Image.LANCZOS); ox, oy = 90 + i * cw + cw / 2, r * ch + ch - 22
            M.paste(C, (round(ox - (F['ax'] + pad) * k), round(oy - (F['ay'] + pad) * k)), C)
            if F.get('head'): hx, hy = ox + (F['head']['x'] - F['ax']) * k, oy + (F['head']['y'] - F['ay']) * k; d.ellipse([hx - 4, hy - 4, hx + 4, hy + 4], outline=(0, 255, 120), width=2)
            if not r: d.text((90 + i * cw + 4, 4), f, fill=(255, 230, 120), font=font)
    os.makedirs(WORK, exist_ok=True); M.save(os.path.join(WORK, 'costumes.jpg'), quality=84); print(os.path.join(WORK, 'costumes.jpg'), M.size)

def review():
    """一张总览（主线程只看这一张）→ art/work/priest_samples/overview.jpg：
    1 设计 + 选角立绘（和鬼剑士 / 格斗家同高）→ 2 七张动作表（缩略）→ 3 全部 98 帧 + 锚点（左边鬼剑士 / 格斗家 idle 同比例）
    → 4 全部帧拿着占位十字架（0.7 身高，运行时同样的叠放顺序）→ 5 游戏比例 1 倍 / 4 倍（三职业并排）→ 6 时装（原装 + 6 套同名帧）→ 7 指标"""
    os.makedirs(WORK, exist_ok=True); font = lambda s: ImageFont.truetype(FONT, s)
    def fit(im, h): im = im.convert('RGB'); return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    Lc = round(HEIGHT * CROSS_K * RES)
    # 1 设计 + 选角立绘
    parts = [fit(Image.open(REF), 700)] + ([fit(Image.open(os.path.join(PS, 'design.png')), 700)] if os.path.exists(os.path.join(PS, 'design.png')) else [])
    cls_art = [Image.open(os.path.join(HERE, 'final', 'class', f'{c}.webp')).convert('RGBA') for c in ('sword', 'fighter', 'priest')]
    CA = Image.new('RGB', (sum(i.width for i in cls_art) + 40, 420), (40, 44, 60)); x = 0
    for i in cls_art: CA.paste(i, (x, 0), i); x += i.width + 20
    parts.append(fit(CA, 700))
    D = Image.new('RGB', (sum(p.width for p in parts) + 20 * len(parts), 720), 'white'); x = 10
    for p in parts: D.paste(p, (x, 10)); x += p.width + 20
    D.save(os.path.join(WORK, 'design.jpg'), quality=86)
    # 2 七张表
    th = [fit(Image.open(sheet_path(n)), 560) for n in SHEETS if os.path.exists(sheet_path(n))]
    SHT = Image.new('RGB', (4 * 580, 2 * 580), 'white')
    for k, t in enumerate(th): SHT.paste(t, ((k % 4) * 580 + 10, (k // 4) * 580 + 10))
    dP, mP = spr('priest'); dS, mS = spr('sword'); dF, mF = spr('fighter')
    names = [f for sh in SHEETS.values() for f, _, _ in sh if f]
    order = ['idle'] + [f for f in names if f != 'idle']
    # 3 全部帧 + 锚点；4 全部帧 + 占位十字架
    per, cw, ch = 14, 170, 250
    cells = ['S:idle', 'F:idle'] + order
    nr = (len(cells) + per - 1) // per
    Fr = Image.new('RGB', (cw * per, ch * nr), (58, 62, 72)); d = ImageDraw.Draw(Fr)
    Cr = Image.new('RGB', (cw * per, ch * nr), (58, 62, 72)); d2 = ImageDraw.Draw(Cr); k = 0.78
    for idx, f in enumerate(cells):
        r, c = divmod(idx, per); ox, oy = c * cw + cw / 2, r * ch + ch - 24
        dd, mm, fn = (dS, mS, 'idle') if f == 'S:idle' else (dF, mF, 'idle') if f == 'F:idle' else (dP, mP, f)
        F = mm['frames'].get(fn)
        if not F: continue
        label = {'S:idle': '鬼剑士', 'F:idle': '格斗家'}.get(f, f)
        im = Image.open(os.path.join(dd, fn + '.webp')).convert('RGBA'); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        Fr.paste(im, (round(ox - F['ax'] * k), round(oy - F['ay'] * k)), im)
        w = F.get('wpn') if dd == dP else None
        if w:
            gx, gy = ox + (w['gx'] - F['ax']) * k, oy + (w['gy'] - F['ay']) * k; col = (255, 60, 60) if w['front'] else (60, 140, 255)
            d.line([gx, gy, gx + math.cos(w['ang']) * 36, gy + math.sin(w['ang']) * 36], fill=col, width=3); d.ellipse([gx - 4, gy - 4, gx + 4, gy + 4], outline=(255, 230, 0), width=2)
            for poly in w.get('hand', []):
                pts = [(ox + (poly[j] - F['ax']) * k, oy + (poly[j + 1] - F['ay']) * k) for j in range(0, len(poly), 2)]; d.line(pts + [pts[0]], fill=(0, 255, 255), width=1)
        if dd == dP and F.get('head'): hx, hy = ox + (F['head']['x'] - F['ax']) * k, oy + (F['head']['y'] - F['ay']) * k; d.ellipse([hx - 4, hy - 4, hx + 4, hy + 4], outline=(0, 255, 120), width=2)
        d.line([ox - 8, oy, ox + 8, oy], fill=(255, 255, 255)); d.text((c * cw + 4, r * ch + 3), label, fill=(255, 230, 120), font=font(15))
        if dd == dP:
            C, pad = with_cross(fn, F, dd, Lc); C = C.resize((round(C.width * k), round(C.height * k)), Image.LANCZOS)
            Cr.paste(C, (round(ox - (F['ax'] + pad) * k), round(oy - (F['ay'] + pad) * k)), C)
        else: Cr.paste(im, (round(ox - F['ax'] * k), round(oy - F['ay'] * k)), im)
        d2.line([ox - 8, oy, ox + 8, oy], fill=(255, 255, 255)); d2.text((c * cw + 4, r * ch + 3), label, fill=(255, 230, 120), font=font(15))
    Fr.save(os.path.join(WORK, 'frames.jpg'), quality=86); Cr.save(os.path.join(WORK, 'cross.jpg'), quality=86)
    # 5 游戏比例 1 倍（帧像素 / res）和 4 倍（最近邻）
    line = [(dS, mS, 'idle'), (dF, mF, 'idle'), (dP, mP, 'idle'), (dS, mS, 'walk1'), (dF, mF, 'walk1'), (dP, mP, 'walk1'),
            (dS, mS, 'run3'), (dF, mF, 'run3'), (dP, mP, 'run3'), (dP, mP, 'a1_2'), (dP, mP, 'p_pray1'), (dP, mP, 'pc_wall')]
    kk = 1 / RES; uw, uh = 80, 190; X1 = Image.new('RGBA', (uw * len(line), uh), (58, 62, 72, 255))
    for i, (dd, mm, f) in enumerate(line):
        F = mm['frames'].get(f)
        if not F: continue
        C, pad = with_cross(f, F, dd, Lc) if dd == dP else (Image.open(os.path.join(dd, f + '.webp')).convert('RGBA'), 0)
        C = C.resize((max(1, round(C.width * kk)), max(1, round(C.height * kk))), Image.LANCZOS)
        X1.alpha_composite(C, (round(i * uw + uw / 2 - (F['ax'] + pad) * kk), round(uh - 12 - (F['ay'] + pad) * kk)))
    X1 = X1.convert('RGB'); X1.save(os.path.join(WORK, 'scale_1x.png'))
    X4 = X1.crop((0, 0, uw * 6 + 24, uh)).resize(((uw * 6 + 24) * 4, uh * 4), Image.NEAREST); X4.save(os.path.join(WORK, 'scale_4x.png'))
    # 6 时装
    creview()
    # 总览
    Wd = 2400; fitw = lambda r: r.resize((Wd, round(r.height * Wd / r.width)), Image.LANCZOS)
    def title(t): T = Image.new('RGB', (Wd, 50), (30, 32, 38)); ImageDraw.Draw(T).text((14, 9), t, fill=(255, 230, 150), font=font(28)); return T
    chk = json.load(open(os.path.join(WORK, 'check.json'))) if os.path.exists(os.path.join(WORK, 'check.json')) else None
    blocks = [title('1 设计定稿：原装立绘 + 三视图；选角立绘按身体和鬼剑士 / 格斗家同高（十字架顶端出框）'), fitw(D),
              title('2 七张 4×4 动作表（样表 + 全套 6 张；第 1 格是站姿参考）'), fitw(SHT),
              title('3 全部 98 帧 + 锚点（红线 = 武器方向，黄圈 = 握点，青 = 握拳轮廓，绿圈 = 头）；前两格鬼剑士 / 格斗家同比例'), fitw(Fr),
              title(f'4 全部帧拿着占位十字架（{CROSS_K} 个身高，运行时同样的叠放顺序；正式武器图另做）'), fitw(Cr),
              title('5 游戏比例 1 倍（鬼剑士 / 格斗家 / 圣职者：站、走、跑；圣职者普攻 1、祈祷、圣光沁盾）'), X1.resize((X1.width * 2, X1.height * 2), Image.NEAREST),
              title('   4 倍（最近邻）：站、走'), X4.resize((min(Wd, X4.width), round(X4.height * min(Wd, X4.width) / X4.width)), Image.NEAREST)]
    cp = os.path.join(WORK, 'costumes.jpg')
    if os.path.exists(cp): blocks += [title('6 时装：第一行原装，下面每套一行（同名帧，拿着占位十字架）'), fitw(Image.open(cp).convert('RGB'))]
    if chk:
        L = chk['loco']; t = lambda c, k2: L[c][k2] or {}
        lines = ['7 指标（世界单位；走 / 跑一圈 8 帧；括号里是游戏里循环起伏修正之后，和 test/animfeel.mjs 同算法）']
        for n, c in (('圣职者', 'priest'), ('鬼剑士', 'sword'), ('格斗家', 'fighter')):
            wk, rn = t(c, 'walk'), t(c, 'run')
            lines.append(f'{n}：走 头部每帧最大跳 {wk.get("headJumpMax")}（{wk.get("gameJumpMax")}） 起伏 {wk.get("headBobY")}（{wk.get("gameBobY")}） 步幅 {wk.get("strideMatch")}   '
                         f'跑 最大跳 {rn.get("headJumpMax")}（{rn.get("gameJumpMax")}） 起伏 {rn.get("headBobY")}（{rn.get("gameBobY")}） 步幅 {rn.get("strideMatch")}   '
                         f'闪烁 walk {chk["flicker"][c]["walk"]} run {chk["flicker"][c]["run"]}   头部比例偏差中位 {chk["scale"][c]["median_dev"]}')
        A = chk['anchors']; CL = chk['cross_low']; run = [v for k, v in CL.items() if k.startswith('run') and v is not None]
        other = ' '.join(f'{k} {v}' for k, v in CL.items() if not k.startswith('run'))
        lines.append(f'锚点：武器 {A["wpn"]}/{A["frames"]} 帧（全部画在身前：{"是" if not A["back"] else A["back"]}），头 {A["head"]}，分割线 {A["cut"]}；'
                     f'0.7 身高十字架最低点离地：run1~8 ≥ {min(run) if run else "-"}，其他拖在身后的帧 {other}')
        for sid, v in chk.get('costume', {}).items():
            lines.append(f'时装 {sid}：{v["frames"]} 帧（缺 {len(v["missing"])}），和原装轮廓重合度 最低 {v["iou_min"]} 中位 {v["iou_median"]}，闪烁 walk {v["flicker"]["walk"]} run {v["flicker"]["run"]}')
        T = Image.new('RGB', (Wd, 40 + 36 * len(lines)), (30, 32, 38)); ImageDraw.Draw(T).multiline_text((14, 10), '\n'.join(lines), fill=(220, 230, 240), font=font(24), spacing=12); blocks.append(T)
    O = Image.new('RGB', (Wd, sum(b.height + 8 for b in blocks)), (30, 32, 38)); y = 0
    for b in blocks: O.paste(b, ((Wd - b.width) // 2, y)); y += b.height + 8
    O.save(os.path.join(WORK, 'overview.jpg'), quality=80); print('审图', os.path.join(WORK, 'overview.jpg'), O.size)

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
    elif a.cmd == 'regreen':
        for n in a.names or list(SHEETS):
            if os.path.exists(sheet_path(n)): regreen(n)
    elif a.cmd == 'frames': print(frames(a.names or list(SHEETS), a.dry))
    elif a.cmd == 'ccomposite':
        for g in CGROUPS: ccomposite(g, a.force)
    elif a.cmd == 'csheets':   # priest_art.py csheets [套装/组,...]（默认全部；已存在的跳过；串行，同一时间 1 个请求）
        items = [tuple(n.split('/')) for n in a.names] if a.names else [(sd, g) for sd in SETS for g in CGROUPS]
        for sd, g in items:
            ccomposite(g); print(FT.gen(csheet(sd, g), csheet_prompt(sd), [cbase(g), os.path.join(AVS, 'refs', f'sword@{sd}.png')], '3840x2160', a.force), flush=True)
    elif a.cmd == 'cframes': cframes(a.names or SETS)
    elif a.cmd == 'creview': creview(a.names or None)
    elif a.cmd == 'check': check()
    elif a.cmd == 'class': class_art()
    elif a.cmd == 'review': review()
    else: raise SystemExit('cmd: guides | ref | design | sheets | frames | check | class | review')

if __name__ == '__main__':
    main()
