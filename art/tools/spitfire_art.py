#!/usr/bin/env python3
"""弹药专家组的美术：新动作表 / 技能图标 / 道具特效 / 觉醒插图 / 转职立绘（沿用 combatgen.py 的流水线，只替换表的内容，不修改 combatgen.py）。
原图写到主仓库 art/src/combat/，人物动作之后走外观流水线：avatar_gen.py wpn → avatar_gen.py set → avatar_frames.py（见 docs/ARCHITECTURE.md）。

  spitfire_art.py sheets [--only 前缀]       动作表 → <主仓库>/art/src/combat/sheets/gun_spitfire*.png
  spitfire_art.py icons  [--only 前缀]       图标表 → <主仓库>/art/src/combat/icons/sf_icons_*.png
  spitfire_art.py iconcut                    切图标 → art/final/icon/<技能 id>.webp
  spitfire_art.py fx     [--only 前缀]       发光特效（黑底）→ <主仓库>/art/src/combat/fx/<名字>.png
  spitfire_art.py props                      道具表（白底 4×3：地雷、C4、EMP 装置、各色手雷……）→ <主仓库>/art/src/combat/fx/sf_props.png
  spitfire_art.py fxprep                     发光特效 + 切道具表 → art/final/fx/<名字>.webp
  spitfire_art.py cutin / cutinprep          觉醒插图（一觉 / 二觉 / 三觉）→ art/final/cutin/spitfire{,2,3}.webp
  spitfire_art.py job / jobprep              转职立绘 → art/final/job/spitfire.webp
  spitfire_art.py avatar <avatar_gen 参数>    外观流水线（wpn / set，--only gun_spitfire）
  spitfire_art.py frames [--set 套装] 前缀    切帧（avatar_frames.py；本文件的帧名先登记进 frames2.NAMES）
生图约定：同时最多 1 个改图请求（全队约 9 个组共用），429 退避 65 秒；已存在的输出跳过。
道具（子弹、手雷、爆炸）一律是运行时特效，不画进人物帧；纯绿 #00FF00 / 品红 #FF00FF 是流水线标记色，道具上不能用。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 人物帧：只画人物，不画枪口火光 / 子弹 / 手雷 / 喷焰（全部是运行时特效）
NOFX = (' Draw ONLY the character: NO muzzle flash, NO bullets, NO grenades or bombs in the hands, NO jet flames, NO smoke, NO sparks, NO speed lines, NO effects'
        ' (all effects are added later in game). The outfit stays exactly the same as the reference: modest, fully covered.')
C.SHEETS = {
    # 推进器空中动作 / 空中投掷 / 放地雷 / 朝地面射击 / 交叉射击（基础的烟尘弹也用 sfAimDown）
    'gun_spitfire1': [(n, d) for n, d in [
        ('sfUp', 'jet-boosting straight UP in mid-air: airborne high above the ground, body upright, legs together and pointing down with knees slightly bent, the free arm raised, the revolver held down at her side, hair and coat streaming downward'),
        ('sfDash', 'dashing horizontally forward through the air: airborne, body leaning far forward almost horizontal, legs trailing straight behind, the revolver held forward in the leading hand, hair and coat streaming back'),
        ('sfDive', 'diving straight DOWN at high speed: airborne dropping feet first, knees bent, both arms raised up above the head, hair and coat blown upward, looking down'),
        ('sfAirThrow1', 'mid-air throw wind-up: airborne with knees tucked, the free hand pulled back behind the head in an EMPTY closed fist as if about to throw, the revolver held low in the other hand'),
        ('sfAirThrow2', 'mid-air throw release: airborne with knees tucked, the free arm swung forward and down with the hand OPEN and EMPTY, fingers spread, the revolver held back in the other hand'),
        ('sfPlant', 'crouched low on one knee, the free hand pressed flat on the ground in front of her (EMPTY hand, nothing under it), the revolver raised in the other hand, looking forward alertly'),
        ('sfAimDown', 'standing and leaning forward, aiming the revolver straight DOWN at the ground just in front of her feet with the arm fully extended, the free hand on the hip'),
        ('sfCross', 'firing stance with the arms crossed at the wrists in front of the chest: the revolver hand pointing forward and slightly up, the free hand crossed under it forming an X, feet planted wide, fierce expression')]],
    # 一觉 / 二觉 / 三觉：投 EMP、信号弹、悬停、轰炸、升空、俯冲射击、落地
    'gun_spitfire2': [(n, d) for n, d in [
        ('sfEmp1', 'both EMPTY hands raised high above the head, body arched back, about to hurl something big and heavy forward with both hands, NO gun in her hands'),
        ('sfEmp2', 'follow-through after hurling something heavy forward with both hands: both arms extended forward and down, hands OPEN and EMPTY, leaning forward, NO gun in her hands'),
        ('sfFlare', 'pointing the revolver straight UP at the sky with the arm fully raised, the free hand on the hip, looking up confidently'),
        ('sfHover', 'hovering calmly in mid-air high above the ground: legs slightly bent together, the revolver held ready in front aiming diagonally down, the free hand relaxed at her side'),
        ('sfBomb', 'mid-air bombing run: airborne, leaning forward and looking straight down, the free hand OPEN and EMPTY below the body as if just dropping something, the revolver held to the side'),
        ('sfSoar', 'soaring straight up into the sky at great speed: whole body stretched vertical, one knee raised, the free arm raised straight up, the revolver held down at her side, hair streaming down'),
        ('sfDashAtk', 'diving forward and down diagonally through the air at great speed while aiming the revolver forward with the arm fully extended, body stretched diagonally, legs trailing behind'),
        ('sfLand', 'heroic landing: crouched low on one knee with the free hand touching the ground, the revolver held out to the side, coat flaring out')]],
}
NO_WPN_SHEETS = set()
_sheet_jobs0 = C.sheet_jobs
def _sheet_jobs():
    L = _sheet_jobs0()
    for j in L: j['prompt'] += NOFX   # 只追加一次（每格都写会让提示词太长）
    return L
C.sheet_jobs = _sheet_jobs
# 技能图标：16 + 12 个（和现有图标同一画风：圆角方块、各自的彩色底、粗描边）
ICONS_A = [
    ('gs_nitro', 'a compact silver jetpack thruster with twin nozzles blasting bright blue flames downward'),
    ('gs_overcharge', 'a rifle cartridge glowing with swirling red fire, blue ice and yellow lightning energy'),
    ('gs_elem', 'three bullets in a fan: one flaming red, one frosty blue, one crackling yellow'),
    ('gs_booster', 'a bullet with a drill-shaped armor-piercing tip glowing orange'),
    ('gs_firearm', 'a crossed long rifle and a crossbow-style bowgun with a blueprint grid behind'),
    ('gs_gmastery', 'three hand grenades (green, yellow, blue) arranged in a triangle with a gold star'),
    ('gs_m18', 'a curved olive-green claymore mine on small legs with a fan-shaped red sensor beam'),
    ('gs_cross', 'two revolvers crossed in an X firing streaks of orange bullets in two directions'),
    ('gs_g35', 'a yellow grenade with a lightning bolt emblem crackling with electric sparks'),
    ('gs_pierce', 'a sleek blue bullet piercing through three stacked metal plates'),
    ('gs_burst', 'a bullet exploding into an orange fireball burst on impact'),
    ('gs_g18', 'a pale blue grenade with a snowflake emblem, frozen with ice crystals'),
    ('gs_buster', 'a tight stream of many bullets converging into one bright point, red energy'),
    ('gs_c4', 'a spinning flat disc with a C4 explosive brick and a blinking red light'),
    ('gs_napalm', 'a burning pool of sticky flames spreading on the ground from an explosion'),
    ('gs_lockon', 'a red laser crosshair target locked on a silhouette with a beam from the sky')]
ICONS_B = [
    ('gs_arsenal', 'a glowing blue electric current coiling around a bullet cartridge'),
    ('gs_emp', 'a cylindrical EMP machine releasing huge blue electromagnetic shockwave rings'),
    ('gs_g61', 'a purple grenade at the center of a swirling dark gravity vortex'),
    ('gs_chelli', 'a dark blue vacuum hole swallowing debris and small grenades'),
    ('gs_airmaster', 'a golden eagle-eye crosshair seen from high above the clouds'),
    ('gs_openfire', 'many different colored grenades raining down from the sky in an arc'),
    ('gs_photon', 'a cluster of glowing cyan photon orbs pulled toward a magnetic bullet in the ground'),
    ('gs_dday', 'a red signal flare with fighter jets and artillery shells streaking across a sunset sky'),
    ('gs_02x', 'an advanced glowing jetpack with mechanical wings and blue thrusters'),
    ('gs_standby', 'a hovering jetpack with a bombing crosshair below and grenades ready'),
    ('gs_final', 'a winged female silhouette diving from the sky trailing golden light over explosions'),
    ('gs_spare', 'a gold ammunition belt with bullets forming a circle')]
C.ICON_SHEETS = {'sf_icons_a': ICONS_A, 'sf_icons_b': ICONS_B}
T_, Wd, Sq = C.T, C.Wd, C.Sq
C.FX = {   # 发光类（黑底）：三觉飞翼
    'sf_wings': ('A pair of glowing mechanical energy wings seen from the side, spread wide to the LEFT and RIGHT from a small central jetpack core: '
                 'layered cyan and white light panels with golden edges, trailing light particles', Wd, True),
}
# 道具表（白底，4×3，12 个物件；fxprep 按连通块切开，名字按阅读顺序）
PROPS = [
    ('sf_m18', 'an M18 claymore mine: a curved olive-green rectangular box standing on two small scissor legs, side view'),
    ('sf_c4disc', 'a flat round throwing disc made of dark olive metal with a small C4 explosive block strapped on top, three-quarter view'),
    ('sf_c4', 'a small C4 explosive brick wrapped in tan tape with a tiny detonator and a red LED'),
    ('sf_emp', 'an EMP bomb device: a squat metal cylinder with glowing blue coils, a short antenna and small landing legs'),
    ('sf_g35', 'a hand grenade painted bright yellow with a black lightning bolt emblem'),
    ('sf_g18', 'a hand grenade painted pale icy blue with a white snowflake emblem'),
    ('sf_g61', 'a round purple grenade with a glowing violet ring around the middle'),
    ('sf_bomb', 'a small aerial bomb with tail fins pointing down, dark grey with a yellow stripe'),
    ('sf_parts', 'a cluster of overheated mechanical jetpack parts glowing orange hot'),
    ('sf_valk', 'a sleek small fighter jet drone seen from the side flying to the RIGHT, dark grey with gold trim and blue engine glow'),
    ('sf_flare', 'a red signal flare stick with a glowing red tip'),
    ('sf_beacon', 'a small laser beacon device with a red lens')]
SOLID_PROPS = {n: 72 for n, _ in PROPS} | {'sf_valk': 160, 'sf_emp': 110, 'sf_m18': 80, 'sf_parts': 96}
GLOW_FX = {'sf_wings': 320}
C.CUTIN = {
    'spitfire': ('gun', 'riding a blue jetpack thruster high in the sky, hurling a glowing EMP bomb device downward with one arm, electric blue shockwaves behind her, confident smile'),
    'spitfire2': ('gun', 'as Freyja the war goddess: firing a red signal flare into the sky with the revolver, fighter jets streaking past behind her, sunset battlefield glow, fierce expression'),
    'spitfire3': ('gun', 'wearing an advanced winged jetpack with glowing cyan mechanical wings, diving from the sky with the revolver aimed forward, golden light trails, determined expression'),
}
JOB_PROMPT = ('Using this exact chibi character (same face, same hair, same newsboy cap, same brown jacket and outfit, same cute art style with thick outlines), draw a full-body standing portrait for a class selection screen, '
              'facing slightly right in three-quarter view: she wears a compact silver jetpack thruster at her waist with small blue nozzles, a bandolier of colored hand grenades (yellow, blue, green) across her chest, '
              'holding a long rifle casually over her shoulder, a confident smile. Plain pure white background, no text, no effects.')

def props_prompt():
    return (f'A sprite sheet of {len(PROPS)} separate game prop objects arranged in a grid of 4 columns and {len(PROPS) // 4} rows on a plain pure white background, evenly spaced with generous white gaps, '
            f'no object touching another, {C.SOLID.split(". Plain")[0]}. In reading order (left to right, top to bottom): '
            + '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(PROPS)) + '. Avoid pure bright green and magenta colors. No text, no numbers, no labels.')

def props_cut():
    """道具表 → art/final/fx/<名字>.webp（白底抠图，按连通块和阅读顺序命名）"""
    import numpy as np
    from PIL import Image
    from prep import remove_bg, components
    p = os.path.join(C.OUT, 'fx', 'sf_props.png')
    if not os.path.exists(p): print('missing', p); return
    im = remove_bg(Image.open(p)); arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=300)
    boxes = []
    for n, _ in comps:
        ys, xs = np.where(lab == n); boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, n))
    boxes = [b for b in boxes if (b[1] - b[0]) > 40 and (b[3] - b[2]) > 40]
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2); rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    order = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    print('props found', len(order), 'expected', len(PROPS))
    out = os.path.join(C.HERE, 'final', 'fx')
    for b, (name, _) in zip(order, PROPS):
        y0, y1, x0, x1, n = b
        crop = arr[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(lab[y0:y1, x0:x1] == n, crop[..., 3], 0)
        ic = Image.fromarray(crop, 'RGBA'); m = SOLID_PROPS[name]; s = m / max(ic.size)
        ic = ic.resize((max(1, round(ic.width * s)), max(1, round(ic.height * s))), Image.LANCZOS)
        f = os.path.join(out, f'{name}.webp'); ic.save(f, 'WEBP', quality=82, method=6); print(f'{name:10s} {ic.size}')

def glow_prep():
    import fxprep
    from PIL import Image
    for n, m in GLOW_FX.items():
        p = os.path.join(C.OUT, 'fx', f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        im = fxprep.fit(fxprep.glow_to_rgba(Image.open(p)), m); f = os.path.join(C.HERE, 'final', 'fx', f'{n}.webp'); im.save(f, 'WEBP', quality=80, method=6); print(n, im.size)

def job_jobs():
    return [{'out': os.path.join(C.SRC, 'quests', 'job_spitfire.png'), 'ref': os.path.join(C.SRC, 'gun_ref.png'), 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst', 'prompt': JOB_PROMPT}]

from importlib import util as _u

def _job_prep():
    spec = _u.spec_from_file_location('job_art_mod', os.path.join(os.path.dirname(__file__), 'job_art.py'))
    src = open(spec.origin).read().split('os.makedirs(OUT, exist_ok=True)')[0]   # 只要函数定义，不跑它的批处理
    g = {}; exec(compile(src, spec.origin, 'exec'), g)
    from PIL import Image
    p = os.path.join(C.SRC, 'quests', 'job_spitfire.png')
    if not os.path.exists(p): print('missing', p); return
    im = g['cutout'](Image.open(p))
    if im.height > 900: im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
    out = os.path.join(C.HERE, 'final', 'job', 'spitfire.webp'); im.save(out, 'WEBP', quality=86, method=6); print('job/spitfire', im.size)

def frames(argv):
    import frames2, avatar_frames
    for k, v in C.SHEETS.items():
        c, sh = k.split('_', 1); frames2.NAMES.setdefault(c, {})[sh] = [n for n, _ in v]
    sys.argv = ['avatar_frames.py'] + argv
    avatar_frames.main()

def avatar(argv):
    import avatar_gen as G
    G.NO_WPN |= NO_WPN_SHEETS
    sys.argv = ['avatar_gen.py'] + argv
    G.main()

def run_jobs(L, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(C.run(j), flush=True)   # 串行：同时最多 1 个生图请求

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'frames': frames(a[1:])
    elif ph == 'avatar': avatar(a[1:])
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat'] + (['--only', 'sf_icons'] if not only else ['--only', only]); icons.main()
    elif ph == 'sheets': run_jobs(C.sheet_jobs(), only)
    elif ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x2048' if len(items) > 12 else '2048x1536'} for n, items in C.ICON_SHEETS.items()], only)
    elif ph == 'fx': run_jobs([{'out': os.path.join(C.OUT, 'fx', f'{n}.png'), 'prompt': f'{d}. {C.GLOW if g else C.SOLID}', 'size': sz} for n, (d, sz, g) in C.FX.items()], only)
    elif ph == 'props': run_jobs([{'out': os.path.join(C.OUT, 'fx', 'sf_props.png'), 'prompt': props_prompt(), 'size': '2048x1536'}])
    elif ph == 'fxprep': glow_prep(); props_cut()
    elif ph == 'cutin': run_jobs(C.cutin_jobs(), only)
    elif ph == 'cutinprep': C.cutin_prep()
    elif ph == 'job': run_jobs(job_jobs())
    elif ph == 'jobprep': _job_prep()
    else: print(__doc__)
