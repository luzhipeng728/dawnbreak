#!/usr/bin/env python3
"""圣骑士（男圣职者转职 crusader，技能前缀 pc_）美术：技能图标（pc_*）、觉醒插图（cutin/crusader{,2,3}）、转职立绘（job/crusader）。
蓝拳圣使（infighter_art.py）复用这里的生图 / 切图函数。沿用 combatgen.py 的流水线（只替换表的内容，不修改 combatgen.py）；原图写到主仓库 art/src/combat/。
  crusader_art.py icons [--only 表名前缀]   图标表 → <主仓库>/art/src/combat/icons/pc_icons_*.png
  crusader_art.py iconcut [--only 表名]     切图标 → art/final/icon/<技能 id>.webp
  crusader_art.py cutin [--only 名字]       觉醒插图 → <主仓库>/art/src/combat/cutin/crusader*.png
  crusader_art.py cutinprep [--only 名字]   → art/final/cutin/crusader{,2,3}.webp
  crusader_art.py job / jobprep             转职立绘 → art/final/job/crusader.webp
人物参考：男圣职者原装设计（<主仓库>/art/src/priest_ref.png：蜂蜜金色短发、蓝眼睛）；一觉插图审过后，二觉 / 三觉插图和转职立绘都拿它当人物参考。
转职外观：圣骑士 = 厚重的白金板甲 + 蓝色披挂、左臂大盾（金十字）、右手巨型十字架（和蓝拳圣使的轻装 + 缠手拳套明显区分）。
生图约定：全局同一时间只发 1 个请求（发之前等别的生图脚本跑完），429 退避 65 秒；已存在的输出跳过。纯绿 #00FF00 / 品红 #FF00FF 是流水线标记色，不能用。
"""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

REF = os.path.join(C.SRC, 'priest_ref.png')   # 男圣职者原装设计（P-art 定稿）
FACE = 'same face, same short messy honey-blond hair, same blue eyes, same cute chibi anime art style, line weight and coloring'
LOOK = ('the male priest now promoted to a CRUSADER: heavy ornate white-and-gold full plate armor (big layered pauldrons, gold-trimmed breastplate with a blue cross), '
        'a royal-blue tabard and short blue cape, plate gauntlets, a large white kite shield with a gold cross on his left arm, '
        'the giant silver-and-gold cross weapon with a blue gem in his right hand, no helmet')

ICONS_A = [
    ('pc_god', 'a single glowing white feather drifting down into two cupped hands, soft golden halo rings around it'),
    ('pc_courage', 'a golden lion-head emblem on a red shield with a glowing holy mace raised behind it, fiery golden courage aura'),
    ('pc_guard', 'a white-and-gold kite shield with a blue cross, two wings of soft light spreading from behind it'),
    ('pc_revenge', 'a golden lightning bolt striking down from a small glowing halo, crackling white sparks'),
    ('pc_firm', 'a steel-and-gold plate gauntlet clenched tightly around a small golden cross, a hard stone-grey aura'),
    ('pc_sacrifice', 'a translucent winged angel spirit rising up from a fallen cross, green healing sparkles falling from it'),
    ('pc_light', 'a small humanoid silhouette enclosed in a glowing golden-white hexagon barrier bubble'),
    ('pc_sign', 'a round blue-and-gold emblem badge with a small shield and cross on it, glowing protective rings'),
    ('pc_fastheal', 'a bright green cross with fast forward motion lines and rising green healing sparkles'),
    ('pc_honor', 'a radiant golden crown of light floating above a crossed sword and staff, bright blessing rays'),
    ('pc_fountain', 'two tiny glowing fairies circling above a heart-shaped fountain of green and gold light'),
    ('pc_wind', 'a swirling breeze of green and white healing wind with small leaves and a faint white cross in the center'),
    ('pc_mace', 'a heavy golden holy mace wreathed in white holy-spirit flames'),
    ('pc_spear', 'a long white-and-gold spear of light flying diagonally and piercing through three small dark silhouettes'),
    ('pc_wall', 'a tall translucent blue-white wall of holy light blocking several incoming red arrows'),
    ('pc_sphere', 'a glowing white-and-gold orb of light rolling forward with circling sparkles and a short light trail'),
]
ICONS_B = [
    ('pc_haptism', 'a vertical pillar of holy light exploding at its base and pulling small dark silhouettes inward with curved arrows'),
    ('pc_hammer', 'a giant glowing golden hammer made of light smashing down on a small dark creature that sees stars'),
    ('pc_judge', 'a winged angel of justice hurling a radiant spear down onto a golden magic circle where blades of light rain down'),
    ('pc_cross', 'a glowing golden cross flying forward and bursting into a pentagram circle with small speed arrows'),
    ('pc_aura', 'a wide golden aura ring expanding outward from a praying silhouette, glowing upward arrows'),
    ('pc_awaken', 'the sky splitting open around a huge glowing orb of holy light, golden lightning bolts and spears of light raining down'),
    ('pc_medit', 'a kneeling priest silhouette praying with clasped hands, a glowing blue orb and a glowing red orb balanced on both sides'),
    ('pc_splitter', 'a charging dash with a giant cross weapon swung upward in a bright white crescent arc'),
    ('pc_doom', 'an ancient ornate holy spear falling straight down from the sky into a huge golden explosion'),
    ('pc_flash', 'a burst of sacred golden light exploding around an ally silhouette wrapped in a protective glow'),
    ('pc_sanct', 'a large glowing holy pentacle magic circle on the ground with green healing light rising from it'),
    ('pc_jupiter', 'a divine silver-and-gold thunder war hammer crackling with golden lightning'),
    ('pc_awaken2', 'a priest bathed in a column of baptism light, huge white wings of faith spreading behind him, five small glowing orbs around him'),
    ('pc_punish', 'a figure floating high in the sky raining many thin laser beams of holy light down onto the ground'),
    ('pc_agent', 'a glowing blue teardrop-shaped holy relic gem set in an ornate gold cross pendant, radiant light'),
    ('pc_astrape', 'a thunder hammer with spread wings of light slamming down, the ground cracking open and light erupting upward'),
]
# 第 4 张表（和蓝拳圣使合出一张）：圣骑士最后一个 + 蓝拳圣使的后 15 个，见 infighter_art.py
ICONS_MIX_HEAD = [
    ('pc_awaken3', 'a holy relic rising into the sky and turning into a sacred white sun above a planet, a huge column of light erupting below'),
]
C.ICON_SHEETS = {'pc_icons_a': ICONS_A, 'pc_icons_b': ICONS_B}

CUTIN = {
    'crusader': 'raising the giant cross toward a sky that splits open, a huge radiant orb of holy light above him, golden lightning bolts and spears of light raining down behind him, solemn determined expression',
    'crusader2': 'huge white wings of light spreading from his back inside a column of baptism light, holding a divine thunder war hammer crackling with golden lightning, five small glowing orbs circling him',
    'crusader3': 'crossing himself and praying, a glowing blue teardrop relic floating up from his chest and turning into a small sacred sun above his raised hand, blinding golden light rays, serene expression',
}
JOB_PROMPT = (f'Using this exact chibi character ({FACE}), draw a full-body standing portrait for a class selection screen of {LOOK}, cute chibi proportions, full body visible from head to boots, '
              'facing slightly right in three-quarter view, standing proudly with the shield in front and the giant cross resting on his shoulder, calm confident expression. '
              'Plain pure white background, no text, no effects.')
APPROVED = os.path.join(C.OUT, 'cutin', 'crusader.png')   # 审过的一觉插图：二觉 / 三觉插图和转职立绘拿它当人物参考


def wait_idle(tag='', limit=1800):
    """全局串行：别的生图脚本（art/tools/*.py 的 cutin / icons / sheets / job……、gpt_image.py）在跑就等它结束"""
    me, t0 = os.getpid(), time.time()
    while time.time() - t0 < limit:
        try: out = subprocess.run(['pgrep', '-fl', r'python3? .*(art/tools/[a-z_0-9]+\.py (icons|cutin|job|sheets|csheets|fx|design|ref|single|rapture)|gpt_image\.py gen)'], capture_output=True, text=True).stdout
        except Exception: return
        others = [l for l in out.splitlines() if l.strip() and not l.startswith(str(me) + ' ') and 'pgrep' not in l]
        if not others: return
        print(f'  [{tag}] 等别的生图请求结束：{others[0][:120]}', flush=True); time.sleep(20)


def run_jobs(L, only=''):
    L = [j for j in L if os.path.basename(j['out']).startswith(only)]
    print(f'{len(L)} jobs', flush=True)
    for j in L:
        if not os.path.exists(j['out']): wait_idle(os.path.basename(j['out']))
        print(C.run(j), flush=True)   # 串行：同时最多 1 个生图请求


def icon_jobs(sheets):
    return [{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in items]), 'size': '2048x2048'} for n, items in sheets.items()]


def cutin_jobs(cutin, approved, look, extra=''):
    L = []
    for n, d in cutin.items():
        first = not os.path.exists(approved) or os.path.basename(approved) == f'{n}.png'
        ref = REF if first else approved
        p = (f'Using this exact chibi character ({FACE}), draw {look}. {extra}A dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. '
             'Plain pure white background, no text.')
        L.append({'out': os.path.join(C.OUT, 'cutin', f'{n}.png'), 'ref': ref, 'size': '1536x1024', 'model': 'gpt-image-2.5-sunburst', 'prompt': p})
    return L


def cutin_prep(names, only=''):
    from prep import remove_bg
    from PIL import Image
    out = os.path.join(C.HERE, 'final', 'cutin'); os.makedirs(out, exist_ok=True)
    for n in names:
        if only and not n.startswith(only): continue
        p = os.path.join(C.OUT, 'cutin', f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        im = remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS); f = os.path.join(out, f'{n}.webp')
        im.save(f, 'WEBP', quality=82, method=6); print(n, os.path.getsize(f) // 1024, 'KB')


def job_jobs(key, prompt, approved):
    return [{'out': os.path.join(C.SRC, 'quests', f'job_{key}.png'), 'ref': approved if os.path.exists(approved) else REF, 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst', 'prompt': prompt}]


def job_prep(key):
    from importlib import util as _u
    spec = _u.spec_from_file_location('job_art_mod', os.path.join(os.path.dirname(__file__), 'job_art.py'))
    src = open(spec.origin).read().split('os.makedirs(OUT, exist_ok=True)')[0]
    g = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), g)
    from PIL import Image
    p = os.path.join(C.SRC, 'quests', f'job_{key}.png')
    if not os.path.exists(p): print('missing', p); return
    im = g['cutout'](Image.open(p))
    if im.height > 900: im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
    out = os.path.join(C.HERE, 'final', 'job', f'{key}.webp'); im.save(out, 'WEBP', quality=86, method=6); print(f'job/{key}', im.size)


def iconcut(prefix):
    import icons; sys.argv = ['icons.py', '--combat', '--only', prefix]; icons.main()


if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons': run_jobs(icon_jobs(C.ICON_SHEETS), only)
    elif ph == 'iconcut': iconcut(only or 'pc_icons')
    elif ph == 'cutin': run_jobs(cutin_jobs(CUTIN, APPROVED, LOOK, 'He wears the heavy plate armor and carries the big shield. '), only)
    elif ph == 'cutinprep': cutin_prep(CUTIN, only)
    elif ph == 'job': run_jobs(job_jobs('crusader', JOB_PROMPT, APPROVED))
    elif ph == 'jobprep': job_prep('crusader')
    else: print(__doc__)
