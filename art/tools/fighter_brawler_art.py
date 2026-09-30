#!/usr/bin/env python3
"""街霸（男格斗家转职 brawler，B6）的美术：技能图标（30 个，3 张表）/ 觉醒插图（一 / 二 / 三觉）/ 转职立绘。
原图写到主仓库 art/src/combat/（不进 git），切好的素材输出到本仓库 art/final（icon/fb_*.webp、cutin/brawler{,2,3}.webp、job/brawler.webp）。
道具（毒瓶 / 砖块 / 罗网 / 毒雷 / 木桶 / 锁链）和技能特效全部是运行时绘制（src/content/classes/fighter_brawler.js），这里不出。

  fighter_brawler_art.py icons [--only fb_icons_a]    图标表 → <主仓库>/art/src/combat/icons/fb_icons_{a,b,c}.png
  fighter_brawler_art.py iconcut [--only fb_icons_a]  切图标 → art/final/icon/<技能 id>.webp
  fighter_brawler_art.py cutin [--only brawler2]      觉醒插图（--only 精确匹配一张） → <主仓库>/art/src/combat/cutin/brawler{,2,3}.png
  fighter_brawler_art.py cutinprep [--only brawler]   去白底 → art/final/cutin/brawler{,2,3}.webp（720×480）
  fighter_brawler_art.py job / jobprep                转职立绘 → art/final/job/brawler.webp
生图：~/.claude/skills/gpt-image（串行，已存在的输出跳过）。人物参考图：有 B1 的 art/src/fighter_ref.png 就用它（同一个角色），
还没有时用 sword_ref.png 只当“画风参考”（提示词里写明换成格斗家的造型），B1 定稿后把插图删掉重出即可。
"""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
# 每个图标：(技能 id, 主体, 底色)。风格照现有的明亮 Q 版图标（散打 fs_icons_a / 神枪手 gskills_a 当参考图传进去）：主体简单、轮廓粗、底色是单一鲜艳色 + 中心放射光
ICONS = [
    ('fb_poisonres', 'a cute purple poison droplet with a skull face bouncing off a round green shield', 'bright green'),
    ('fb_overstrain', 'a clenched fist bursting with swirling purple and red energy', 'magenta'),
    ('fb_heavy', 'a shiny silver chest plate armor with gold rivets', 'royal blue'),
    ('fb_autoload', 'a brown leather pouch stuffed with little purple bottles and a red brick, a circular orange reload arrow around it', 'orange'),
    ('fb_strong', 'a hand holding up a glowing purple poison bottle with golden sparkles', 'golden yellow'),
    ('fb_poison', 'a round purple glass poison bottle with a cork flying and splashing purple drops', 'violet'),
    ('fb_backstreet', 'two red bricks flying and crossing each other with white motion lines', 'crimson red'),
    ('fb_hook', 'a kicking foot in a black shoe hitting a big orange fire explosion', 'orange red'),
    ('fb_pocket', 'a blue jeans back pocket with a small black fire bomb with a lit fuse and a purple bottle peeking out', 'teal'),
    ('fb_claw', 'a fist wearing a shiny steel claw with three curved blades', 'deep blue'),
    ('fb_needle', 'three thin silver needles with red tips flying diagonally with speed lines', 'red'),
    ('fb_brick', 'a red brick breaking into chunky pieces with a yellow impact star', 'amber orange'),
    ('fb_mount', 'a big fist punching straight down with a yellow impact burst', 'yellow orange'),
    ('fb_taunt', 'a cheeky grinning face beckoning come here with one hand, red anger marks', 'hot pink'),
    ('fb_tackle', 'a low sliding kick kicking up a big cloud of tan sand', 'sandy yellow'),
    ('fb_net', 'a tan rope net spreading wide open in the air', 'sky blue'),
    ('fb_vulcan', 'a giant fist smashing the ground releasing glowing blue and white shockwave rings', 'blue'),
    ('fb_mine', 'a round spiked green mine bursting into a puffy cloud of pink and purple gas', 'purple'),
    ('fb_lariat', 'a silver chain with a hook swinging in a full circle with a white motion ring', 'dark red'),
    ('fb_thousand', 'many golden hands fanned out in a circle like a thousand-armed statue, each holding a bottle, needle or brick', 'gold'),
    ('fb_awaken', 'a giant chain hook and a huge boulder crashing onto the ground with flames', 'fiery orange'),
    ('fb_barrel', 'a wooden barrel bursting open with bright green and purple goo', 'lime green'),
    ('fb_chain', 'silver chains whirling in a big swirl with small red sparks', 'crimson'),
    ('fb_rulebreak', 'a rule book torn in half with a broken chain and a sly grin symbol', 'purple'),
    ('fb_chaindrive', 'a silver chain stabbed into the ground spinning and flinging rocks up', 'brown orange'),
    ('fb_cavein', 'many rocks falling from a cracked ceiling with a yellow shockwave below', 'sandy orange'),
    ('fb_awaken2', 'an iron pipe covered in little spiked mines smashing down into a big pink and orange explosion', 'hot pink'),
    ('fb_picaresque', 'a grinning white mask with a purple poison bottle and an orange fire bottle crossed behind it', 'dark violet'),
    ('fb_roadtohell', 'a red explosive barrel rolling forward with flames bursting out', 'red orange'),
    ('fb_awaken3', 'glowing purple chains wrapping a giant round bomb made of rubble above a night street', 'indigo'),
]
SHEETS = {'fb_icons_a': ICONS[:12], 'fb_icons_b': ICONS[12:24], 'fb_icons_c': ICONS[24:]}
C.ICON_SHEETS = {k: [(n, d) for n, d, _ in v] for k, v in SHEETS.items()}   # iconcut 走 icons.py --combat（读 combatgen.ICON_SHEETS）
ICON_REFS = [os.path.join(C.OUT, 'icons', 'fs_icons_a.png'), os.path.join(C.OUT, 'icons', 'gskills_a.png')]   # 画风参考：散打 / 神枪手的图标表
ICON_LOOK = ('bright glossy cute Q-style mobile game skill icons exactly like the reference sheets: simple bold chunky shapes, thick dark outlines, smooth cel shading, '
             'very saturated vivid colors, each icon a rounded square tile with a thick dark border and ONE vivid background color with a bright radial glow behind the subject; '
             'NOT realistic, NOT gritty, no fine texture, no dark muddy colors')


def icon_prompt(items):
    cols = 4 if len(items) % 4 == 0 else 3
    return (f'Using the same icon art style as the reference sheets (but NEW subjects), draw a sprite sheet of {len(items)} separate game skill icons arranged in a grid of {cols} columns and {len(items) // cols} rows '
            f'on a plain pure white background, evenly spaced with generous white gaps, no icon touching another. Style: {ICON_LOOK}. '
            'In reading order (left to right, top to bottom): ' + '; '.join(f'({i + 1}) {t}, {bg} background' for i, (_, t, bg) in enumerate(items)) + '. No text, no numbers, no labels.')


# 男格斗家的造型（B1 定稿 art/src/fighter_ref.png：棕色刺猬头、红色无袖中式上衣 + 黑色镶边和腰带、黑色灯笼裤、手脚缠绷带）；街霸特征 = 脸上的创可贴、爪
LOOK = ('a chibi young male martial artist: spiky brown hair, a sleeveless red Chinese-style top with black trim and a black sash, baggy black pants, '
        'bandage wraps on the hands and shins, plus two small white bandages on his cheek and a steel claw on one hand, sly confident grin')
CUTIN = {
    'brawler': 'swinging a huge iron chain hook across the burning ground and lifting a giant boulder overhead with one arm, flames and flying rocks, fierce grin',
    'brawler2': 'with a steel claw on one hand and small white bandages on his cheek, eyes glowing purple, smashing down a long iron pipe studded with spiked poison mines, pink and orange explosions behind him, menacing grin',
    'brawler3': 'with a steel claw on one hand and small white bandages on his cheek, standing in a dark neon-lit back alley at night, purple chains swirling around him, a massive bomb made of building rubble floating above, cold confident smirk',
}


def ref_img():
    f = os.path.join(C.SRC, 'fighter_ref.png')
    return (f, True) if os.path.exists(f) else (os.path.join(C.SRC, 'sword_ref.png'), False)


def cutin_jobs():
    ref, same = ref_img()
    who = 'Using this exact chibi character (same design, same colors, same cute art style)' if same else f'Using ONLY the cute chibi art style of this reference (thick outlines, soft cel shading) but drawing a DIFFERENT character: {LOOK}'
    return [{'out': os.path.join(C.OUT, 'cutin', f'{j}.png'), 'ref': ref, 'size': '1536x1024', 'model': 'gpt-image-2.5-sunburst',
             'prompt': f'{who}, draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Modest outfit, fully covered. Plain pure white background, no text.'}
            for j, d in CUTIN.items()]


def job_jobs():
    ref, same = ref_img()
    who = 'Using this exact chibi character (same face, same hair, same outfit, same cute art style with thick outlines)' if same else f'Using ONLY the cute chibi art style of this reference but drawing a DIFFERENT character: {LOOK}'
    return [{'out': os.path.join(C.OUT, 'job', 'brawler.png'), 'ref': ref, 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst',
             'prompt': f'{who}, draw a full-body standing portrait for a class selection screen, facing right: a sly street brawler holding a poison bottle between his fingers, an iron chain wrapped around his forearm, a few bricks at his feet. Plain pure white background, no text.'}]


def run(job):
    out = job['out']
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    t = time.time()
    refs = job.get('refs') or ([job['ref']] if job.get('ref') else [])
    cmd = ['python3', GI, 'edit' if refs else 'gen', job['prompt'], '-o', out, '-s', job['size'], '-q', 'high'] + [x for r in refs for x in ('-i', r)] + (['-m', job['model']] if job.get('model') else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s' if r.returncode == 0 and os.path.exists(out) else f'FAIL {os.path.basename(out)}: {(r.stderr or r.stdout)[-300:]}'


def prep(src, dst, size, holes=False):
    from prep import remove_bg
    from PIL import Image
    if not os.path.exists(src): print('missing', src); return
    im = remove_bg(Image.open(src))
    if holes: from sky_art import clear_holes; im = clear_holes(im, thr=238, min_area=3000)   # 锁链 / 爆炸围住的白底（面积门槛 3000，脸上的创可贴不会被挖掉）
    im = im.resize(size, Image.LANCZOS); os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=82, method=6); print(os.path.basename(dst), os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons':
        for n, items in SHEETS.items():
            if n.startswith(only): print(run({'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': icon_prompt(items), 'refs': [r for r in ICON_REFS if os.path.exists(r)], 'size': '2048x2048' if len(items) == 12 else '1536x1024'}), flush=True)
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', only or 'fb_icons']; icons.main()
    elif ph == 'cutin':
        for j in cutin_jobs():
            if not only or os.path.basename(j['out'])[:-4] == only: print(run(j), flush=True)
    elif ph == 'cutinprep':
        for j in CUTIN:
            if not only or j == only: prep(os.path.join(C.OUT, 'cutin', f'{j}.png'), os.path.join(HERE, 'final', 'cutin', f'{j}.webp'), (720, 480), holes=True)
    elif ph == 'job':
        for j in job_jobs(): print(run(j), flush=True)
    elif ph == 'jobprep':
        prep(os.path.join(C.OUT, 'job', 'brawler.png'), os.path.join(HERE, 'final', 'job', 'brawler.webp'), (652, 900))
    else: print(__doc__)
