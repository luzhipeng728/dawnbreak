#!/usr/bin/env python3
"""圣职者（男）基础职业（P-core）的美术：11 个基础技能图标 + 职业徽记 p_crest（一张 4×3 表）。
沿用 combatgen.py 的图标流水线（只替换表的内容，不修改 combatgen.py）；特效全部复用 art/final/fx（运行时染色），不生图。

  priest_base_art.py icons      图标表 → <主仓库>/art/src/combat/icons/p_icons_a.png（已存在就跳过；1 次生图）
  priest_base_art.py iconcut    切图标 → art/final/icon/<技能 id>.webp
  priest_base_art.py rapture    化魔单独重出一张（表里的第 10 格被画成了宝箱）→ p_rapture_single.png → icons.py --single（1 次生图）
生图约定：同时最多 1 个请求，429 退避 65 秒。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 男圣职者：白金色祭袍、手持巨型十字架（巨兵）；图标里只画动作 / 招式，不画具体人脸
ICONS = [
    ('p_launcher', 'a huge white and gold giant cross weapon swung upward in a rising golden arc, knocking a small dark silhouette up into the air'),
    ('p_smasher', 'a big armored hand gripping an enemy by the collar while charging forward, orange speed lines and a faint roaring tiger-head aura behind'),
    ('p_lucky', 'a white-gloved fist punching straight forward with three overlapping white impact rings, the front ring biggest with a lucky golden star sparkle'),
    ('p_second', 'a fist rising in a powerful uppercut, a bright golden crescent arc sweeping upward with small sparks'),
    ('p_slowheal', 'a gentle soft green healing glow with a small white holy cross and green sparkles slowly rising like leaves'),
    ('p_cure', 'a burst of pale blue purifying light with a small white cross in the center dispelling dark purple poison bubbles'),
    ('p_grab', 'a huge purple-black demonic clawed hand reaching out of dark smoke and closing its fingers to grasp'),
    ('p_purity', 'two crossed pure white-gold blades of holy light forming a shining cross shape with a radiant glow'),
    ('p_phoenix', 'a giant weapon plunged into cracked ground releasing a golden shockwave shaped like spread phoenix wings, flying rock chunks'),
    ('p_rapture', 'a dark crimson aura swirling around a chest turning into flowing bright blue mana droplets'),
    ('p_emblem', 'a glowing golden pentagram magic circle on the ground with a pillar of warm white light rising from it'),
    ('p_crest', 'a white and gold giant cross with a small blue rosary wrapped around it, a holy halo behind, priest class emblem'),
]
C.ICON_SHEETS = {'p_icons_a': ICONS}

def run_jobs(L, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(C.run(j), flush=True)   # 串行：同时最多 1 个生图请求

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]
    if ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x1536'} for n, items in C.ICON_SHEETS.items()])
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', 'p_icons']; icons.main()
    elif ph == 'rapture':
        out = os.path.join(C.OUT, 'icons', 'p_rapture_single.png')
        print(C.run({'out': out, 'size': '1024x1024', 'prompt': 'A single square game skill icon with rounded corners and a thick dark border, ' + C.ICON_STYLE + '. The icon shows: a priest in white robes hugging himself in painful ecstasy, a dark crimson blood-red aura rising from his body and turning into bright glowing blue mana droplets floating upward. Plain pure white background outside the icon. No text, no numbers, no labels.'}))
        import icons; sys.argv = ['icons.py', '--single', 'p_rapture', out]; icons.main()
    else: print(__doc__)
