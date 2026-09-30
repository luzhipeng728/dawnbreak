#!/usr/bin/env python3
"""柔道家（男格斗家转职 grappler，B7）的美术：技能图标 28 个（2 张表）、觉醒插图 3 张、转职立绘 1 张，共 6~7 次生图。
人物动作帧归 B1（原装帧），这里不画人物帧；特效全部复用 art/final/fx + 运行时程序特效。
原图写到主仓库 art/src/combat/（不进 git），切好的素材输出到本仓库 art/final。

  fighter_grappler_art.py icons   [--only fg_icons_a]      图标表 → <主仓库>/art/src/combat/icons/fg_icons_{a,b}.png
  fighter_grappler_art.py iconcut [--only fg_icons_a]      切图标 → art/final/icon/fg_*.webp
  fighter_grappler_art.py cutin   [--only grappler.png]    觉醒插图 → <主仓库>/art/src/combat/cutin/grappler{,2,3}.png
  fighter_grappler_art.py cutinprep                        → art/final/cutin/grappler{,2,3}.webp（720×480）
  fighter_grappler_art.py job / jobprep                    转职立绘 → art/final/job/grappler.webp

角色设计还没定稿（B1 的 fighter_ref.png 没出）：立绘先拿鬼剑士立绘当“画风参考”、人物按 WHO 文字描述（和散打的红头带白道服区分开），插图再拿立绘当人物参考；
B1 定稿后把 STYLE_REF 换成 fighter_ref.png、旧原图改名 .bak 重跑 job / cutin 即可。
样图顺序（先审再批量）：icons --only fg_icons_a → cutin --only grappler.png；过审后 icons（b 表）→ job（立绘，定造型）→ cutin（拿立绘当人物参考，一觉插图也按新造型重出）。
生图约定：串行，同时最多 1 个请求；已存在的输出跳过；纯绿 #00FF00 / 品红 #FF00FF 是切图标记色，不能用。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

ICONS_A = [
    ('fg_grabcannon', 'a clenched armored gauntlet fist punching forward and releasing a round blue-white shockwave blast'),
    ('fg_takedown', 'a cracked stone ground with a big circular dust shockwave ring bursting outward from the center'),
    ('fg_overgrab', 'two huge glowing blue-white spectral hands reaching out and pulling inward, crackling blue energy'),
    ('fg_slide', 'a martial artist boot sliding fast along the ground with long white speed streaks and kicked-up dust'),
    ('fg_light', 'a light red-and-white martial arts vest armor with a red belt, clean and simple'),
    ('fg_gauntlet', 'a heavy steel forearm gauntlet with red leather straps and a round knuckle guard, shining'),
    ('fg_combo', 'three linked golden chain rings with small impact sparks between them'),
    ('fg_fling', 'a big boot kicking a small cartoon enemy silhouette flying away in an arc with a dotted trail'),
    ('fg_tackle', 'a powerful shoulder charging forward with orange impact rings and flying debris'),
    ('fg_breakdown', 'a suplex arc: an enemy silhouette flipped over in a big curved arrow and slammed into cracking ground'),
    ('fg_necksnap', 'an open palm slap with a curved white swoosh and a spinning dizzy swirl'),
    ('fg_snapshot', 'a spinning roundhouse kick with a circular white-blue wind trail around it'),
    ('fg_airsteiner', 'two legs scissoring around a small enemy silhouette in mid-air, spinning downward with a swirl'),
    ('fg_slamkick', 'a heel axe-kick coming straight down with a violet-white impact burst on the ground'),
    ('fg_magnum', 'a backflip silhouette above glowing feet stamping down on a wide blue shockwave ring'),
    ('fg_rolling', 'a blazing wheel of fire rolling forward, an enemy silhouette curled inside it'),
]
ICONS_B = [
    ('fg_cannonspike', 'a diving kick plunging diagonally down into the ground with an orange fiery explosion ring'),
    ('fg_counter', 'a hand catching an incoming fist at the wrist, a red exclamation spark between them'),
    ('fg_awaken', 'a gust of swirling wind pulling in rocks toward a huge golden-orange ground explosion'),
    ('fg_pierce', 'a flying kick piercing forward like a white-blue comet with a long bright trail and dust'),
    ('fg_fury', 'a flurry of many fists pummeling at once with orange impact stars, a crater below'),
    ('fg_strongest', 'a fierce red-eyed tiger-like aura behind a raised fist, crimson flames'),
    ('fg_blacktornado', 'a dark grey-black tornado spinning with an enemy silhouette planted head-first in the ground below'),
    ('fg_stormdiver', 'a lightning-fast dash leaving white-yellow afterimages grabbing several enemy silhouettes into one point'),
    ('fg_awaken2', 'a glowing orange tiger head roaring out of a shattered ground with flying boulders'),
    ('fg_equanimity', 'a calm meditating martial artist silhouette inside a still golden circle, serene'),
    ('fg_basalt', 'a whirlwind tearing up black basalt rock slabs that shatter into flying shards'),
    ('fg_awaken3', 'an erupting volcano of boiling lava and black rocks under a giant clenched fist'),
]
C.ICON_SHEETS = {'fg_icons_a': ICONS_A, 'fg_icons_b': ICONS_B}

# 人物（和散打区分：散打 = 红头带 + 白道服 + 红拳套；柔道家 = 不戴头带、深藏青 / 白两色柔道服 + 黑腰带 + 钢臂铠 / 缠手，同样的棕色刺猬头）
WHO = ('a cute chibi young male judo grappler: short spiky brown hair with NO headband and nothing on the head, '
       'a two-tone judo gi (dark navy blue jacket with white lapels and white trim, white pants) tied with a black belt, '
       'heavy steel forearm gauntlets over dark cloth hand wraps, bare determined face')
STYLE_REF = os.path.join(C.SRC, 'sword_ref.png')   # 只借画风（Q 版比例、粗描边、上色），人物按 WHO 画
JOB_PNG = os.path.join(C.SRC, 'quests', 'job_grappler.png')   # 转职立绘先出，之后的觉醒插图拿它当人物参考（同一套造型）
CUTIN = {
    'grappler': 'Rhythmic Assault: swinging one arm to whip up a roaring gust of wind that sucks in flying rocks and dust, the other gauntlet fist clenched, fierce shout',
    'grappler2': 'Quaking Tiger: stomping the ground so hard it shatters into boulders, a glowing orange tiger-shaped aura roaring behind him, gauntlets raised',
    'grappler3': 'Volcanic Dynamo: slamming both gauntlet fists down, the ground erupting into boiling orange lava and black rocks around him, fiery aura, intense glare',
}
JOB_PROMPT = (f'Draw {WHO}. Full-body standing portrait for a class selection screen, facing slightly right in three-quarter view, in the same cute chibi art style as the '
              'reference image (big head, bold dark outlines, clean cel shading, bright saturated colors) but a completely different character: '
              'a steady grappling stance with both gauntleted hands open and ready to grab, confident smile. Plain pure white background, no text, no effects.')

def cutin_jobs():
    refs = [JOB_PNG, STYLE_REF] if os.path.exists(JOB_PNG) else [STYLE_REF]
    who = ('the exact chibi character from the first reference image (same face, same spiky brown hair with no headband, same dark navy and white judo gi with black belt, same steel gauntlets; '
           'same cute art style)') if len(refs) > 1 else f'{WHO}, in the same cute chibi art style as the reference image (big head, bold dark outlines, clean cel shading, bright saturated colors) but a completely different character'
    return [{'out': os.path.join(C.OUT, 'cutin', f'{j}.png'), 'refs': refs, 'size': '1536x1024',
             'prompt': f'Draw {who}. A dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Plain pure white background, no text.'}
            for j, d in CUTIN.items()]

def job_jobs():
    return [{'out': JOB_PNG, 'refs': [STYLE_REF], 'size': '1024x1536', 'prompt': JOB_PROMPT}]

def run_ref(job):   # 参考图直接传本地文件（不走 sheets.upload 的旧上传缓存，PLAYBOOK §4）
    out = job['out']
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    base, key, _ = C.SH.gi.load_cfg()
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': job['prompt'], 'n': 1, 'size': job['size'], 'quality': 'high', 'response_format': 'b64_json',
               'image': ['local:' + os.path.abspath(p) for p in job['refs']]}
    try:
        C.SH.gi.save_images(C.SH.gi.post_json(f'{base}/images/generations', key, payload, 900), out, False, False); return f'ok   {os.path.basename(out)}'
    except (SystemExit, OSError) as e: return f'FAIL {os.path.basename(out)}: {str(e)[:200]}'

def cutin_prep():
    from PIL import Image
    from prep import remove_bg
    out = os.path.join(C.HERE, 'final', 'cutin'); os.makedirs(out, exist_ok=True)
    for j in CUTIN:
        p = os.path.join(C.OUT, 'cutin', f'{j}.png')
        if not os.path.exists(p): print('missing', j); continue
        im = remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS); f = os.path.join(out, f'{j}.webp')
        im.save(f, 'WEBP', quality=82, method=6); print(j, os.path.getsize(f) // 1024, 'KB')

def job_prep():
    from importlib import util as _u
    from PIL import Image
    spec = _u.spec_from_file_location('job_art_mod', os.path.join(os.path.dirname(__file__), 'job_art.py'))
    src = open(spec.origin).read().split('os.makedirs(OUT, exist_ok=True)')[0]   # 只要函数定义，不跑它的批处理
    g = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), g)
    p = os.path.join(C.SRC, 'quests', 'job_grappler.png')
    if not os.path.exists(p): print('missing', p); return
    im = g['cutout'](Image.open(p))
    if im.height > 900: im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
    out = os.path.join(C.HERE, 'final', 'job', 'grappler.webp'); im.save(out, 'WEBP', quality=86, method=6); print('job/grappler', im.size)

def run_jobs(L, fn, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(fn(j), flush=True)   # 串行：同时最多 1 个生图请求

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x2048'} for n, items in C.ICON_SHEETS.items()], C.run, only)
    elif ph == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat', '--only', only or 'fg_icons']; icons.main()
    elif ph == 'cutin': run_jobs(cutin_jobs(), run_ref, only)
    elif ph == 'cutinprep': cutin_prep()
    elif ph == 'job': run_jobs(job_jobs(), run_ref, only)
    elif ph == 'jobprep': job_prep()
    else: print(__doc__)
