#!/usr/bin/env python3
"""格斗家（男）基础职业（B3）的美术：15 个基础技能图标（一张 4×4 表，第 16 格是职业徽记 f_emblem）。
沿用 combatgen.py 的图标流水线（只替换表的内容，不修改 combatgen.py）；特效全部复用 art/final/fx（运行时染色），不生图。

  fighter_base_art.py icons      图标表 → <主仓库>/art/src/combat/icons/f_icons_a.png（已存在就跳过；1 次生图）
  fighter_base_art.py iconcut    切图标 → art/final/icon/<技能 id>.webp
生图约定：同时最多 1 个请求，429 退避 65 秒。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 男格斗家：黑短发 + 红头带、白色道服上衣、红腰带（和 fighter.js 的 PAL_FIGHTER 一致）；图标里只画动作 / 招式，不画具体人脸
ICONS = [
    ('f_highkick', 'a martial artist leg kicking straight up vertically, the foot trailing a bright white-orange arc of motion, launching a small silhouette upward'),
    ('f_hammer', 'a powerful horizontal side kick with the sole of the foot forward, a big white impact burst and wind lines blasting to the right'),
    ('f_lowkick', 'a sweeping low kick skimming the ground, a golden shockwave ring spreading along the floor from the impact point'),
    ('f_knee', 'two hands grabbing an enemy by the collar and a raised knee striking upward, orange impact stars'),
    ('f_clone', 'three pale translucent blue-white ghostly copies of a martial artist in a fighting stance standing in a row'),
    ('f_chain', 'a shoulder charge followed by a flurry of blue-white punching fists with speed lines'),
    ('f_chain2', 'a roaring white tiger head made of blue-white energy behind a fast chain of punches'),
    ('f_iron', 'a muscular flexed arm made of shining steel with iron bands, a sturdy golden shield glint'),
    ('f_flash', 'a martial artist teleporting forward leaving three fading blue afterimages and a white dash streak'),
    ('f_airwalk', 'a foot stomping down from the air onto a small enemy head, a white ring of impact, feathers of an eagle wing behind'),
    ('f_nenshot', 'an open palm pushing forward releasing a glowing golden-white energy ball crackling with small lightning sparks'),
    ('f_sand', 'a hand flinging a spray of yellow sand and small pebbles forward in a wide fan'),
    ('f_crouch', 'a martial artist ducking low in a deep crouch while a big blade swings harmlessly over his head'),
    ('f_seismic', 'two feet stomping onto cracked ground, a big brown dust shockwave and flying rock chunks bursting outward'),
    ('f_tornado', 'a spinning kick creating a swirling blue-white whirlwind vortex around the legs'),
    ('f_emblem', 'a clenched fist wrapped in a red cloth hand wrap in front of a red headband with long trailing tails'),
]
C.ICON_SHEETS = {'f_icons_a': ICONS}

def run_jobs(L, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(C.run(j), flush=True)   # 串行：同时最多 1 个生图请求

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]
    if ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x2048'} for n, items in C.ICON_SHEETS.items()])
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', 'f_icons']; icons.main()
    else: print(__doc__)
