#!/usr/bin/env python3
"""散打（男格斗家转职 striker，B5）美术：技能图标（fs_*）、觉醒插图（cutin/striker{,2,3}）、转职立绘（job/striker）。
沿用 combatgen.py 的生图 / 切图流水线（只替换表的内容，不修改 combatgen.py）；原图写到主仓库 art/src/combat/。
  striker_art.py icons [--only 表名前缀]   图标表（fs_icons_a 16 个 / fs_icons_b 12 个）→ <主仓库>/art/src/combat/icons/fs_icons_*.png
  striker_art.py iconcut [--only 表名]     切图标 → art/final/icon/<技能 id>.webp
  striker_art.py cutin [--only 名字]       觉醒插图（一觉 / 二觉 / 三觉）→ <主仓库>/art/src/combat/cutin/striker*.png
  striker_art.py cutinprep                 → art/final/cutin/striker{,2,3}.webp
  striker_art.py job / jobprep             转职立绘 → art/final/job/striker.webp
人物参考：格斗家原装立绘 art/src/fighter_ref.png（B1）在的时候用它当人物参考；还没有时用鬼剑士的觉醒插图当“画风参考”，人物按文字描述画（和矢量占位模型的配色一致）。
生图约定：同时最多 1 个请求（全队共用接口），429 退避 65 秒；已存在的输出跳过。纯绿 #00FF00 / 品红 #FF00FF 是流水线标记色，不能用。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 散打的人物设定（和 content/classes/fighter.js 的 PAL_FIGHTER 配色一致：米白练功服 + 红色镶边 / 腰带 / 头巾 / 拳套、深藏青裤子、棕色短靴）
LOOK = ('a young male martial artist (striker) in cute chibi anime style: short spiky dark brown hair, a red headband with two long tails fluttering behind, '
        'a cream-white sleeveless martial-arts gi top with red trim and a red sash belt, dark navy baggy pants tucked into short brown boots, '
        'bright red boxing gloves with white cuffs, confident fierce expression, athletic build')
FIGHTER_REF = os.path.join(C.SRC, 'fighter_ref.png')
STYLE_REF = os.path.join(C.OUT, 'cutin', 'blade.png')

ICONS_A = [
    ('fs_glove', 'a pair of bright red leather boxing gloves with white cuffs crossed over each other, a small gold star behind'),
    ('fs_light', 'a light martial-arts armor vest: a cream-white gi top with red trim and a red sash, a small white feather beside it'),
    ('fs_power', 'a clenched fist glowing crimson red with bulging power veins and a red energy aura'),
    ('fs_elbow', 'a bent elbow strike thrusting forward like a lightning bolt, sharp yellow lightning streaks trailing behind'),
    ('fs_sa', 'a muscular golden torso silhouette standing firm inside a glowing golden shield aura, unbreakable'),
    ('fs_pusher', 'a shoulder charge silhouette slamming forward with a big dust shockwave in front'),
    ('fs_bone', 'a low kick smashing into a shin with white crack lines bursting from the impact'),
    ('fs_raid', 'a fist diving diagonally down from the sky like a meteor, trailing orange light, a small explosion on the ground'),
    ('fs_aim', 'a red crosshair locking onto the weak point of a silhouette, a sharp glowing eye above it'),
    ('fs_shift', 'a flexed arm muscle surrounded by swirling cyan motion arrows, fluid and flexible'),
    ('fs_step', 'two blurred afterimage footprints with fast white speed lines, a quick step'),
    ('fs_rush', 'an elbow strike followed by a middle kick shown as two orange impact bursts side by side'),
    ('fs_close', 'a point-blank knee kick with a huge round shockwave ring bursting out behind the target'),
    ('fs_flamekick', 'a spinning tornado kick wrapped in a spiral of orange fire'),
    ('fs_dance', 'a zig-zag lightning path connecting several small kicking silhouettes, electric yellow'),
    ('fs_dragon', 'a powerful horizontal flying side kick piercing through a target, a long white-hot streak of light'),
]
ICONS_B = [
    ('fs_burn', 'a single leg wrapped in steady orange flames with a hot blue core, glowing embers'),
    ('fs_awaken', 'two feet wrapped in roaring infernal fire above an exploding ring of flames'),
    ('fs_dual', 'two twin fireballs orbiting each other and bursting open, double flame power'),
    ('fs_whirl', 'a swallow-shaped whirlwind kick sweeping in a wide arc, blue-white wind gathering inward'),
    ('fs_spin', 'a spinning somersault kick drawing a huge circular slash arc of light'),
    ('fs_fire', 'a blazing fighter silhouette releasing fire energy from the whole body, flames radiating outward'),
    ('fs_descent', 'a heel drop kick crashing straight down from above into a fiery explosion on the ground'),
    ('fs_cannon', 'a giant glowing fist punch fired like a cannon blast with concentric shockwave rings'),
    ('fs_awaken2', 'a golden flying kick surrounded by a roaring golden aura and rushing speed lines, emperor power'),
    ('fs_limit', 'a fist breaking through shattered iron chains with a fiery golden aura'),
    ('fs_mortal', 'a kick falling from the sky onto a red target marker, a crater and shockwave below'),
    ('fs_awaken3', 'a blazing fist punching into a burning sun, crimson and gold flames exploding'),
]
C.ICON_SHEETS = {'fs_icons_a': ICONS_A, 'fs_icons_b': ICONS_B}

CUTIN = {
    'striker': 'shouting with fists raised in a fighting stance while both of his legs burst into roaring infernal flames, fire swirling around his feet, embers flying',
    'striker2': 'mid-air in a powerful flying side kick toward the viewer, a golden aura and speed lines behind him, fierce shout',
    'striker3': 'throwing a blazing full-power punch straight forward, his red boxing glove engulfed in crimson and gold fire, a burning sun behind him, determined expression',
}
JOB_PROMPT = (f'Draw a full-body standing portrait for a class selection screen of {LOOK}, cute chibi proportions like the reference art style, '
              'facing slightly right in three-quarter view, in a relaxed boxing guard with the red boxing gloves raised, faint flames curling around his boots, confident grin. '
              'Plain pure white background, no text, no effects other than the small flames at the boots.')

def _ref():
    return FIGHTER_REF if os.path.exists(FIGHTER_REF) else STYLE_REF

def cutin_jobs():
    L = []
    for n, d in CUTIN.items():
        if os.path.exists(FIGHTER_REF):
            p = f'Using this exact chibi character (same design, same colors, same cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Plain pure white background, no text.'
        else:
            p = (f'Match the art style of this reference image exactly (same chibi anime proportions, line weight, coloring and rendering), but draw a DIFFERENT character: {LOOK}. '
                 f'A dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. No sword, no weapon. Plain pure white background, no text.')
        L.append({'out': os.path.join(C.OUT, 'cutin', f'{n}.png'), 'ref': _ref(), 'size': '1536x1024', 'model': 'gpt-image-2.5-sunburst', 'prompt': p})
    return L

def clear_flame_holes(im):
    """火焰包住的白底会残留成白斑（去白底只从四边灌水）：用 sky_art.clear_holes 去掉，再把人物身体一带（米白练功服）的 alpha 恢复原样"""
    import numpy as np
    from PIL import Image
    from sky_art import clear_holes
    a0 = np.array(im.convert('RGBA')); a1 = np.array(clear_holes(im.convert('RGBA')))
    h, w = a0.shape[:2]; y0, y1, x0, x1 = int(h * 0.22), int(h * 0.82), int(w * 0.18), int(w * 0.8)
    a1[y0:y1, x0:x1, 3] = a0[y0:y1, x0:x1, 3]
    return Image.fromarray(a1, 'RGBA')

def cutin_prep(only=''):
    from prep import remove_bg
    from PIL import Image
    out = os.path.join(C.HERE, 'final', 'cutin'); os.makedirs(out, exist_ok=True)
    for n in CUTIN:
        if only and not n.startswith(only): continue
        p = os.path.join(C.OUT, 'cutin', f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        im = remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS)
        im = clear_flame_holes(im); f = os.path.join(out, f'{n}.webp')
        im.save(f, 'WEBP', quality=82, method=6); print(n, os.path.getsize(f) // 1024, 'KB')

def job_jobs():
    return [{'out': os.path.join(C.SRC, 'quests', 'job_striker.png'), 'ref': _ref(), 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst', 'prompt': JOB_PROMPT}]

def job_prep():
    from importlib import util as _u
    spec = _u.spec_from_file_location('job_art_mod', os.path.join(os.path.dirname(__file__), 'job_art.py'))
    src = open(spec.origin).read().split('os.makedirs(OUT, exist_ok=True)')[0]
    g = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), g)
    from PIL import Image
    p = os.path.join(C.SRC, 'quests', 'job_striker.png')
    if not os.path.exists(p): print('missing', p); return
    im = g['cutout'](Image.open(p))
    if im.height > 900: im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
    out = os.path.join(C.HERE, 'final', 'job', 'striker.webp'); im.save(out, 'WEBP', quality=86, method=6); print('job/striker', im.size)

def run_jobs(L, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(C.run(j), flush=True)

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x2048'} for n, items in C.ICON_SHEETS.items()], only)
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', only or 'fs_icons']; icons.main()
    elif ph == 'cutin': run_jobs(cutin_jobs(), only)
    elif ph == 'cutinprep': cutin_prep(only)
    elif ph == 'job': run_jobs(job_jobs())
    elif ph == 'jobprep': job_prep()
    else: print(__doc__)
