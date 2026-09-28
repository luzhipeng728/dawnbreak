#!/usr/bin/env python3
"""协战师（神枪手第 5 转职）美术：强袭战斗服整套动作帧、技能图标、特效、转职立绘、觉醒插图。
原图写到主仓库 art/src/paramedic/（不进 git），切好的素材输出到本仓库 art/final。
  paramedic_art.py ref                 战斗服参考立绘（原版女枪立绘 → 穿强袭战斗服）→ src/paramedic/pmsuit_ref.png
  paramedic_art.py sheets [--only 表]  动作表（3×3：第 1 格站姿参考 + 8 帧）→ src/paramedic/sheets/pmsuit_<表>.png
  paramedic_art.py cut [--only 表]     切帧（frames2 的对齐规则：脚底锚点、按站姿统一比例）→ art/final/spr/pmsuit/
  paramedic_art.py icons | fx | job | cutin   图标表 / 特效 / 转职立绘 / 觉醒插图
  paramedic_art.py prep                图标、特效、立绘、插图切图 → art/final/{icon,fx,job,cutin}
战斗服是变身：地下城里整套换成战斗服帧集（不显示时装），所以只有一套，不乘 7 套时装；武器（手枪 / 能量刃）画在帧里，没有占位棍 / 武器轨迹。
生图：全队共用接口，本组同时只发 1 个请求；429 退避 65 秒。避开纯绿 / 品红（流水线用作标记色）。
"""
import os, sys, json, time, argparse
sys.path.insert(0, os.path.dirname(__file__))
import sheets as SH
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SRC = os.path.join(MAIN, 'src')
OUT = os.path.join(SRC, 'paramedic')
REF = os.path.join(OUT, 'pmsuit_ref.png')
SH.CACHE = os.path.join(OUT, '.upload_cache.json')
gi = SH.gi
MODEL = 'gpt-image-2.5-sunburst'

SUIT = ('a sleek high-tech ASSAULT BATTLE SUIT: a form-fitting dark navy bodysuit that covers her whole body from the neck down to the wrists and ankles (modest, no bare skin except the face), '
        'smooth glossy white armor plates on the chest, the shoulders, the forearms, the hips and the shins, thin glowing sky-blue light lines along the edges of the plates, '
        'a compact white thruster backpack with two short fins and small sky-blue vents, armored white knee-high boots with dark navy soles, dark navy gloves, '
        'a white tactical headset over the ears with a small transparent sky-blue visor pushed up on the forehead (NO hat, NO cap), '
        'on the forearm of her back arm a white armored gauntlet with a folded sky-blue energy blade lying flat along the outside of the forearm, '
        'and in her front hand a compact white-and-navy sci-fi pistol with a sky-blue light strip')
HOLD = 'wearing the assault battle suit and holding the compact sci-fi pistol'
BLADE = 'the sky-blue energy blade extended forward out of the forearm gauntlet'

def ref_prompt():
    return ('Redraw this exact chibi character: the SAME face, the same big blue eyes, the same brown hair and long brown ponytail, the same body proportions and the same height, '
            'the same pose (standing in side view facing RIGHT) and the same cute hand-painted art style with thick outlines. '
            f'Change ONLY the outfit and the weapon: she now wears {SUIT}. '
            'Keep the design clean and readable at a small sprite size: big simple shapes, no tiny details, no text, no logos, no emblems with crosses. '
            'Colors: white, dark navy and sky-blue glow only (no green, no magenta, no pink). Plain pure white background, full body visible, nothing else.')

# 表名 → [(帧名, 描述)]；walk / run 用姿势参考图（帧名固定：idle + walk1..8 / run1..8），jump 的帧名 jump1..5 + jatk1..3
SHEETS = {
    'walk': None, 'run': None,
    'jump': [('jump1', 'jump take-off: crouched low with bent knees ready to spring up'), ('jump2', 'jumping up: body stretched rising into the air, legs trailing below'),
             ('jump3', 'jump apex: floating at the top with knees tucked up'), ('jump4', 'falling: legs reaching down, arms up for balance'),
             ('jump5', 'landing: knees bent absorbing the impact, slightly crouched'),
             ('jatk1', f'mid-air slash wind-up: airborne, {BLADE}, blade arm raised high behind the head'),
             ('jatk2', f'mid-air slash: airborne, {BLADE}, slashing diagonally downward in front of her'),
             ('jatk3', f'mid-air slash follow-through: airborne with knees tucked, {BLADE} pointing low in front')],
    'combo': [('a1_1', f'close-quarters slash wind-up: {BLADE}, the blade arm drawn back across the chest, body low and coiled, pistol held back at the hip'),
              ('a1_2', f'horizontal slash: {BLADE}, the blade swept forward horizontally at chest height, body twisted forward'),
              ('a2_1', f'second slash wind-up: {BLADE}, the blade arm held low behind the hip, weight on the back foot'),
              ('a2_2', f'rising slash: {BLADE}, the blade swung upward in a rising arc above the head, rising onto the toes'),
              ('a3_1', 'spinning kick wind-up: body turning away so the back faces the viewer, one knee raised, arms tucked in'),
              ('a3_2', 'spinning back kick: one armored leg extended straight forward at waist height, body leaning back, arms out for balance'),
              ('a4_1', 'point-blank shot: stepping in and thrusting the sci-fi pistol forward at full arm length, aiming straight ahead at close range'),
              ('a4_2', 'firing the pistol point-blank: the arm kicked upward by a strong recoil, body leaning back slightly')],
    'react': [('hit1', 'hurt: flinching backward, eyes shut in pain'), ('hit2', 'hurt harder: knocked back with the upper body bent backward'),
              ('air', 'knocked into the air: body horizontal tumbling backward mid-air, arms and legs flailing'), ('down', 'lying knocked down flat on the back on the ground'),
              ('getup', 'getting up from the ground: on one knee pushing up with a hand'), ('roll', 'dodge roll: curled up into a tight ball rolling forward'),
              ('dash1', f'dash attack start: lunging forward very low, {BLADE}, blade held forward'), ('dash2', f'dash attack: long sliding lunge on the ground, {BLADE}, blade thrust straight forward')],
    'react2': [('hit3', 'hit hard: knocked backward off balance, body bent far back, head thrown back, one foot lifted off the ground'),
               ('airUp', 'launched up into the air by a hit: body arched backward and rising, arms and legs flung out, clearly airborne high above the ground'),
               ('tumble', 'tumbling helplessly in mid-air upside down in an uncontrolled backward flip, head pointing down, airborne'),
               ('bounce', 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air'),
               ('held', 'lifted off the ground by an invisible force as if grabbed by the collar: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person, NO hand holding her'),
               ('tech', 'quick recovery: crouched low on one knee, pistol ready, about to spring up'),
               ('charge', 'bracing in a low wide stance with the gauntlet arm raised in front, charging power'),
               ('shoot1', 'aiming the sci-fi pistol straight forward with the arm fully extended, the other arm tucked, feet apart')],
    # 协战师能学的 5 个基础技能（后撩踢 / 浮空弹 / 钉刺射 / 刺踢 / 上旋踢）在战斗服里的姿势
    'base': [('kick1', 'chambering a kick: one armored knee raised high in front, arms up for balance'),
             ('kick2', 'rising high kick: one armored leg kicking straight up above the head, body leaning back'),
             ('slide1', 'dropping low into a slide, one leg forward'), ('slide2', 'sliding feet-first along the ground in a low slide kick, the front leg extended'),
             ('stomp1', 'standing over a fallen enemy position with one boot stamped down in front, aiming the pistol straight down at the ground in front of her feet'),
             ('stomp2', 'firing the pistol straight down at the ground in front of her feet, recoil, the stamping boot still planted'),
             ('flash', 'lightning-fast straight thrust kick: one armored leg thrust straight forward at chest height, body leaning back, arms back'),
             ('sk1', 'spinning kick in mid-turn: body spinning with one leg swung out to the side at waist height, arms tucked')],
    'skillA': [('shoot2', 'firing the sci-fi pistol straight forward, the arm kicked up a little by the recoil, a small sky-blue muzzle flash at the barrel'),
               ('slideShot', 'sliding forward low along the ground on one knee and one foot while aiming the pistol straight forward'),
               ('dashKick', 'dashing forward low and fast, body leaning far forward, the backpack thrusters firing short sky-blue jets behind her'),
               ('backKick', 'powerful spinning back kick in the air: one armored leg swung around at head height, body turned, hair whipping around'),
               ('bladeBack', f'hopping backward off the ground while slashing: {BLADE}, slashing forward in a wide arc as she jumps back'),
               ('raid1', f'lunging deep forward: {BLADE}, the blade thrust straight forward at full extension, front knee deeply bent'),
               ('raid2', f'fast flurry: {BLADE}, the blade raised high then slashing down, torso twisted, strong forward lean'),
               ('shieldBash', 'charging forward shoulder-first with the armored gauntlet raised in front of her body as if bracing behind a shield, head down, running')],
    'skillB': [('cannon1', 'the gauntlet of her back arm transformed into a chunky white arm cannon with a sky-blue core, aimed straight forward, bracing it with the other hand, wide stance'),
               ('cannon2', 'firing the white arm cannon straight forward, leaning into the heavy recoil, feet planted wide, hair blown back'),
               ('command', 'raising one arm high and pointing up to the sky, calling in air support, a confident look, the other hand on the hip'),
               ('backflip', 'doing a backflip in mid-air: body upside down, knees tucked, arms out'),
               ('swing', 'swinging a huge white-and-navy mechanical greatsword with a sky-blue edge horizontally with both hands, the blade sweeping in front of her'),
               ('deploy', 'kneeling on one knee and placing a small white device on the ground in front of her with one hand'),
               ('fieldCast', 'standing firm with both arms spread wide and palms open, chin up, as if projecting a protective field around herself'),
               ('overlimit', f'rushing forward extremely fast, body almost horizontal, {BLADE}, the blade trailing low behind her')],
    'skillC': [('awk2a', 'holding a huge white rail cannon at the hip with both hands and firing it forward, strong recoil, feet sliding back'),
               ('awk2b', 'leaping forward and bringing the huge white-and-navy mechanical greatsword down overhead with both hands in a finishing smash'),
               ('dive', 'diving down from the sky feet-first: body straight and vertical, arms at the sides, hair streaming upward'),
               ('landing', 'landing from a great height: crouched low with one knee and one fist on the ground, head up'),
               ('guard', 'crouching low with both forearms crossed in front of the face, bracing, eyes closed'),
               ('salute', 'standing straight and giving a crisp military salute with the right hand, a small confident smile'),
               ('aimUp', 'aiming the sci-fi pistol diagonally upward with the arm extended'),
               ('victory', 'victory pose: pistol raised beside the face, a wink, the other hand on the hip')],
}
# 帧名表（给 frames2：idle / walk / run / jump 的帧名由 frames2 自己定）
NAMES = {k: [n for n, _ in v] for k, v in SHEETS.items() if v and k != 'jump'}

def sheet_out(name): return os.path.join(OUT, 'sheets', f'pmsuit_{name}.png')

def post(prompt, refs, out, size):
    """发一个生图请求（同时只 1 个；429 退避 65 秒）"""
    base, key, _ = gi.load_cfg()
    urls = [SH.upload(base, key, p) for p in refs]
    payload = {'model': MODEL, 'prompt': prompt, 'n': 1, 'size': size, 'quality': 'high', 'response_format': 'b64_json'}
    if urls: payload['image'] = urls
    os.makedirs(os.path.dirname(out), exist_ok=True)
    t = time.time(); err = ''
    for i in range(5):
        try:
            resp = gi.post_json(f'{base}/images/generations', key, payload, 900); gi.save_images(resp, out, False, False)
            print(f'ok   {os.path.relpath(out, OUT)}  {time.time() - t:.0f}s', flush=True); return True
        except (SystemExit, OSError) as e:
            err = str(e); print(f'  retry {i + 1}: {err[:160]}', flush=True)
            if 'HTTP 400' in err: break
            time.sleep(65 if '429' in err else 12)
    print(f'FAIL {os.path.relpath(out, OUT)}: {err[:200]}', flush=True); return False

def cmd_ref(a):
    if os.path.exists(REF) and not a.force: print('skip ref'); return
    post(ref_prompt(), [os.path.join(SRC, 'gun_ref.png')], REF, '1024x1536')

def cmd_sheets(a):
    from sheets2 import prompt as sheet_prompt, guide_prompt, RUN
    for name, frames in SHEETS.items():
        if a.only and name not in a.only.split(','): continue
        out = sheet_out(name)
        if os.path.exists(out) and not a.force: print('skip', name); continue
        # 跑步：带姿势参考图时模型把人偶的红蓝色画到了身上、背景变黑，改成只用文字逐帧描述
        if name == 'run': frames = [(f'run{i + 1}', d + ', running fast with a strong forward lean, arms pumping') for i, d in enumerate(RUN)]
        if frames is None:   # 走 / 跑：加姿势参考图，保证手脚反向摆动
            post(guide_prompt(name, HOLD), [REF, os.path.join(SRC, f'guide_{name}.png')], out, '2048x2048')
        else:
            post(sheet_prompt([d for _, d in frames], HOLD), [REF], out, '2048x2048')

def cmd_cut(a):
    """切帧：沿用 frames2 的切法（按站姿统一比例、脚底锚点）；--keep 追加到现有 spr.json"""
    import frames2
    frames2.HEIGHT['pmsuit'] = 100   # 站姿参考格 → 200 像素高，和原版女枪 idle 帧（200）一样高
    frames2.NAMES['pmsuit'] = NAMES
    src = os.path.join(OUT, 'sheets_cut'); os.makedirs(src, exist_ok=True)
    for f in os.listdir(src): os.remove(os.path.join(src, f))
    for name in SHEETS:
        if a.only and name not in a.only.split(','): continue
        p = sheet_out(name)
        if os.path.exists(p): os.symlink(p, os.path.join(src, f'pmsuit_{name}.png'))
    sys.argv = ['frames2.py', '--src', src] + (['--keep'] if a.keep else []) + ['pmsuit']
    frames2.main()

# ---- 技能图标（3 张表 × 4 列；画风同战斗组 ICON_STYLE，配色白 / 藏青 / 天蓝，BUFF 类用暖色区分）----
ICONS = {
    'pm_icons_a': [('pm_suit', 'a sleek white-and-navy armored battle suit chest plate with glowing sky-blue light lines'),
                   ('pm_lockshot', 'a compact white sci-fi pistol firing two quick sky-blue shots at a red target lock reticle'),
                   ('pm_sync', 'two white tactical headsets linked by a glowing sky-blue data wave'),
                   ('pm_info', 'a small white hovering scout drone projecting a sky-blue holographic hexagon data screen'),
                   ('pm_mobility', 'a pair of white armored boots with sky-blue speed streaks and a small up arrow'),
                   ('pm_assault', 'a figure sliding low on one knee firing a white pistol, a red hexagon shield glowing behind'),
                   ('pm_purge', 'a teal-white medical capsule module dissolving purple poison bubbles'),
                   ('pm_strike', 'an armored white boot doing a spinning back kick with a sky-blue thruster flame'),
                   ('pm_evade', 'a sky-blue energy blade slash arc with a figure hopping backward and two bullet streaks'),
                   ('pm_armor', 'a white-and-navy armor shoulder plate with a bright blue shield emblem glowing'),
                   ('pm_arms', 'a white sci-fi pistol and an energy blade crossed, glowing golden power aura'),
                   ('pm_mark', 'a red crosshair locked on a target with six bullet marks around it')],
    'pm_icons_b': [('pm_raid', 'a long sky-blue energy blade stretching forward in a flurry of slashes'),
                   ('pm_buffer', 'a translucent sky-blue hexagon-pattern shield bubble'),
                   ('pm_armsx', 'a white sci-fi pistol overcharged with orange-gold lightning, a plus sign'),
                   ('pm_bash', 'a large translucent sky-blue hexagonal energy shield ramming forward with motion lines'),
                   ('pm_ray', 'a white arm cannon firing a thick sky-blue laser beam with explosions on the ground'),
                   ('pm_tactic', 'a holographic tactical map with glowing sky-blue unit markers and arrows'),
                   ('pm_awk1', 'a large white flying medical support platform in the sky firing many sky-blue laser beams down'),
                   ('pm_revive', 'a golden defibrillator paddle pair crackling with yellow electricity and a heartbeat line'),
                   ('pm_field', 'a white drone projecting a big dome-shaped sky-blue force field'),
                   ('pm_annihilate', 'six small white drones in a row firing lasers downward, a big mechanical greatsword'),
                   ('pm_limit', 'a white battle suit core glowing violet with a broken limiter chain'),
                   ('pm_overlimit', 'a blurred sky-blue afterimage dash with several slash marks')],
    'pm_icons_c': [('pm_overload', 'a white remote weapon turret charging a huge red-orange energy blast'),
                   ('pm_awk2', 'an array of white suit weapons (arm cannon, energy blades, drones, mechanical greatsword) all attacking at once, violet glow'),
                   ('pm_suit2', 'a black-and-gold battle suit chest plate next to a white-and-blue one, two-way arrows'),
                   ('pm_program', 'a glowing sky-blue code program window with a lightning bolt'),
                   ('pm_breakout', 'a golden medical support platform raining yellow energy strikes around a kneeling figure'),
                   ('pm_awk3', 'a figure diving from a golden sky platform with golden lasers and a huge chain explosion below')],
}
# ---- 特效（发光类黑底 → 运行时叠加；实体类白底 → 抠图）：名字 → (描述, 尺寸, 发光?, 最长边像素) ----
FX = {
    'pm_laser': ('A single vertical beam of light shooting straight DOWN from the top edge to the bottom edge: a bright white core with sky-blue glow edges, a small burst where it hits the ground, tall narrow composition', '1024x1536', True, 512),
    'pm_bubble': ('A single translucent protective energy bubble: an upright oval dome made of faint sky-blue hexagon cells with a bright rim, mostly transparent in the middle', '1024x1024', True, 256),
    'pm_hexshield': ('A single tall curved energy shield wall seen from the side: glowing sky-blue hexagon cells forming a tall narrow convex barrier, bright edges', '1024x1536', True, 256),
    'pm_field': ('A single circular force field seen from directly above: a ring of glowing sky-blue hexagon cells with a bright rim and faint inner glow', '1024x1024', True, 384),
    'pm_drone': ('A single small cute white scout drone seen from the side facing RIGHT: a rounded white shell with navy parts, a glowing sky-blue lens eye, two tiny rotor pods', '1024x1024', False, 96),
    'pm_minidrone': ('A single tiny cute white attack drone seen from the side facing RIGHT: a small flat white body with a sky-blue light strip and a small laser emitter underneath', '1024x1024', False, 64),
    'pm_medic': ('A single large white flying medical support platform seen from the side: a wide rounded white hull with navy panels, sky-blue glowing thrusters underneath and a big lens in the middle', '1536x1024', False, 320),
    'pm_remote': ('A single compact white remote weapon turret on small legs seen from the side facing RIGHT: a chunky white box body with navy panels and a wide barrel with an orange glowing core', '1024x1024', False, 128),
}
JOB = ('Using this exact chibi character in her assault battle suit (same face, hair, suit design, colors and art style), draw a full-body standing portrait for a class selection screen: '
       'confident heroic pose facing slightly to the right, the compact sci-fi pistol held up beside her face, the energy blade extended from the gauntlet pointing down, '
       'a small white scout drone hovering near her shoulder. Plain pure white background, no text.')
CUTIN = {   # 觉醒插图（HUD cut-in）：paramedic = 一觉、paramedic2 = 二觉、paramedic3 = 三觉
    'paramedic': 'pointing up to the sky calling in air support, a large white flying medical support platform above firing sky-blue lasers, confident look',
    'paramedic2': 'surrounded by all her suit weapons (a white arm cannon, sky-blue energy blades, small drones and a huge white mechanical greatsword) unleashing them at once, fierce look, violet glow',
    'paramedic3': 'diving down from a golden flying platform high in the sky, hair streaming upward, golden light beams around her, determined look',
}

def cmd_icons(a):
    from combatgen import icon_prompt
    for n, items in ICONS.items():
        if a.only and n not in a.only.split(','): continue
        out = os.path.join(OUT, 'icons', f'{n}.png')
        if os.path.exists(out) and not a.force: print('skip', n); continue
        post(icon_prompt([d for _, d in items]), [], out, '2048x2048' if len(items) > 8 else '2048x1152')

def cmd_fx(a):
    from combatgen import GLOW, SOLID
    for n, (d, size, glow, _) in FX.items():
        if a.only and n not in a.only.split(','): continue
        out = os.path.join(OUT, 'fx', f'{n}.png')
        if os.path.exists(out) and not a.force: print('skip', n); continue
        post(f'{d}. {GLOW if glow else SOLID}', [], out, size)

def cmd_job(a):
    out = os.path.join(OUT, 'job_paramedic.png')
    if os.path.exists(out) and not a.force: print('skip job'); return
    post(JOB, [REF], out, '1024x1536')

def cmd_cutin(a):
    for k, d in CUTIN.items():
        if a.only and k not in a.only.split(','): continue
        out = os.path.join(OUT, 'cutin', f'{k}.png')
        if os.path.exists(out) and not a.force: print('skip', k); continue
        post(f'Using this exact chibi character (same face, hair, assault battle suit design, colors and cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Plain pure white background, no text.',
             [REF], out, '1536x1024')

def cmd_prep(a):
    """图标切块 → art/final/icon/<技能id>.webp；特效 → art/final/fx；立绘 → art/final/job/paramedic.webp；插图 → art/final/cutin"""
    import numpy as np
    from PIL import Image
    from prep import remove_bg, components
    from fxprep import glow_to_rgba, fit
    fin = os.path.join(HERE, 'final')
    for n, items in ICONS.items():
        p = os.path.join(OUT, 'icons', f'{n}.png')
        if not os.path.exists(p): continue
        arr = np.array(remove_bg(Image.open(p))); lab, comps = components(arr[..., 3], min_cells=200)
        boxes = []
        for c, _ in comps:
            ys, xs = np.where(lab == c)
            if ys.max() - ys.min() > 80 and xs.max() - xs.min() > 80: boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, c))
        boxes.sort(key=lambda b: (b[0] + b[1]) / 2); rows, cur = [], []
        for b in boxes:
            if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
            cur.append(b)
        if cur: rows.append(cur)
        order = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
        print(n, 'found', len(order), 'expected', len(items))
        for (y0, y1, x0, x1, c), (name, _) in zip(order, items):
            crop = arr[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(lab[y0:y1, x0:x1] == c, crop[..., 3], 0)
            ic = Image.fromarray(crop, 'RGBA'); s = max(ic.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(ic, ((s - ic.width) // 2, (s - ic.height) // 2))
            sq.resize((104, 104), Image.LANCZOS).save(os.path.join(fin, 'icon', f'{name}.webp'), 'WEBP', quality=84, method=6)
    for n, (_, _, glow, m) in FX.items():
        p = os.path.join(OUT, 'fx', f'{n}.png')
        if not os.path.exists(p): continue
        im = glow_to_rgba(Image.open(p)) if glow else remove_bg(Image.open(p))
        fit(im, m).save(os.path.join(fin, 'fx', f'{n}.webp'), 'WEBP', quality=80, method=6); print('fx', n)
    p = os.path.join(OUT, 'job_paramedic.png')
    if os.path.exists(p):
        im = remove_bg(Image.open(p)); bb = im.getchannel('A').getbbox(); im = im.crop(bb); k = 720 / im.height
        os.makedirs(os.path.join(fin, 'job'), exist_ok=True); im.resize((round(im.width * k), 720), Image.LANCZOS).save(os.path.join(fin, 'job', 'paramedic.webp'), 'WEBP', quality=82, method=6); print('job')
    for k in CUTIN:
        p = os.path.join(OUT, 'cutin', f'{k}.png')
        if os.path.exists(p): remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS).save(os.path.join(fin, 'cutin', f'{k}.webp'), 'WEBP', quality=82, method=6); print('cutin', k)

def cmd_contact(a):
    """验收用总览图（一张）：战斗服全部帧（脚底对齐、旁边放原版女枪 idle 比身高）+ 图标 + 特效 + 立绘 + 插图 → src/paramedic/contact.png"""
    from PIL import Image, ImageDraw
    fin = os.path.join(HERE, 'final'); meta = json.load(open(os.path.join(fin, 'spr', 'pmsuit', 'spr.json')))['frames']
    cw, ch, cols = 150, 150, 12
    names = sorted(meta); gun = Image.open(os.path.join(fin, 'spr', 'gun', 'idle.webp')).convert('RGBA')
    items = [('gun idle', gun, 1.0)] + [(n, Image.open(os.path.join(fin, 'spr', 'pmsuit', f'{n}.webp')).convert('RGBA'), 1.0) for n in names]
    extra = [(f'icon {n}', Image.open(os.path.join(fin, 'icon', f'{n}.webp')).convert('RGBA')) for sh in ICONS.values() for n, _ in sh if os.path.exists(os.path.join(fin, 'icon', f'{n}.webp'))]
    extra += [(f'fx {n}', Image.open(os.path.join(fin, 'fx', f'{n}.webp')).convert('RGBA')) for n in FX if os.path.exists(os.path.join(fin, 'fx', f'{n}.webp'))]
    rows = (len(items) + cols - 1) // cols; rows2 = (len(extra) + cols - 1) // cols
    big = [p for p in [os.path.join(fin, 'job', 'paramedic.webp')] + [os.path.join(fin, 'cutin', f'{k}.webp') for k in CUTIN] if os.path.exists(p)]
    W = cols * cw; H = rows * ch + rows2 * 120 + (260 if big else 0) + 20
    sheet = Image.new('RGB', (W, H), (70, 74, 84)); d = ImageDraw.Draw(sheet)
    for i, (n, im, _) in enumerate(items):
        x, y = (i % cols) * cw, (i // cols) * ch; F = meta.get(n, {'ax': im.width / 2, 'ay': im.height}) if n != 'gun idle' else {'ax': im.width / 2, 'ay': im.height}
        k = min(1, (ch - 26) / im.height, (cw - 8) / im.width) * 0.62; sm = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))))
        sheet.paste(sm, (round(x + cw / 2 - F['ax'] * k), round(y + ch - 14 - F['ay'] * k)), sm); d.line([(x + 4, y + ch - 14), (x + cw - 4, y + ch - 14)], fill=(120, 124, 134)); d.text((x + 4, y + 2), n, fill=(255, 230, 120))
    y0 = rows * ch
    for i, (n, im) in enumerate(extra):
        x, y = (i % cols) * cw, y0 + (i // cols) * 120; k = min(96 / im.width, 96 / im.height); sm = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))))
        bg = Image.new('RGB', (cw - 6, 104), (10, 10, 14) if n.startswith('fx') else (70, 74, 84)); sheet.paste(bg, (x + 3, y + 14)); sheet.paste(sm, (x + (cw - sm.width) // 2, y + 18), sm); d.text((x + 4, y + 2), n[:22], fill=(160, 230, 255))
    x = 0
    for p in big:
        im = Image.open(p).convert('RGBA'); k = 250 / im.height; sm = im.resize((round(im.width * k), 250)); sheet.paste(sm, (x, H - 256), sm); x += sm.width + 10
    out = os.path.join(OUT, 'contact.png'); sheet.save(out); print(out, sheet.size)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); ap.add_argument('--keep', action='store_true')
    a = ap.parse_args()
    {'ref': cmd_ref, 'sheets': cmd_sheets, 'cut': cmd_cut, 'icons': cmd_icons, 'fx': cmd_fx, 'job': cmd_job, 'cutin': cmd_cutin, 'prep': cmd_prep, 'contact': cmd_contact}[a.cmd](a)

if __name__ == '__main__':
    main()
