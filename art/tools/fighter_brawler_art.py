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
ICONS = [
    ('fb_poisonres', 'a purple poison droplet in front of a green round shield'),
    ('fb_overstrain', 'a clenched fist wreathed in dark purple and crimson forbidden energy with glowing veins'),
    ('fb_heavy', 'a heavy steel chest plate armor with big rivets'),
    ('fb_autoload', 'a leather bandolier pouch loaded with small poison bottles, needles and a brick, with a circular reload arrow around it'),
    ('fb_strong', 'a hand gripping a glowing gold-charged poison bottle crackling with power sparks'),
    ('fb_poison', 'a corked purple glass poison bottle flying and splashing purple poison'),
    ('fb_backstreet', 'two thrown bricks crossing in the air in front of a dark back alley brick wall, red aura'),
    ('fb_hook', 'a roundhouse kick hitting a burst of orange fire explosion'),
    ('fb_pocket', 'a patched denim back pocket with a small fire bomb and a poison bottle peeking out'),
    ('fb_claw', 'a steel claw weapon with three curved blades over the knuckles'),
    ('fb_needle', 'three thin silver needles with red tips flying diagonally with speed lines'),
    ('fb_brick', 'a red clay brick shattering into sharp fragments'),
    ('fb_mount', 'a fist punching straight down at the ground with a yellow impact burst, a knocked-down silhouette under it'),
    ('fb_taunt', 'a smirking face with one hand beckoning come here, red anger marks around'),
    ('fb_tackle', 'a low sliding kick kicking up a big cloud of sand'),
    ('fb_net', 'a thrown rope net spreading wide open in the air'),
    ('fb_vulcan', 'a giant fist smashing the ground releasing blue and white shockwave rings'),
    ('fb_mine', 'a spiked green poison mine bursting into a plume of pink and purple poison gas'),
    ('fb_lariat', 'a heavy iron chain with a hook swinging in a full circle, small red blood drops'),
    ('fb_thousand', 'many ghostly hands fanned out like a thousand-armed statue, each throwing a bottle, needle or brick'),
    ('fb_awaken', 'a huge iron chain hook dragging across cracked burning ground under a giant falling boulder'),
    ('fb_barrel', 'a wooden barrel bursting open with green and purple toxic goo'),
    ('fb_chain', 'long iron chains whirling wildly in a vortex with crimson accents'),
    ('fb_rulebreak', 'a torn rule book with broken chains and a sly grin, purple glow'),
    ('fb_chaindrive', 'an iron chain stabbed into the ground spinning and flinging rocks upward'),
    ('fb_cavein', 'a stone ceiling collapsing with many rocks falling down'),
    ('fb_awaken2', 'an iron pipe studded with spiked poison mines smashing down into a huge pink and orange explosion'),
    ('fb_picaresque', 'a sinister grinning white mask with a poison bottle and a fire bottle crossed behind it'),
    ('fb_roadtohell', 'a red explosive oil drum rolling forward with flames bursting behind it'),
    ('fb_awaken3', 'purple chains converging above a dark night alley into a massive bomb made of building rubble'),
]
SHEETS = {'fb_icons_a': ICONS[:12], 'fb_icons_b': ICONS[12:24], 'fb_icons_c': ICONS[24:]}
C.ICON_SHEETS = SHEETS   # iconcut 走 icons.py --combat（读 combatgen.ICON_SHEETS）


def icon_prompt(items):
    cols = 4 if len(items) % 4 == 0 else 3
    return (f'A sprite sheet of {len(items)} separate game skill icons arranged in a grid of {cols} columns and {len(items) // cols} rows on a plain pure white background, '
            f'evenly spaced with generous white gaps between icons, no icon touching another, {C.ICON_STYLE}. '
            'Theme: a dirty-fighting street brawler who throws poison bottles, needles, bricks and nets and swings iron chains; gritty colors (purple poison, rust red, iron grey, fire orange). '
            'In reading order (left to right, top to bottom): ' + '; '.join(f'({i + 1}) {t}' for i, (_, t) in enumerate(items)) + '. No text, no numbers, no labels.')


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
    cmd = ['python3', GI, 'edit' if job.get('ref') else 'gen', job['prompt'], '-o', out, '-s', job['size'], '-q', 'high'] + (['-i', job['ref']] if job.get('ref') else []) + (['-m', job['model']] if job.get('model') else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s' if r.returncode == 0 and os.path.exists(out) else f'FAIL {os.path.basename(out)}: {(r.stderr or r.stdout)[-300:]}'


def prep(src, dst, size):
    from prep import remove_bg
    from PIL import Image
    if not os.path.exists(src): print('missing', src); return
    im = remove_bg(Image.open(src)).resize(size, Image.LANCZOS); os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=82, method=6); print(os.path.basename(dst), os.path.getsize(dst) // 1024, 'KB')


if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons':
        for n, items in SHEETS.items():
            if n.startswith(only): print(run({'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': icon_prompt(items), 'size': '2048x1536' if len(items) == 12 else '1536x1024'}), flush=True)
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', only or 'fb_icons']; icons.main()
    elif ph == 'cutin':
        for j in cutin_jobs():
            if not only or os.path.basename(j['out'])[:-4] == only: print(run(j), flush=True)
    elif ph == 'cutinprep':
        for j in CUTIN:
            if not only or j == only: prep(os.path.join(C.OUT, 'cutin', f'{j}.png'), os.path.join(HERE, 'final', 'cutin', f'{j}.webp'), (720, 480))
    elif ph == 'job':
        for j in job_jobs(): print(run(j), flush=True)
    elif ph == 'jobprep':
        prep(os.path.join(C.OUT, 'job', 'brawler.png'), os.path.join(HERE, 'final', 'job', 'brawler.webp'), (652, 900))
    else: print(__doc__)
