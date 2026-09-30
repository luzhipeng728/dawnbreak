#!/usr/bin/env python3
"""格斗家（男）B1 原装人物帧（docs/CLASS_PLAN_FIGHTER.md §3、docs/FIGHTER_ART_SAMPLES.md）。
4×4 动作表：第 1 格是站姿参考（统一比例），其余 15 格是动作帧；每格都有姿势参考小人（poseguide 同一套画法，蓝 = 近侧、红 = 远侧），
双拳各握一根从指节伸出、沿前臂方向的纯绿 #00FF00 占位棒（D5：拳上武器的双手锚点 wpn / wpn2），一次出图，不再单独跑占位轮。
切帧复用 avatar_frames（抠占位棒 + 补色 + 握点 / 拳头轮廓）、avatar_head（头部锚点）、avatar_cuts（混搭分割线），只在本文件里把 3×3 换成 4×4，不改它们的表。
原图写到主仓库 art/src/fighter/（不进 git）。
  fighter_art.py guides                      姿势参考图 → <主仓库>/art/src/fighter/guide_<表>.png
  fighter_art.py ref | design [--force]      原装立绘 <主仓库>/art/src/fighter_ref.png（参考鬼剑士的比例 / 画风）| 设计定稿三视图 fighter/design.png
  fighter_art.py sheets [--only 表] [-j 2]   4×4 动作表 → <主仓库>/art/src/fighter/sheets/fighter_<表>.png（已存在的跳过，--force 重出）
  fighter_art.py touch <表> <格>             单格返修（提示词在 TOUCH），原表备份到 sheets/_pre/
  fighter_art.py frames [表...] [--dry]      切帧 → art/final/spr/fighter/（只替换这些表的帧）+ 双拳 / 头部锚点 + 分割线；预览 <主仓库>/art/src/fighter/cut/（auto.png = 兜底拳头锚点，逐个看）
  fighter_art.py check                       体检：衣服闪烁 / 动作表逐格 / 头部比例 / 锚点，和三职业原装对比 → art/work/fighter_samples/check.json
  fighter_art.py class                       选角立绘 art/final/class/fighter.webp（原装立绘去白底）
  fighter_art.py review                      审图总览 → art/work/fighter_samples/（游戏内连拍先跑 node art/tools/fighter_shots.mjs）
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
KEYS = ('lean', 'nth', 'nsh', 'fth', 'fsh', 'nua', 'nfa', 'fua', 'ffa', 'lift', 'open')
P = lambda *v: dict(zip(KEYS, v + ('',) * (len(KEYS) - len(v))))
# 角度：0 = 竖直向下，正 = 向前（面朝右），180 = 竖直向上；lean 躯干前倾；lift 额外离地（参考图像素）
IDLE = P(4, 20, -2, -16, -30, 40, 150, 15, 165, 0)
IDLE_T = ('standing idle in a light agile fighting stance on the balls of the feet: near (blue) leg forward, far leg back, knees slightly bent, '
          'the near fist raised forward at face height and the far fist guarding the chin')
# 第二版 move 表把拳头画成了深色（run1 手背还多了一块藏青色）→ 提示词锁死绑带颜色（原装设计没有任何蓝色 / 深色手套）
HANDS_T = ('Both hands and forearms are ALWAYS wrapped in light CREAM-colored cloth bandages exactly as in the first image: '
           'no dark gloves, no dark or blue patches on the hands, the fists are as light as the forearm wraps. ')
# 跑：长步幅（接触帧前后脚距离约 1.5 倍），第 3、7 帧是真正的腾空帧（前后腿大开），不是站直的过渡帧（docs/ANIMATION.md §5）
# 样表第一版 run2 / run6 重心腿弯太多（头比腾空帧低 17.6，animfeel 头部起伏 10.9）→ 膝盖少弯、腾空只离地一点，头整圈差不多一样高
RUN_T = ' Keep the head at almost the same height in every run frame (only a slight bob).'
RUN = [('run1', P(14, 38, 20, -40, -72, -40, 50, 45, 135, 0), 'run contact: near leg reaching forward landing on the heel, far leg pushing off far behind, near fist swung back, far fist forward'),
       ('run2', P(14, 14, -8, 28, -58, -15, 75, 20, 110, 0), 'run passing: weight on the near leg under the body with the knee only SLIGHTLY bent, far knee driving forward, arms passing'),
       ('run3', P(14, -42, -52, 66, -4, 35, 125, -35, 55, 16), 'run FLIGHT: both feet just off the ground, legs spread wide front and back: near leg stretched straight behind, far knee high in front'),
       ('run4', P(14, -30, -96, 46, 28, 45, 135, -40, 50, 8), 'run reach: far leg reaching forward to land, near leg folded up behind'),
       ('run5', P(14, -40, -72, 38, 20, 45, 135, -40, 50, 0), 'run contact MIRRORED: far leg landing forward, near leg pushing off far behind, near fist forward'),
       ('run6', P(14, 28, -58, 14, -8, 20, 110, -15, 75, 0), 'run passing MIRRORED: weight on the far leg with the knee only SLIGHTLY bent, near knee driving forward'),
       ('run7', P(14, 66, -4, -42, -52, -35, 55, 35, 125, 16), 'run FLIGHT MIRRORED: both feet just off the ground, near knee high in front, far leg stretched straight behind'),
       ('run8', P(14, 46, 28, -30, -96, -40, 50, 45, 135, 8), 'run reach MIRRORED: near leg reaching forward to land, far leg folded up behind')]
RUN = [(n, Q, t + RUN_T) for n, Q, t in RUN]
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
# 走：轻快的护架步（拳头一直护在胸前），腿按 poseguide 的步态（近侧腿第 1 帧在前）
# 第一版写了“body at its lowest / highest”，模型把重心起伏画得太大（animfeel 头部每步跳 4.6、起伏 6.8，鬼剑士 0.5 / 0.8）→ 头整圈一样高
WALK_T = ['walk contact: near leg stepping forward on the heel, far leg stretched behind on its toes', 'walk: weight moving onto the near leg in front, legs almost straight',
          'walk passing: near leg straight under the body, far leg lifted with the knee bent passing forward', 'walk: standing on the near leg, far leg swinging forward in front',
          'walk contact MIRRORED: far leg stepping forward on the heel, near leg stretched behind on its toes', 'walk MIRRORED: weight moving onto the far leg in front, legs almost straight',
          'walk passing MIRRORED: far leg straight under the body, near leg lifted passing forward', 'walk MIRRORED: standing on the far leg, near leg swinging forward']
WALK_T = [t + '; the head stays at exactly the same height as in the other walk frames' for t in WALK_T]
def walk_pose(ph):
    import poseguide as PG
    L = PG.pose_at(ph, False); sw = 8 * math.cos(math.radians(ph))
    return P(4, L['nth'], L['nsh'], L['fth'], L['fsh'], 40 - sw, 150, 16 + sw, 162, 0)
WALK = [(f'walk{i + 1}', walk_pose(i * 45), WALK_T[i] + ', both fists kept up in a light guard in front of the chest') for i in range(8)]
REACT = [('hit1', P(-12, 14, -4, -12, -24, 70, 150, 50, 160, 0), 'hurt: flinching backward, eyes shut in pain, fists raised defensively'),
         ('hit2', P(-26, 20, 0, -8, -20, 20, 60, -20, 30, 0), 'hurt harder: knocked back with the upper body bent backward, arms thrown forward'),
         ('hit3', P(-38, 45, 20, -5, -10, 40, 80, -10, 40, 0), 'hit hard: knocked backward off balance, body bent far back, head thrown back, the near foot lifted off the ground'),
         ('airUp', P(-40, 40, 10, 20, -10, 150, 170, 120, 150, 90), 'launched up into the air by a hit: body arched backward and rising, arms flung up, legs trailing, clearly airborne high above the ground'),
         ('tumble', P(210, 160, 175, 195, 215, 10, -10, -20, -40, 80), 'tumbling helplessly in mid-air UPSIDE DOWN in an uncontrolled backward flip, head pointing down, airborne'),
         ('air', P(-90, 100, 110, 80, 70, 200, 220, 170, 190, 70), 'knocked into the air: body horizontal tumbling backward mid-air, arms and legs flailing'),
         ('bounce', P(-90, 140, 160, 120, 140, 170, 180, 150, 170, 10), 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air')]
DOWN = [('down', P(-90, 92, 92, 88, 90, 80, 95, 100, 110, 0), 'lying knocked down flat on the back on the ground, head to the left, limp'),
        ('getup', P(10, 90, 0, 0, -90, 60, 20, 20, 60, 0), 'getting up from the ground: on one knee, the near foot planted forward, pushing up with the near fist on the knee'),
        ('tech', P(8, 90, 0, 0, -90, 40, 150, 20, 160, 0), 'quick recovery: crouched low on one knee in a defensive guard, fists up, ready to spring up'),
        ('held', P(0, 10, -10, -15, -35, 60, 120, -30, 10, 70), 'lifted off the ground as if grabbed by the collar by an invisible force: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person'),
        ('charge', P(8, 45, -20, -40, -60, -20, 60, -10, 70, 0), 'charging power: low wide horse stance, both fists pulled back at the hips, focused'),
        ('roll', P(70, 130, 10, 120, 0, 110, 40, 100, 30, 0), 'dodge roll: curled up into a tight ball rolling forward, knees pulled to the chest, head tucked'),
        ('victory', P(-4, 8, -4, -8, -14, 170, 178, -40, 80, 0), 'victory pose: the near fist punched high into the sky, the far fist on the hip, confident grin')]
# 基础技能共用姿势（§3.2）；open = 这只手张开（推掌 / 结印 / 砸地 / 扔完）不拿绿棒，锚点靠绑带颜色补
BASE2 = [('f_lift', P(-10, 15, 0, -20, -30, 172, 178, 165, 175, 0), 'lift: both arms raised straight up above the head, fists clenched as if hoisting a heavy enemy overhead (NO enemy drawn), legs braced'),
         ('f_slam', P(45, 40, -10, -30, -45, 60, 40, 50, 30, 0), 'slam: bent forward at the waist, both fists swung down together in front to knee height, as if slamming an enemy onto the ground'),
         ('f_spin1', P(-12, 95, 95, -5, -10, 110, 100, -60, -80, 0), 'spinning kick 1: pivoting on the far leg, the near leg swept straight out forward at waist height, arms spread wide for balance'),
         ('f_spin2', P(10, 5, -5, -95, -95, -110, -100, 60, 80, 0), 'spinning kick 2: body turned around, the far leg swept straight out BEHIND at waist height, arms spread wide'),
         ('f_stomp', P(5, 10, 0, 80, -30, 60, 130, 30, 150, 70), 'eagle stomp: airborne, the near leg stamping straight DOWN, the far knee raised, fists in guard'),
         ('f_dive', P(-30, 45, 45, 20, -60, -20, 20, 40, 140, 80), 'diving kick: airborne, dropping diagonally, the near leg thrust straight down-forward at 45 degrees, far leg tucked, body leaning back'),
         ('f_flykick', P(-60, 90, 90, 50, -40, 60, 150, 40, 160, 60), 'horizontal flying kick: airborne, body nearly horizontal, the near leg extended straight forward, far leg tucked'),
         ('f_palm1', P(10, 28, 4, -22, -36, 88, 90, -30, 60, 0, 'n'), 'one-palm push: the near arm thrust straight forward with the OPEN palm facing forward, far fist at the hip, slight lunge')]
BASE3 = [('f_palm2', P(14, 34, 6, -26, -40, 80, 85, 86, 92, 0, 'nf'), 'double-palm push: both arms thrust forward together with both OPEN palms facing forward, deep front stance'),
         ('f_focus', P(0, 30, -20, -30, -50, 30, 160, 20, 165, 0), 'focusing ki: both forearms crossed in front of the chest (an X), fists clenched, low stance, tense'),
         ('f_seal', P(0, 12, -4, -12, -20, 50, 135, 45, 130, 0, 'nf'), 'hand seal: both OPEN hands joined in a hand seal in front of the chest, fingers interlocked, eyes focused'),
         ('f_quake', P(20, 60, -30, 40, -50, 40, 20, 30, 10, 0), 'ground stomp landing: just landed with BOTH feet stamping the ground, knees deeply bent, fists pulled down beside the knees'),
         ('f_smash', P(50, 90, 0, 0, -90, 25, 15, -20, 40, 0, 'n'), 'ground smash: down on one knee, the near OPEN palm slammed flat on the ground in front, far fist back'),
         ('fn_meditate', P(0, 90, -80, 85, -95, 60, 100, 50, 95, 40), 'nen meditation: floating in the air sitting cross-legged, eyes closed, both fists resting on the knees, calm'),
         ('fn_ride', P(-5, 80, 10, 70, 0, 70, 120, 40, 60, 60), 'riding: sitting astride an invisible big mount with the legs apart hanging down, the near fist raised forward, the far fist gripping low in front, NO animal drawn'),
         ('fn_thrust1', P(-5, 25, 0, -20, -30, -30, 100, 30, 150, 0), 'lightning blade wind-up: the near fist drawn back beside the waist, far fist guarding'),
         ('fn_thrust2', P(18, 40, 10, -35, -45, 90, 90, 10, 150, 0), 'lightning blade thrust: lunging, the near fist driven straight forward at chest height, arm fully extended'),
         ('fs_elbow', P(25, 45, 0, -40, -50, 95, -90, 20, 150, 0), 'elbow rush: lunging forward, the near elbow driven forward at shoulder height with the forearm folded back (fist at the chest), far fist guarding'),
         ('fs_kneekick', P(-8, 115, 20, -10, -5, 40, 150, 20, 160, 20), 'jumping knee: springing forward off the ground, the near knee driven up and forward at chest height, fists in guard'),
         ('fs_rush1', P(10, 26, 2, -20, -34, 90, 90, -20, 110, 0), 'rapid punches 1: the near fist fully extended straight forward, the far fist pulled back to the chest'),
         ('fs_rush2', P(12, 26, 2, -20, -34, 20, 150, 88, 90, 0), 'rapid punches 2: the far fist fully extended straight forward, the near fist pulled back to the chin'),
         ('fs_dashpunch', P(30, 70, 20, -50, -55, 85, 85, -30, 40, 0), 'dashing straight: very deep lunge far forward, the near arm fully extended in a heavy straight punch, body leaning forward'),
         ('fs_divepunch', P(120, -150, -160, -130, -150, 40, 40, -60, -20, 80), 'diving punch: airborne, diving head-first diagonally downward, the near fist punching down-forward ahead, legs trailing up behind')]
# 街霸 fb_ / 柔道家 fg_（投掷物、锁链、被抓的敌人都是运行时画的，帧里不画）
JOBS = [('fb_throw1', P(-12, 20, 0, -18, -30, 200, 220, 70, 100, 0), 'overhand throw wind-up: the near fist raised high behind the head (as if holding a small object, NOTHING drawn in it), far arm pointing forward, weight on the back leg'),
        ('fb_throw2', P(15, 35, 5, -30, -40, 70, 40, -30, 20, 0, 'n'), 'overhand throw release: the near arm swung forward and down, the hand OPEN after releasing, weight shifted forward'),
        ('fb_sidethrow', P(5, 25, 0, -20, -30, 95, 95, -40, 30, 0, 'n'), 'side-arm fling: the near arm swept straight forward at waist height, the hand OPEN after flinging, body twisted'),
        ('fb_pound1', P(0, 10, -85, -5, -90, 175, 170, 60, 30, 30), 'straddle pound wind-up: kneeling astride as if sitting on a fallen enemy (NO enemy drawn), the near fist raised high above the head, the far fist gripping low in front'),
        ('fb_pound2', P(20, 10, -85, -5, -90, 60, 30, 60, 30, 30), 'straddle pound: kneeling astride, leaning forward, the near fist smashed down in front at ground level'),
        ('fb_slide', P(-60, 88, 90, 40, -60, -20, 30, -60, -20, 0), 'slide tackle: sliding feet-first along the ground, the near leg extended straight forward along the ground, far leg bent under, body leaning back low'),
        ('fb_chain1', P(-8, 20, 0, -18, -30, 175, 120, 20, 150, 0), 'chain swing: the near fist raised above the head swinging in a circle (the chain itself is NOT drawn), far fist guarding'),
        ('fb_chain2', P(18, 38, 5, -28, -40, 80, 60, -10, 120, 0), 'chain whip: the near arm lashed forward and down (the chain is NOT drawn), lunging forward'),
        ('fb_taunt', P(-10, 10, -4, -10, -16, 80, 120, -40, 80, 0, 'n'), 'taunt: standing cockily leaning back, the near hand OPEN beckoning the enemy, far fist on the hip, smirking'),
        ('fg_scissor', P(-70, 95, 100, 70, 80, 150, 170, 130, 160, 70), 'flying scissors: airborne, body leaning far back almost horizontal, BOTH legs extended forward in a scissor clamp (one high, one low), arms reaching back'),
        ('fg_swing1', P(-20, 30, 10, -20, -30, 60, 60, 65, 65, 0), 'giant swing 1: leaning far back, both arms extended forward at waist height with fists gripping (as if spinning an enemy by the legs, NO enemy drawn), feet planted'),
        ('fg_swing2', P(-25, 20, 5, -35, -40, -60, -60, -55, -55, 0), 'giant swing 2: body turned, both arms extended BEHIND with fists gripping, leaning away, spinning'),
        ('fg_press', P(95, 20, 30, -20, -10, 120, 100, 100, 80, 40), 'body press: falling flat face-down through the air, body horizontal, arms and legs spread, about to crush something below'),
        ('fg_backflip', P(200, 170, 190, 160, 180, 0, -20, 20, 10, 80), 'backflip: mid-air backward somersault, upside down, body arched, knees slightly bent'),
        ('fg_piledrive', P(5, 95, 90, 90, 88, 90, 150, 85, 145, 0), 'piledriver impact: sitting down hard on the ground with both legs straight forward, both fists clamped together in front of the chest as if gripping an enemy head-down (NO enemy drawn)')]
SHEETS = {   # 表名 → 16 格 [(帧名, 姿势, 说明)]；第 1 格 move 表当 idle，其它表只作比例参考
    'move': [('idle', IDLE, IDLE_T)] + RUN + JUMP + JKICK,
    'combo': [(None, IDLE, IDLE_T)] + COMBO,
    # walk 表出了两版：第二版（头一样高）的走路格用，受击格把远侧拳的棒画成了嘴边的褐色棍子 → 受击格用第一版（原样另存成 fighter_react.png，只切受击格）
    'walk': [(None, IDLE, IDLE_T)] + WALK + [(None, Q, t) for _, Q, t in REACT],
    'react': [(None, IDLE, IDLE_T)] + [(None, Q, t) for _, Q, t in WALK] + REACT,
    'base2': [(None, IDLE, IDLE_T)] + DOWN + BASE2,
    'base3': [(None, IDLE, IDLE_T)] + BASE3,
    'jobs': [(None, IDLE, IDLE_T)] + JOBS,
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
    lowest = max(max(p[1] for p in J.values()), head[1] + HEAD_R) + 8   # 躺地 / 倒立时最低点是头或身体
    dx, dy = cx, base - lowest - Q['lift']
    T = lambda p: (p[0] + dx, p[1] + dy)
    def limb(a, b, col, w=W):
        d.line([T(a), T(b)], fill=OUT, width=w + 7); d.line([T(a), T(b)], fill=col, width=w)
        for p in (a, b): x, y = T(p); d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)
    def fist(e, h, col, side):   # 拳头 + 从指节伸出的绿色占位棒（沿前臂方向）；张开的手：没有棒，画三根手指
        ux, uy = (h[0] - e[0]) / FA, (h[1] - e[1]) / FA; x, y = T(h)
        if side in Q['open']:
            for a in (-0.5, 0, 0.5):
                c, s_ = math.cos(a), math.sin(a); d.line([x, y, x + (ux * c - uy * s_) * 26, y + (uy * c + ux * s_) * 26], fill=OUT, width=9)
            d.ellipse([x - FIST, y - FIST, x + FIST, y + FIST], fill=(250, 250, 250), outline=OUT, width=3); return
        d.line([T(h), T((h[0] + ux * STICK, h[1] + uy * STICK))], fill=GREEN, width=STW)
        d.ellipse([x - FIST, y - FIST, x + FIST, y + FIST], fill=col, outline=OUT, width=3)
    limb(sho, fe, FAR); limb(fe, fh, FAR); fist(fe, fh, FAR, 'f')
    limb(hip, fk, FAR); limb(fk, fa, FAR); limb(fa, ft, FAR, 20)
    limb(hip, neck, BODY, 48)
    x, y = T(head); d.ellipse([x - HEAD_R, y - HEAD_R, x + HEAD_R, y + HEAD_R], fill=HEADC, outline=OUT, width=5)
    d.polygon([(x + HEAD_R - 5, y - 6), (x + HEAD_R + 20, y + 5), (x + HEAD_R - 5, y + 17)], fill=HEADC, outline=OUT)
    d.ellipse([x + 28, y - 14, x + 41, y + 2], fill=OUT)
    limb(hip, nk, NEAR); limb(nk, na, NEAR); limb(na, nt, NEAR, 20)
    limb(sho, ne, NEAR); limb(ne, nh, NEAR); fist(ne, nh, NEAR, 'n')

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
            f'{HANDS_T}The hands are tightly clenched fists (unless a frame says a hand is OPEN). In EVERY frame EACH fist holds one short, perfectly straight, rigid stick painted in ONE flat pure green color ({GREEN}), '
            'exactly like the green sticks in the pose guide: the stick sticks straight out of the front of the fist (out of the knuckles), continuing the line of the forearm, about as long as the forearm; '
            'no outline, no shading, no highlight, uniform thickness about two fingers wide. The green sticks are the ONLY thing copied literally from the pose guide. '
            'BOTH fists must show their green stick in every frame: when the far fist is behind or beside the body, its green stick must still clearly stick out where it can be seen. '
            'An OPEN hand (drawn with three finger lines and no stick in the pose guide) holds NO stick. '
            'Only the fists hold green sticks: the feet, shoes and legs NEVER have any green on them, not even in kicking frames. '
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
    """只留拳头握着的占位棒，并标出是哪只拳头（st['side'] = 'n' 近侧 / 'f' 远侧）：
    ① TOE_FIX 里的帧（踢腿时生图在脚尖也画了一截绿棒，逐帧看过的）：离姿势小人脚尖最近的那根丢掉（绿色像素照样抠掉）；
    ② 同一根棒被拳头 / 身体挡成两段（握点相距 < 30 像素）：留长的；③ 还多于两根：挑和小人两只手（外框归一化）最对得上的一对；
    ④ 剩下的按总距离最小一一对到近侧 / 远侧手。颜色分不开脚和拳（拳头常贴着黑裤子 / 腰带，脚尖棒的轴线会穿进米色绑腿），所以不按颜色判"""
    Qs = {f: Q for f, Q, _ in SHEETS[name]}; log = []; cnt = {'n': 0, 'f': 0}
    for fn, F in fr.items():
        J = joints(Qs[fn]); bx0, by0, bx1, by1 = jbox(J); h, w = F['sub'].shape[:2]
        norm = lambda p: ((p[0] - bx0) / (bx1 - bx0), (p[1] - by0) / (by1 - by0))
        cand = {k: norm(J[k]) for k in ('nh', 'fh', 'nt', 'ft')}
        uv = lambda st: ((st['gx'] - F['org_l'][0]) / w, (st['gy'] - F['org_l'][1]) / h)
        dist = lambda st, t: math.hypot(uv(st)[0] - cand[t][0], uv(st)[1] - cand[t][1])
        sts = list(F['sticks'])
        for _ in range(TOE_FIX.get(fn, 0)):
            if not sts: break
            st = min(sts, key=lambda st: min(dist(st, 'nt'), dist(st, 'ft'))); sts = [x for x in sts if x is not st]; log.append(f'{fn}:脚')
        sts.sort(key=lambda st: -(st['t1'] - st['t0'])); keep = []
        for st in sts:
            if any(math.hypot(st['gx'] - k['gx'], st['gy'] - k['gy']) < 30 for k in keep): log.append(f'{fn}:重复'); continue
            keep.append(st)
        if len(keep) > 2:
            pair = min(itertools.permutations(keep, 2), key=lambda pr: dist(pr[0], 'nh') + dist(pr[1], 'fh')); log += [f'{fn}:多余'] * (len(keep) - 2); keep = list(pair)
        best = min(itertools.permutations(('nh', 'fh'), len(keep)), key=lambda perm: sum(dist(st, t) for st, t in zip(keep, perm))) if keep else ()
        for st, t in zip(keep, best): st['side'] = t[0]
        for s in keep: s['minor'] = False; cnt[s['side']] += 1   # 两只拳头各管各的：短的那根不是“碎块”
        F['sticks'] = keep
    if log: print('  丢掉的占位棒：' + ' '.join(log))
    print(f'  拳头锚点：近侧拳 {cnt["n"]}/{len(fr)} 帧，远侧拳 {cnt["f"]}/{len(fr)} 帧')
    return cnt

TOE_FIX = {'f_low2': 1, 'f_mid2': 1, 'f_axe1': 1, 'f_axe2': 1, 'f_high2': 1}   # 生图在脚尖画了绿棒的帧（art/src/fighter/cut/ 预览逐帧看过）：丢几根
BANDAGE = dict(h=(12, 45), s=(0.06, 0.34), v=(0.64, 1.01))   # 拳头绑带的颜色（HSV；按已有握点附近的像素量的）

def auto_hand(fn, ent, Q, side):
    """没有占位棒的拳头（被身体半挡住、张开的手、模型漏画了棒）：在姿势小人这只手的位置附近找绑带颜色，
    只要“离这只手比离另一只手 / 膝盖 / 脚踝 / 脚尖都近”的像素，取最近的一块，沿前臂方向最前端 = 拳头。找不到（真的被挡住了）返回 None"""
    a = np.array(Image.open(os.path.join(SPR, fn + '.webp')).convert('RGBA')); h, w = a.shape[:2]
    J = joints(Q); bx0, by0, bx1, by1 = jbox(J)
    norm = lambda p: np.array(((p[0] - bx0) / (bx1 - bx0) * w, (p[1] - by0) / (by1 - by0) * h))
    E, Hh = norm(J[side + 'e']), norm(J[side + 'h']); d = Hh - E; d = d / max(1e-6, np.hypot(*d))
    rgb = a[..., :3].astype(np.float32) / 255; mx, mn = rgb.max(-1), rgb.min(-1); dd = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60; sat = (mx - mn) / np.maximum(mx, 1e-6)
    m = (a[..., 3] > 200) & (hue >= BANDAGE['h'][0]) & (hue <= BANDAGE['h'][1]) & (sat >= BANDAGE['s'][0]) & (sat <= BANDAGE['s'][1]) & (mx >= BANDAGE['v'][0])
    yy, xx = np.mgrid[0:h, 0:w]; dh = np.hypot(xx - Hh[0], yy - Hh[1])
    for kk in (('fh' if side == 'n' else 'nh'), 'nk', 'fk', 'na', 'fa', 'nt', 'ft'):
        o = norm(J[kk]); m &= dh <= np.hypot(xx - o[0], yy - o[1])
    for kk in ('wpn', 'wpn2'):   # 另一只拳头和它的前臂（握点往回 40 像素的一段胶囊）
        if kk not in ent: continue
        o = ent[kk]; od = np.array((math.cos(o['ang']), math.sin(o['ang']))); t = np.clip((xx - o['gx']) * od[0] + (yy - o['gy']) * od[1], -40, 10)
        m &= np.hypot(xx - (o['gx'] + od[0] * t), yy - (o['gy'] + od[1] * t)) > 13
    if ent.get('head'): m &= np.hypot(xx - ent['head']['x'], yy - ent['head']['y']) > HEAD_PX   # 脸和绑带同色：头部一圈不要
    m &= dh < 0.16 * max(w, h)
    if m.sum() < 40: return None
    lab, comps = components((m * 255).astype(np.uint8), f=1, min_cells=40)
    if not comps: return None
    c = min((c for c, _ in comps), key=lambda c: float(dh[lab == c].min()))
    ys, xs = np.where(lab == c); pts = np.stack([xs, ys], 1).astype(np.float32); pr = pts @ d
    tip = pts[pr >= np.percentile(pr, 80)].mean(0) - d * 3
    if np.hypot(*(tip - Hh)) > 0.16 * max(w, h): return None
    return {'gx': round(float(tip[0]), 1), 'gy': round(float(tip[1]), 1), 'ang': round(math.atan2(d[1], d[0]), 3), 'len': 30.0, 'bk': 0.0, 'front': 1, 'side': side, 'auto': 1}

HEAD_PX = 46   # 头部锚点周围这么大（帧像素）不找拳头：站姿头高约 80 像素，下巴在锚点下方约 40
CYCLE_FILL = ('walk',)   # 这些循环片段缺的拳头锚点从同一圈里最近的帧抄（跑步两臂大幅摆动，不抄）
# 按绑带颜色补的锚点逐个看过（art/src/fighter/cut/auto.png）后，不对的写在这里（那只拳其实被身体挡住，找到的是另一只胳膊的皮肤）：'帧:n|f' → None = 不补
HAND_FIX = {k: None for k in ('f_shoulder1:f', 'f_shoulder2:n', 'fn_thrust2:f', 'fs_elbow:f', 'f_crouch:f', 'f_high1:f', 'f_jab1:f', 'f_jab2:f', 'f_seal:n', 'tech:f', 'fg_piledrive:f',
                              'f_flykick:f', 'f_knee:n', 'fb_chain2:f') + tuple(f'walk{i}:f' for i in range(1, 9))}   # 走路：后手护在下巴下，找到的都是下巴

def hand_anchors(fr, name, meta):
    """wpn / wpn2 标上是哪只拳头（side：'n' 近侧 / 'f' 远侧，排序同 avatar_frames.finish）；没有棒的拳头按绑带颜色补一个锚点（auto: 1，只有握点和前臂方向，没有握拳轮廓）"""
    Qs = {f: Q for f, Q, _ in SHEETS[name]}; add = []; have = {}
    for fn, F in fr.items():
        ent = meta['frames'][fn]; main = sorted(F['sticks'][:2], key=lambda st: (-st['front'], -math.cos(st['ang'])))
        for key, st in zip(('wpn', 'wpn2'), main):
            if key in ent: ent[key]['side'] = st['side']
        have[fn] = {st['side'] for st in main}
    real = {f: set(v) for f, v in have.items()}
    for pre in CYCLE_FILL:   # 走路一圈：拳头一直护在下巴前，缺的那只拳从最近的有棒的帧抄（相对头部锚点），手套不会一帧有一帧没有
        cyc = [f for f in fr if f.startswith(pre)]; cyc.sort(key=lambda f: int(f[len(pre):]))
        rel = lambda F, w: (w['gx'] - F['head']['x'], w['gy'] - F['head']['y'])
        pos = {s: [rel(meta['frames'][g], w) for g in cyc for w in (meta['frames'][g].get(k) for k in ('wpn', 'wpn2')) if w and w.get('side') == s and meta['frames'][g].get('head')] for s in 'nf'}
        if pos['n'] and pos['f'] and math.hypot(*(np.median(pos['n'], 0) - np.median(pos['f'], 0))) < 12:   # 两只拳护在一起时近侧 / 远侧会标反：同一个位置的其实是同一只拳，按多数统一
            maj = 'n' if len(pos['n']) >= len(pos['f']) else 'f'
            for g in cyc:
                ws = [meta['frames'][g][k] for k in ('wpn', 'wpn2') if k in meta['frames'][g]]
                if len(ws) == 1: ws[0]['side'] = maj; real[g] = have[g] = {maj}
            add.append(f'{pre}:统一成{maj}')
        for i, fn in enumerate(cyc):
            ent = meta['frames'][fn]
            for side in 'nf':
                if side in have[fn] or not ent.get('head'): continue
                donors = sorted((min(abs(i - j), len(cyc) - abs(i - j)), g) for j, g in enumerate(cyc) if side in real[g] and meta['frames'][g].get('head'))
                if not donors: continue
                D = meta['frames'][donors[0][1]]; w = next(D[k] for k in ('wpn', 'wpn2') if k in D and D[k].get('side') == side)
                A = dict(w, gx=round(ent['head']['x'] + w['gx'] - D['head']['x'], 1), gy=round(ent['head']['y'] + w['gy'] - D['head']['y'], 1), auto=2); A.pop('hand', None)
                ent['wpn' if 'wpn' not in ent else 'wpn2'] = A; have[fn] = have[fn] | {side}; add.append(f'{fn}:{side}←{donors[0][1]}')
    for fn, F in fr.items():
        ent = meta['frames'][fn]
        for side in 'nf':
            if side in have[fn] or f'{fn}:{side}' in HAND_FIX: continue
            A = auto_hand(fn, ent, Qs[fn], side)
            if A: ent['wpn' if 'wpn' not in ent else 'wpn2'] = A; add.append(f'{fn}:{side}')
    print(f'  绑带颜色补的拳头锚点 {len(add)} 个：{" ".join(add)}')
    return len(add)

def auto_preview(meta):
    """按绑带颜色补的锚点：每个锚点周围放大 3 倍一格（品红圈 = 握点、线 = 前臂方向），逐个看对不对 → art/src/fighter/cut/auto.png + art/work/fighter_samples/anchors_auto.jpg"""
    tiles = []; R = 45
    for f, F in sorted(meta['frames'].items()):
        for k in ('wpn', 'wpn2'):
            w = F.get(k)
            if not w or not w.get('auto'): continue
            im = Image.open(os.path.join(SPR, f + '.webp')).convert('RGBA'); bg = Image.new('RGBA', im.size, (70, 110, 90, 255)); bg.alpha_composite(im)
            x0, y0 = int(w['gx'] - R), int(w['gy'] - R); c = Image.new('RGBA', (2 * R, 2 * R), (40, 40, 40, 255))
            c.paste(bg.crop((max(0, x0), max(0, y0), x0 + 2 * R, y0 + 2 * R)), (max(0, -x0), max(0, -y0))); c = c.resize((6 * R, 6 * R), Image.NEAREST); d = ImageDraw.Draw(c)
            d.ellipse([3 * R - 6, 3 * R - 6, 3 * R + 6, 3 * R + 6], outline=(255, 0, 255), width=3)
            d.line([3 * R, 3 * R, 3 * R + math.cos(w['ang']) * 60, 3 * R + math.sin(w['ang']) * 60], fill=(255, 0, 255), width=3); d.text((4, 4), f'{f}:{w["side"]}', fill=(255, 255, 0)); tiles.append(c)
    if not tiles: return
    per = 10; cw = tiles[0].width; M = Image.new('RGB', (cw * min(per, len(tiles)), cw * ((len(tiles) + per - 1) // per)), (20, 20, 20))
    for i, t in enumerate(tiles): M.paste(t.convert('RGB'), ((i % per) * cw, (i // per) * cw))
    M.save(os.path.join(FS, 'cut', 'auto.png')); os.makedirs(WORK, exist_ok=True); M.convert('RGB').save(os.path.join(WORK, 'anchors_auto.jpg'), quality=82)

def touch(name, idx, prompt):
    """单格返修：把 4×4 表第 idx 格（0 起）放大到 1024 连同原装立绘一起改图，按身体外框缩放、脚底对齐贴回原位（原表备份到 sheets/_pre/）"""
    from avatar_gen import body_box
    sp = sheet_path(name); sh = Image.open(sp).convert('RGB'); bk = os.path.join(FS, 'sheets', '_pre'); os.makedirs(bk, exist_ok=True); n = 1
    while os.path.exists(os.path.join(bk, f'fighter_{name}_touch{n}.png')): n += 1
    sh.save(os.path.join(bk, f'fighter_{name}_touch{n}.png'))
    r, c = divmod(idx, N); bx = (c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL); cell = sh.crop(bx)
    tmp = os.path.join(FS, 'touch'); os.makedirs(tmp, exist_ok=True)
    src, out = os.path.join(tmp, f'{name}_c{idx}.png'), os.path.join(tmp, f'{name}_c{idx}_fix{n}.png')
    cell.resize((1024, 1024), Image.LANCZOS).save(src)
    res = gen(out, prompt, [src, REF], '1024x1024', True); print(res)
    if not res.startswith('ok'): return
    fix = Image.open(out).convert('RGB').resize((CELL, CELL), Image.LANCZOS)
    a0, a1 = body_box(np.array(cell)), body_box(np.array(fix)); k = (a0[3] - a0[1]) / (a1[3] - a1[1])
    fx = fix.resize((round(CELL * k), round(CELL * k)), Image.LANCZOS)
    dx = round((a0[0] + a0[2]) / 2 - (a1[0] + a1[2]) / 2 * k); dy = round(a0[3] - a1[3] * k)
    canvas = Image.new('RGB', (CELL, CELL), (255, 255, 255)); canvas.paste(fx, (dx, dy)); sh.paste(canvas, bx[:2]); sh.save(sp)
    print(f'{name} 第 {idx} 格：缩放 {k:.3f} 偏移 {dx},{dy}')

TOUCH = {   # 单格返修的提示词：(表, 格) → 要改的地方
    ('combo', 6): 'the near fist in front of the chest must be a clean, clearly drawn clenched fist wrapped in cream cloth hand wraps, and its short flat pure green (#00FF00) stick sticks straight out of the knuckles pointing FORWARD (to the right), NOT lying across the chest; the far fist swung back for balance keeps its own green stick',
}
def touch_prompt(fix):
    return ('The FIRST image is one frame of a 2D game sprite of this chibi martial artist (the SECOND image shows his design). His fists hold short flat pure green sticks used as markers. '
            'Redraw the FIRST image exactly: the same pose, the same size and position in the frame, the same character, colors and art style with thick outlines, '
            f'and fix only this: {fix}. The feet and legs have NO green. Plain pure white background, no text, no effects.')

def frames(names, dry=False):
    """切帧：4×4 → 帧 + 双拳锚点 + 头部锚点 + 分割线。两遍：第一遍按每张表第 1 格（站姿参考）的高度定缩放；
    生图时第 1 格总比同表的动作格画得大一点（实测动作格的头只有站姿头的 0.86~0.96），第二遍按“这张表动作格的头 / idle 的头”的中位数把整张表的动作格放大回来，
    所有片段的头和 idle 一样大（idle 不动，HEIGHT 按 idle 和鬼剑士对过）。"""
    import frames as FR, frames2, avatar_frames as AF, avatar_head as AH, avatar_cuts as AC, avatar_sizecheck as SZ
    FR.HEIGHT['fighter'] = HEIGHT; AF.cut_boxes = cut16; AF.stick_groups = stick_groups; AC.FRAC.setdefault('fighter', (0.5, 0.86))
    fixes = json.load(open(AF.FIX)) if os.path.exists(AF.FIX) else {}
    pv = os.path.join(FS, 'cut'); os.makedirs(pv, exist_ok=True); os.makedirs(SPR, exist_ok=True)
    mp = os.path.join(SPR, 'spr.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {'res': RES, 'frames': {}}
    stats = {}; done = []
    def fin(name, fr, base, k, meta, only=None):
        sel = {f: F for f, F in fr.items() if only is None or f in only}
        cyc = {f: F for f, F in sel.items() if f.startswith(CYCLE)}; rest = {f: F for f, F in sel.items() if f not in cyc}
        if cyc: AF.finish('fighter', 'run', cyc, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}_cycle.png'), dry)
        if rest: AF.finish('fighter', name, rest, base, k, meta['res'], meta, SPR, os.path.join(pv, f'{name}.png'), dry)
    def heads():
        json.dump(meta, open(mp, 'w'), indent=1); m2, out, d = AH.heads_for_dir('fighter')
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
        fr, base, k, _ = AF.process_sheet('fighter', name, p, fn, meta['res'], fixes, None)
        cnt = fist_sticks(fr, name); print(f'  挖掉被围住的白底 {clean_frames(fr)} 块')
        fin(name, fr, base, k, meta)
        stats[name] = {'frames': len(fr), 'near': cnt['n'], 'far': cnt['f']}; done.append((name, fr, base, k))
    if dry: return stats
    meta['frames'] = dict(sorted(meta['frames'].items())); m2, out, d = heads()
    T, M = SZ.head_tpl(SZ.load(SPR, 'idle')); again = False
    for name, fr, base, k in done:   # 第二遍：动作格的头 / idle 的头
        sc = [SZ.head_scale(SZ.load(SPR, f), m2['frames'][f]['head'], T, M) for f in fr if f != 'idle' and m2['frames'][f].get('head')]
        sc = sorted(v for v, e in sc if e < SZ.ERR_MAX); med = sc[len(sc) // 2] if sc else 1.0; stats[name]['scale'] = med
        if abs(med - 1) > 0.03: fin(name, fr, base, k / med, meta, [f for f in fr if f != 'idle']); again = True
    print('每张表动作格的头 / idle 的头（第一遍）：' + '  '.join(f'{n} {stats[n]["scale"]:.2f}' for n, *_ in done))
    if again: meta['frames'] = dict(sorted(meta['frames'].items())); m2, out, d = heads()
    AH.preview(d, out, os.path.join(pv, 'head.png'))
    bad = [f for f, H in out.items() if H['q'] > AH.Q_MAX]
    print(f'头部锚点：{len(out) - len(bad)}/{len(out)}，没找到：{" ".join(bad) or "无"}')
    for name, fr, *_ in done: stats[name]['auto'] = hand_anchors(fr, name, m2)   # 要用到头部锚点（脸和绑带同色，头一圈不找拳头）
    json.dump(m2, open(mp, 'w'), indent=1); auto_preview(m2)
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
    rows = [[f for f, _, _ in v if f] for v in SHEETS.values()]   # 一张表一行；锚点：红 = wpn、蓝 = wpn2、品红 = 按绑带颜色补的（auto），绿圈 = 头部
    Z, cw, ch = 1, 190, 250
    M = Image.new('RGB', (cw * (1 + max(map(len, rows))), ch * len(rows)), (58, 62, 72)); d = ImageDraw.Draw(M)
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
                    gx, gy = ox - F['ax'] + w['gx'], oy - F['ay'] + w['gy']; col = (255, 0, 255) if w.get('auto') else col
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

def check():
    """切完帧后的体检，和三职业原装同一把尺子（结果写 art/work/fighter_samples/check.json）：
    ① 衣服闪烁：avatar_flicker 的离群分（walk / run / 全部帧，每帧衣服颜色直方图对中位数）；② 动作表逐格：avatar_sheetflicker（相邻格直方图差、亮度抖动）；
    ③ 画的大小：avatar_sizecheck 的头部比例（每帧的头是站姿帧的几倍，|比例 - 1| > 0.12 且匹配可信的列出来）；④ 锚点：头部 / 拳头 / 分割线"""
    import avatar_flicker as FL, avatar_sheetflicker as SF, avatar_frames as AF, avatar_sizecheck as SZ
    rep = {'flicker': {}, 'sheet': {}, 'scale': {}}
    for cls in ('sword', 'gun', 'mage', 'fighter'):
        meta = json.load(open(os.path.join(HERE, 'final', 'spr', cls, 'spr.json')))['frames']; FL.CLIPS['all'] = sorted(meta)
        o = FL.outliers(cls, 'all'); top = sorted(o.items(), key=lambda kv: -kv[1])[:3]
        rep['flicker'][cls] = {'walk': max(FL.outliers(cls, 'walk').values()), 'run': max(FL.outliers(cls, 'run').values()), 'all': top[0][1], 'top': top}
        d = os.path.join(HERE, 'final', 'spr', cls); T, M = SZ.head_tpl(SZ.load(d, 'idle')); sc = {}
        for f, F in meta.items():
            if F.get('head'): s_, e_ = SZ.head_scale(SZ.load(d, f), F['head'], T, M); sc[f] = (s_, e_)
        ok = {f: v[0] for f, v in sc.items() if v[1] < SZ.ERR_MAX}
        dev = sorted(abs(v - 1) for v in ok.values())
        rep['scale'][cls] = {'frames': len(sc), 'trusted': len(ok), 'median_dev': round(dev[len(dev) // 2], 3) if dev else None,
                             'over12': sorted((f, v) for f, v in ok.items() if abs(v - 1) > 0.12)}
    cb = AF.cut_boxes
    for p in [os.path.join(MAIN, 'src', 'avatar', 'sheets', f'sword_{n}.png') for n in ('walk', 'run', 'combo', 'jump')]:
        AF.cut_boxes = cb; rep['sheet']['sword_' + os.path.basename(p)[6:-4]] = [round(v, 3) for v in SF.score(p)]
    AF.cut_boxes = cut16
    for n in SHEETS:
        if os.path.exists(sheet_path(n)): rep['sheet']['fighter_' + n] = [round(v, 3) for v in SF.score(sheet_path(n))]
    AF.cut_boxes = cb
    meta = json.load(open(os.path.join(SPR, 'spr.json')))['frames']; want = [f for v in SHEETS.values() for f, _, _ in v if f]
    hands = {f: [k for k in ('wpn', 'wpn2') if k in F] for f, F in meta.items()}
    rep['anchors'] = {'frames': len(meta), 'missing_frames': [f for f in want if f not in meta], 'head': sum(1 for F in meta.values() if F.get('head')), 'cut': sum(1 for F in meta.values() if F.get('cut')),
                      'two_fists': sum(1 for v in hands.values() if len(v) == 2), 'one_fist': sum(1 for v in hands.values() if len(v) == 1), 'no_fist': [f for f, v in hands.items() if not v],
                      'auto': sum(1 for F in meta.values() for k in ('wpn', 'wpn2') if k in F and F[k].get('auto')),
                      'outside': [f for f, F in meta.items() for k in ('wpn', 'wpn2') if k in F and not (-10 <= F[k]['gx'] <= F['w'] + 10 and -10 <= F[k]['gy'] <= F['h'] + 10)]}
    os.makedirs(WORK, exist_ok=True); json.dump(rep, open(os.path.join(WORK, 'check.json'), 'w'), ensure_ascii=False, indent=1)
    for k, v in rep['flicker'].items(): print(f'闪烁 {k:8s} walk {v["walk"]:.3f}  run {v["run"]:.3f}  全部帧最大 {v["all"]:.3f} {v["top"]}')
    for k, v in rep['scale'].items(): print(f'比例 {k:8s} {v["trusted"]}/{v["frames"]} 帧可信，偏差中位 {v["median_dev"]}，>12%：{v["over12"]}')
    for k, v in rep['sheet'].items(): print(f'动作表 {k:22s} 直方图差 {v[0]:.3f} 亮度抖动 {v[1]:.2f}')
    print('锚点', {k: v for k, v in rep['anchors'].items()})

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
    elif a.cmd == 'touch':
        name, idx = a.names[0], int(a.names[1]); touch(name, idx, touch_prompt(TOUCH[(name, idx)]))
    elif a.cmd == 'check': check()
    elif a.cmd == 'class': class_art()
    elif a.cmd == 'review': review()
    else: raise SystemExit('cmd: guides | ref | design | sheets | frames | class | review')

if __name__ == '__main__':
    main()
