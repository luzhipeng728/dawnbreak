#!/usr/bin/env python3
"""战斗与动作的美术生成：新动作表（3×3，第 1 格站姿参考 + 8 帧）、技能图标表、技能特效。
原图写到主仓库 art/src/combat/（不进 git），切好的素材由 frames2.py / icons.py / fxprep.py 输出到 art/final。
  combatgen.py sheets [--only 前缀]     动作表 → art/src/combat/sheets/<角色>_<表>.png
  combatgen.py icons  [--only 前缀]     图标表 → art/src/combat/icons/<表>.png
  combatgen.py fx     [--only 前缀]     特效   → art/src/combat/fx/<名字>.png
同时最多 3 个生图请求（团队约定），429 退避 65 秒。已存在的输出跳过。
"""
import os, sys, json, time, argparse, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import sheets as SH
from sheets2 import prompt as sheet_prompt
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')   # 主仓库的 art（原图与参考图都在这里）
SRC = os.path.join(MAIN, 'src')
OUT = os.path.join(SRC, 'combat')
SH.CACHE = os.path.join(HERE, '.upload_cache.json')
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')

HOLD = {'sword': 'holding the katana', 'gun': 'holding the silver revolver', 'mage': 'holding the crystal staff'}
# 每张表 8 帧：(帧名, 描述)；人物一律面朝右
SHEETS = {
    # ---- 受击 / 浮空 / 被抓 / 受身 / 蓄力（三个职业各一张） ----
    'sword_react2': [('hit3', 'hit hard: knocked backward off balance, body bent far back, head thrown back, one foot lifted off the ground'),
                     ('airUp', 'launched up into the air by a hit: body arched backward and rising, arms and legs flung out, clearly airborne high above the ground'),
                     ('tumble', 'tumbling helplessly in mid-air upside down in an uncontrolled backward flip, head pointing down, airborne'),
                     ('bounce', 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air'),
                     ('held', 'lifted off the ground by an invisible force as if grabbed by the collar: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person, NO hand holding her'),
                     ('tech', 'quick recovery: crouched low on one knee in a defensive guard, ready to spring up'),
                     ('charge', 'charging power: crouched in a low wide stance gripping the katana with both hands at the hip, focused'),
                     ('jatk4', 'mid-air horizontal slash: airborne with knees tucked up, katana swept horizontally forward at chest height')],
    'gun_react2': [('hit3', 'hit hard: knocked backward off balance, body bent far back, head thrown back, one foot lifted off the ground'),
                   ('airUp', 'launched up into the air by a hit: body arched backward and rising, arms and legs flung out, clearly airborne high above the ground'),
                   ('tumble', 'tumbling helplessly in mid-air upside down in an uncontrolled backward flip, head pointing down, airborne'),
                   ('bounce', 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air'),
                   ('held', 'lifted off the ground by an invisible force as if grabbed by the collar: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person, NO hand holding her'),
                   ('tech', 'quick recovery: crouched low on one knee, revolver ready, about to spring up'),
                   ('charge', 'aiming carefully with the revolver in both hands at arm length, charging a powerful shot'),
                   ('jatk4', 'mid-air firing the revolver straight forward with the arm fully extended, airborne with knees tucked')],
    'mage_react2': [('hit3', 'hit hard: knocked backward off balance, body bent far back, head thrown back, one foot lifted off the ground'),
                    ('airUp', 'launched up into the air by a hit: body arched backward and rising, arms and legs flung out, clearly airborne high above the ground'),
                    ('tumble', 'tumbling helplessly in mid-air upside down in an uncontrolled backward flip, head pointing down, airborne'),
                    ('bounce', 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air'),
                    ('held', 'lifted off the ground by an invisible force as if grabbed by the collar: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person, NO hand holding her'),
                    ('tech', 'quick recovery: crouched low on one knee holding the staff, about to spring up'),
                    ('charge', 'charging magic: staff held forward in both hands, crystal glowing brightly, hair floating upward'),
                    ('jatk4', 'mid-air swinging the staff horizontally forward, airborne with knees tucked')],
    # ---- 鬼剑士：基础技能 / 剑魂 / 狂战士 ----
    'sword_sk1': [('ghost1', 'ghost slash wind-up: the left arm glowing with an eerie purple ghost aura, katana pulled back low behind the body'),
                  ('ghost2', 'ghost slash: a huge diagonal slash swung down in front, the left arm glowing purple'),
                  ('rip1', 'rising thrust: lunging forward and thrusting the katana diagonally upward'),
                  ('rip2', 'katana raised straight up above the head pointing to the sky, energy bursting in a ring around the body'),
                  ('cross1', 'first slash of a cross slash: katana swung from high behind to low in front'),
                  ('cross2', 'second slash of a cross slash: katana swung the other way from low to high, arms crossed in front'),
                  ('guard', 'guarding: blocking with the katana held horizontally in front of the body with both hands, feet planted firmly'),
                  ('silver', 'dropping down from the air: body upright and airborne, both hands gripping the katana pointing straight down below the feet')],
    'sword_blade': [('phantom1', 'blade dance: slashing fast in a blur, katana swung high above in front'),
                    ('phantom2', 'blade dance: slashing low across the body, torso twisted, fast motion'),
                    ('leap1', 'leaping forward high in the air with the katana raised overhead in both hands'),
                    ('leap2', 'landing strike: crouched low after landing, katana stabbed point-down into the ground in front'),
                    ('dragon', 'dashing forward in a very low long lunge, katana extended horizontally behind the body after cutting through'),
                    ('backslash', 'backflip slash: flipping backward in the air while slashing the katana downward in front'),
                    ('awkB1', 'ultimate: katana raised straight up to the sky in one hand, the other hand open forward, powerful stance, coat flowing'),
                    ('atk4', 'spinning horizontal slash: body turned around with the katana sweeping at waist height')],
    'sword_bz': [('roar', 'berserk roar: head thrown back roaring with fists clenched, crimson fury'),
                 ('grab1', 'reaching out: the left hand thrust far forward with fingers spread like a claw glowing red, katana held back'),
                 ('grab2', 'the left hand raised high clenched in a fist glowing red as if choking someone in the air, katana held low'),
                 ('burst', 'rage explosion: crouched low with both arms spread outward, bursting with red energy'),
                 ('bladeW', 'blood blade: a big rising diagonal slash, katana glowing crimson'),
                 ('quake1', 'leaping high with the katana raised overhead in both hands about to smash down, crimson glow'),
                 ('bzAwk1', 'holding the katana high overhead with both hands, the blade glowing blood-red with huge energy'),
                 ('bzAwk2', 'slamming the glowing blood-red katana down into the ground in front with full force')],
    # ---- 神枪手：基础技能 / 漫游枪手 / 枪炮师 ----
    'gun_sk1': [('knee1', 'knee strike wind-up: stepping in low with the knee chambered'),
                ('knee2', 'flying knee strike: the knee driven sharply upward, body rising off the ground'),
                ('flash', 'snap front kick: one leg kicked straight forward at chest height, very fast'),
                ('stomp1', 'jumping forward to stomp, one foot extended forward and down, airborne'),
                ('stomp2', 'standing with one foot stomping down on something low while aiming the revolver straight down and firing'),
                ('bbq', 'firing a heavy gatling gun diagonally upward into the air with both hands, leaning back'),
                ('kick3', 'high roundhouse kick: body turned, one leg swinging around at head height'),
                ('silver', 'firing a single glowing silver bullet forward with the revolver held in both hands')],
    'gun_ranger': [('move1', 'walking forward while firing the revolver forward one-handed, near leg stepping forward'),
                   ('move2', 'walking forward while firing the revolver forward one-handed, far leg stepping forward'),
                   ('dual', 'firing two revolvers straight forward at once, both arms extended'),
                   ('backshot', 'firing the revolver backward over the shoulder without looking, cool smirk'),
                   ('multi', 'aiming the revolver precisely forward with one eye closed, laser-focused'),
                   ('crazy1', 'stamping the ground hard with one foot, both revolvers raised'),
                   ('crazy2', 'spinning in mid-air firing two revolvers outward in both directions, airborne'),
                   ('crazy3', 'landing in a crouch firing two revolvers wildly forward')],
    'gun_launcher': [('cannon1', 'hoisting a huge cartoon hand cannon onto the shoulder, aiming forward'),
                     ('cannon2', 'firing the huge shoulder cannon with a big recoil, leaning back'),
                     ('flame', 'spraying a flamethrower held at the hip with both hands, leaning forward'),
                     ('laser1', 'kneeling and charging a big laser cannon held in both hands, the muzzle glowing'),
                     ('laser2', 'firing the big laser cannon while kneeling, strong recoil'),
                     ('quantum', 'pressing the button of a small remote detonator held up in one hand with a grin'),
                     ('lAwk1', 'bracing behind an enormous heavy artillery cannon held at the hip, aiming forward'),
                     ('lAwk2', 'firing the enormous heavy cannon with a massive blast recoil, hair blown back')],
    # ---- 魔法师：基础技能 / 元素师 / 战斗法师 ----
    'mage_sk1': [('sky1', 'crouching low with the staff held down at the side, about to swing it up'),
                 ('sky2', 'swinging the staff sharply upward overhead in a rising strike, hopping slightly'),
                 ('jack1', 'holding a glowing cartoon jack-o-lantern pumpkin bomb up overhead with the free hand, staff in the other hand'),
                 ('jack2', 'throwing the jack-o-lantern pumpkin bomb forward, throwing arm extended'),
                 ('summon', 'kneeling on one knee touching the staff crystal to the ground, summoning'),
                 ('palm2', 'strong forward palm strike: one palm thrust far forward, flower petals flying, staff held back'),
                 ('eel', 'one hand raised high crackling with electricity, staff held low'),
                 ('cast3', 'pointing the staff forward with both hands releasing a magic bolt')],
    'mage_elem': [('flameC', 'thrusting the staff down toward the ground far ahead, fiery glow on the crystal'),
                  ('thunder', 'pointing the staff straight up to the sky calling lightning, hair standing up'),
                  ('wall', 'planting the staff firmly into the ground with both hands, frost swirling upward'),
                  ('jackfall', 'both arms raised to the sky summoning something huge, staff raised high'),
                  ('void1', 'holding a dark purple energy orb between both hands in front of the chest'),
                  ('void2', 'pushing the dark purple orb forward with both palms'),
                  ('mAwk1', 'ultimate: levitating above the ground with arms spread wide, staff raised, glowing'),
                  ('mAwk2', 'ultimate: pointing the staff forward and down commanding, hair and skirt blown back')],
    'mage_battle': [('fang1', 'crouched low with the staff pulled back like a spear, ready to thrust'),
                    ('fang2', 'lunging forward with a long straight thrust of the staff like a spear'),
                    ('bmLeap1', 'leaping high into the air with the staff raised overhead'),
                    ('bmLeap2', 'diving down diagonally from the air staff-first'),
                    ('smash1', 'swinging the staff upward in a rising uppercut arc'),
                    ('smash2', 'smashing the staff down overhead into the ground'),
                    ('chaser', 'flicking the fingers of the free hand forward launching small glowing orbs, staff held back'),
                    ('bmAwk', 'fierce battle stance with the staff spun behind the back, glowing golden aura')],
}
# 鬼剑士五个转职的新表 / 特效 / 图标 / 插图（art/tools/sword_art.py）
try:
    import sword_art as _SWA
    SHEETS.update(_SWA.SHEETS)
    HOLD.update(_SWA.HOLD)
except ImportError: _SWA = None
NO_HOLD = {'gun_launcher'}   # 枪炮师拿的是重武器，不强调左轮

def sheet_jobs():
    L = []
    for name, frames in SHEETS.items():
        char = name.split('_')[0]
        hold = None if name in NO_HOLD else HOLD[char]
        L.append({'out': os.path.join(OUT, 'sheets', f'{name}.png'), 'ref': os.path.join(SRC, f'{char}_ref.png'),
                  'prompt': sheet_prompt([d for _, d in frames], hold), 'size': '2048x2048', 'model': 'gpt-image-2.5-sunburst'})
    return L

# ---- 技能图标（与 art/tools/jobs.py 的图标表同一画风）----
ICON_STYLE = ('cute cartoon mobile RPG icon style, bold clean outlines, bright saturated colors, soft shading, glossy and polished; '
              'every icon is a rounded square tile with its own colored background and a thick dark border')
ICON_LIST = [   # (技能 id, 图标描述)；16 个一张表，依次为 cskills_a..d
    ('ghost', 'a sword slash wreathed in eerie purple ghost flame with a faint ghost face'), ('guard', 'a katana held horizontally blocking with a blue shield flash'),
    ('silver', 'a sword plunging straight down from above with a silver shockwave on the ground'), ('aircut', 'two crossing sword slashes in the sky with small clouds'),
    ('dashthrust', 'a sword thrusting forward repeatedly with speed lines'), ('rip', 'a sword thrust upward with a ring of blue energy waves bursting outward'),
    ('cross', 'a glowing blood-red cross-shaped slash mark'), ('backslash', 'a swordsman silhouette flipping backward while slashing with a cyan arc'),
    ('rikiken', 'three overlapping silver sword slashes with a faint ghost aura'), ('flow', 'a calm flowing water swirl around a sheathed katana'),
    ('flow_stab', 'a sword piercing forward through a water ripple'), ('flow_leap', 'a sword striking down from a high leap with a splash of water'),
    ('flow_rise', 'a sword slashing upward in a flowing water arc'), ('flow_frenzy', 'a katana glowing with a fierce blue flowing aura'),
    ('dragon', 'a blue dragon made of sword energy dashing forward'), ('phantom', 'many phantom sword slashes swirling in a circle'),
    ('frenzy', 'a red demonic eye with a blood-red aura'), ('bloodwake', 'a cracked red heart glowing with power'),
    ('soulhand', 'a crimson demonic claw hand grabbing'), ('rampage', 'a roaring red flame aura around a clenched fist'),
    ('outrage', 'a crimson explosion bursting from the ground'), ('bloodblade', 'a crimson sword thrust with a blood crescent of energy'),
    ('quake', 'a sword smashing the ground erupting with lava'), ('bz_awaken', 'a giant blood-red demonic sword with a glowing skull'),
    ('g_launch', 'a glowing bullet flying upward with an arrow pointing up'), ('g_stomp', 'a boot stomping down with a revolver firing downward'),
    ('g_m3', 'a flamethrower blasting fire'), ('g_flash', 'a fast front kick boot with impact stars'),
    ('g_bbq', 'a gatling gun firing upward with flames and a sizzling steak'), ('g_silver', 'a shining silver bullet with holy light'),
    ('g_revmaster', 'two crossed silver revolvers with a gold star'), ('g_moving', 'running boots with a revolver firing forward'),
    ('g_multi', 'three red crosshairs locked on targets'), ('g_awaken', 'a blood-red rose with revolvers and flying bullets'),
    ('gl_cannon', 'a big black hand cannon firing a shell'), ('gl_antitank', 'an anti-tank shell exploding with fire'),
    ('gl_laser', 'a thick blue laser beam cannon'), ('gl_flame', 'a focused flamethrower nozzle with a narrow blue-white fire jet'),
    ('gl_fm31', 'five grenades arcing through the air from a launcher'), ('gl_quantum', 'a glowing blue quantum bomb falling from a satellite'),
    ('gl_x1', 'a compressed swirling blue energy cannon shot sucking in debris'), ('gl_awaken', 'an enormous ancient particle cannon firing a golden beam'),
    ('mg_sky', 'a magic staff striking upward with a burst of light'), ('mg_jack', 'a cute jack-o-lantern pumpkin bomb exploding'),
    ('mg_eel', 'three glowing electric eel orbs circling'), ('mg_fang', 'a staff thrust forward like a dragon fang with a white flash'),
    ('mg_shield', 'a glowing blue magic barrier shield bubble'), ('mg_cat', 'a sly shadow black cat pouncing with a purple glow'),
    ('mg_snowman', 'a cute snowman with a blue scarf and frost'), ('mg_palm', 'an open palm strike with pink cherry blossom petals'),
    ('mg_void', 'a dark purple void sphere with swirling energy'), ('mg_icewall', 'a wall of sharp ice crystals'),
    ('mg_vortex', 'yellow lightning orbs spinning in a circle'), ('mg_jackfall', 'a giant jack-o-lantern falling from the sky with a fire trail'),
    ('mg_icefeast', 'many ice pillars falling inside a magic circle'), ('bm_chaser', 'small glowing golden orbs orbiting a battle staff'),
    ('bm_round', 'a staff spinning in a circle flinging an enemy silhouette overhead'), ('bm_fusion', 'two glowing orbs fusing into one bright star'),
    ('bm_smash', 'a staff smashing down in a wide arc with a shockwave'), ('bm_flash', 'rapid staff thrusts with meteor-like streaks'),
    ('bm_press', 'glowing orbs slamming down onto the ground in an explosion'), ('bm_raid', 'a meteor-like dashing staff strike with a blazing trail'),
    ('bm_dragon', 'a golden dragon emerging from a staff tip with a crescent moon'), ('bm_awaken', 'a fierce warrior goddess silhouette with a golden dragon aura'),
]
ICON_SHEETS = {f'cskills_{c}': ICON_LIST[i * 16:(i + 1) * 16] for i, c in enumerate('abcd')}
if _SWA: ICON_SHEETS.update({f'sword_icons_{c}': _SWA.ICONS[i * 16:(i + 1) * 16] for i, c in enumerate('abcdefgh') if _SWA.ICONS[i * 16:(i + 1) * 16]})
def icon_prompt(items):
    return (f'A sprite sheet of {len(items)} separate game icons arranged in a grid of 4 columns and {len(items) // 4} rows on a plain pure white background, '
            f'evenly spaced with generous white gaps between icons, no icon touching another, {ICON_STYLE}. In reading order (left to right, top to bottom): '
            + '; '.join(f'({i + 1}) {t}' for i, t in enumerate(items)) + '. No text, no numbers, no labels.')

FXS = 'cute cartoon 2D mobile game VFX sprite, hand-painted, bold clean shapes, vibrant saturated colors, polished'
GLOW = f'{FXS}. On a pure solid black background, a single isolated effect centered with empty black margin around it, nothing else, no text, no border.'
SOLID = f'{FXS}, thick dark outline, soft cel shading. Plain pure white background, a single isolated object centered, no shadow, no text.'
T, Wd, Sq = '1024x1536', '1536x1024', '1024x1024'
FX = {   # 名字: (描述, 尺寸, 发光?)
    'ghost': ('A single ghostly slash: a huge diagonal crescent of eerie violet and dark purple ghost flame with wisps and a faint skull-like smoke shape, fading tail', Sq, True),
    'crossx': ('A single glowing cross-shaped slash mark: two thick crimson and white slash lines crossing in a big X, with blood-red glow and small sparks', Sq, True),
    'swordrain': ('A single glowing spectral sword pointing straight DOWN: a long translucent cyan-white blade of light with a glowing hilt at the top, vertical tall narrow composition', T, True),
    'bloodwave': ('A single crimson blood-energy crescent wave moving to the RIGHT: a tall curved blade of dark red and bright red energy with dripping particles, tall narrow composition', T, True),
    'bloodhand': ('A single spectral demonic claw hand reaching to the RIGHT: a translucent glowing crimson red hand with long sharp fingers spread open, wisps of red smoke trailing to the left', Wd, True),
    'bloodpillar': ('A single tall vertical pillar of crimson blood energy erupting from the ground: dark red and bright scarlet flames and sparks, wide at the bottom, tall narrow composition', T, True),
    'lava': ('A single eruption of molten lava bursting up from cracked ground: orange and yellow magma splashes and glowing rocks, wide low composition', Wd, True),
    'dragonfang': ('A single piercing dragon-shaped energy thrust pointing RIGHT: a golden-white spear of light shaped like a roaring dragon head at the right tip, trailing sparks to the left', Wd, True),
    'chaser': ('A single small glowing magic orb with a bright white core and a thin ring of golden-yellow light around it, soft glow', Sq, True),
    'laser': ('A single horizontal laser beam segment: a thick bright cyan-white core with electric blue glow edges, perfectly straight and horizontal, filling the width, wide flat composition', Wd, True),
    'flame': ('A single horizontal stream of flamethrower fire blasting to the RIGHT: bright yellow-white near the left nozzle, widening into orange and red billowing flames to the right', Wd, True),
    'shell': ('A single cartoon artillery cannon shell flying to the RIGHT with a bright orange fire trail behind it to the left', Wd, True),
    'quantum': ('A single glowing blue quantum energy sphere with electric arcs and a white hot core, sci-fi', Sq, True),
    'darkorb': ('A single dark void energy sphere: a black core with swirling deep purple and magenta energy and sparkles', Sq, True),
    'icewall': ('A single wall of sharp ice crystals rising from the ground: a cluster of tall light-blue translucent ice spikes, wide composition', Wd, False),
    'jack': ('A single cute cartoon jack-o-lantern pumpkin bomb with a glowing carved face and a short lit fuse on top', Sq, False),
    'jackbig': ('A single giant cute cartoon jack-o-lantern pumpkin with a glowing carved grinning face and a huge lit fuse, glowing orange', Sq, False),
    'snowman': ('A single cute cartoon snowman with a carrot nose, stick arms and a small blue scarf, standing', Sq, False),
    'eel': ('A single glowing electric eel made of bright yellow-white lightning, curved S shape, with sparks', Sq, True),
    'petal': ('A single swirl of pink cherry blossom petals and soft pink magic light, flowing to the RIGHT', Wd, True),
    'thunderbolt': ('A single thick vertical lightning bolt striking straight down from the top edge to the bottom edge: jagged bright white core with deep blue and violet glow, a burst of electricity at the bottom, tall narrow composition', T, True),
    'elemmeteor': ('A single flaming meteor with a swirling rainbow of fire, ice, lightning and dark energy trail, falling diagonally from the top-left toward the bottom-right', Sq, True),
}

# 转职觉醒插图（HUD 的觉醒 cut-in）：和职业插图同一画风，按转职区分
CUTIN = {
    'blade': ('sword', 'summoning a storm of glowing spectral swords around him, katana raised, cyan sword light, determined expression'),
    'berserker': ('sword', 'eyes glowing red with a fierce berserk grin, the katana blazing with blood-red energy, crimson aura and blood sparks'),
    'ranger': ('gun', 'twin silver revolvers crossed in front of her face with a confident smirk, red rose petals and flying bullets around'),
    'launcher': ('gun', 'shouldering an enormous glowing golden ancient particle cannon, fierce grin, hair blown back by the blast'),
    'elemental': ('mage', 'arms raised summoning meteors of fire, ice, lightning and darkness from a huge glowing magic circle'),
    'battlemage': ('mage', 'fierce battle stance swinging the staff, a golden dragon aura and small glowing orbs circling her'),
}
if _SWA: FX.update(_SWA.FX); CUTIN.update(_SWA.CUTIN)
def cutin_jobs():
    return [{'out': os.path.join(OUT, 'cutin', f'{j}.png'), 'ref': os.path.join(SRC, f'{c}_ref.png'), 'size': '1536x1024', 'model': 'gpt-image-2.5-sunburst',
             'prompt': f'Using this exact chibi character (same design, same colors, same cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Plain pure white background, no text.'}
            for j, (c, d) in CUTIN.items()]
def cutin_prep():
    """觉醒插图：去白底 → 720×480 → art/final/cutin/<转职>.webp"""
    from prep import remove_bg
    from PIL import Image
    out = os.path.join(HERE, 'final', 'cutin'); os.makedirs(out, exist_ok=True)
    for j in CUTIN:
        p = os.path.join(OUT, 'cutin', f'{j}.png')
        if not os.path.exists(p): print('missing', j); continue
        im = remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS); f = os.path.join(out, f'{j}.webp')
        im.save(f, 'WEBP', quality=82, method=6); print(j, os.path.getsize(f) // 1024, 'KB')

def run(job):
    out = job['out']
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    t = time.time(); err = ''
    for attempt in range(5):
        try:
            if job.get('ref'):
                base, key, _ = SH.gi.load_cfg()
                url = SH.upload(base, key, job['ref'])
                payload = {'model': job.get('model') or 'gpt-image-2.5-sunburst', 'prompt': job['prompt'], 'n': 1, 'size': job['size'], 'quality': 'high', 'response_format': 'b64_json', 'image': [url]}
                resp = SH.gi.post_json(f'{base}/images/generations', key, payload, 900); SH.gi.save_images(resp, out, False, False)
            else:
                cmd = ['python3', GI, 'gen', job['prompt'], '-o', out, '-s', job['size'], '-q', 'high'] + (['-m', job['model']] if job.get('model') else [])
                r = subprocess.run(cmd, capture_output=True, text=True)
                if r.returncode != 0 or not os.path.exists(out): raise SystemExit(r.stderr[-300:] or r.stdout[-300:])
            return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        except SystemExit as e:
            err = str(e); time.sleep(65 if '429' in err else 8 + attempt * 5)
    return f'FAIL {os.path.basename(out)}: {err[:200]}'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default=''); ap.add_argument('-j', type=int, default=3); a = ap.parse_args()
    if a.phase == 'sheets': L = sheet_jobs()
    elif a.phase == 'icons':
        L = [{'out': os.path.join(OUT, 'icons', f'{n}.png'), 'prompt': icon_prompt([d for _, d in items]), 'size': '2048x2048' if len(items) > 12 else '2048x1536'} for n, items in ICON_SHEETS.items()]
    elif a.phase == 'fx':
        L = [{'out': os.path.join(OUT, 'fx', f'{n}.png'), 'prompt': f'{d}. {GLOW if g else SOLID}', 'size': sz} for n, (d, sz, g) in FX.items()]
    elif a.phase == 'cutin': L = cutin_jobs()
    elif a.phase == 'cutinprep': cutin_prep(); return
    else: raise SystemExit('phase: sheets | icons | fx | cutin | cutinprep')
    L = [j for j in L if os.path.basename(j['out']).startswith(a.only)]
    print(f'{len(L)} jobs', flush=True)
    with ThreadPoolExecutor(min(3, a.j)) as ex:
        for f in as_completed([ex.submit(run, j) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
