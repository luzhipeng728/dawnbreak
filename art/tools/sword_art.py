#!/usr/bin/env python3
"""鬼剑士（男）五个转职的美术数据：新动作表、特效、技能图标、转职立绘 / 觉醒插图、剑影的幻鬼。
数据由 combatgen.py（sheets / fx / icons / cutin）和 avatar_gen.py（wpn 的双持说明）在导入时合并，
所以出图、切帧、时装流水线的用法不变：
  combatgen.py sheets --only sword_wm        → art/src/combat/sheets/sword_wm.png
  avatar_gen.py wpn --only sword_wm           → art/src/avatar/sheets/sword_wm.png（武器换成绿色占位棍）
  avatar_gen.py set --only academy/sword_wm   → art/src/avatar/sets/academy/sword_wm.png（6 套时装各一次）
  avatar_frames.py sword_wm [--set academy]   → art/final/spr/sword[@套装]/
幻鬼（剑影的伙伴，独立精灵、不走时装和占位棍）：
  sword_art.py ghostref                       → art/src/combat/ghost/phantom_ref.png
"""
import os, sys

# 每张表 8 帧（第 1 格站姿参考由 sheets2.prompt 自动加）：(帧名, 描述)；人物一律面朝右
SHEETS = {
    # ---- 剑魂：里·鬼剑术（现版“第二套普攻”，按武器缩放）、破军斩龙击肩撞、拔刀回旋、流星落 / 破空斩（P1 先画好）----
    'sword_wm': [('rk1', 'second-style slash: stepping in low and cutting horizontally forward at chest height, katana extended forward, torso twisted into the cut'),
                 ('rk2', 'second-style backhand slash: body spun around with the back half turned to the viewer, katana swept backhand at waist height, coat flaring out'),
                 ('rk3', 'second-style rising cut: hopping slightly off the ground and cutting diagonally upward, katana ending high above the head in front'),
                 ('rk4', 'second-style heavy chop: both hands on the katana swinging it straight down to the ground in front, knees bent low, body leaning forward'),
                 ('rush1', 'shoulder tackle: charging forward shoulder-first, body low and leaning hard into the charge, katana held back low behind the body'),
                 ('iaiSpin', 'after a lightning-fast quick draw: body spun a full circle, katana swept flat all the way around at waist height, low wide stance, coat whirling'),
                 ('meteorAim', 'high up in the air above the ground, body tilted forward looking down at a target below, katana pointed straight down, coat flying upward'),
                 ('hakuu', 'crouched very low in a deep quick-draw stance, one hand gripping the hilt at the left hip, eyes glowing, body coiled like a spring')],
    # ---- 狂战士：狂暴之力二刀流普攻、狂热回旋、饥渴蓄力、嗜魂封魔斩、暴怒狂斩 ----
    'sword_bz2': [('dual1', 'dual wielding with a katana in EACH hand: crossing both katanas in an X slash in front of the chest, wild grin'),
                  ('dual2', 'dual wielding with a katana in EACH hand: both arms swung wide apart outward after a double slash, body leaning forward'),
                  ('dual3', 'dual wielding with a katana in EACH hand: one katana raised high overhead, the other thrust low forward, stepping in'),
                  ('dual4', 'dual wielding with a katana in EACH hand: spinning slash, both katanas swept around at waist height, coat flaring'),
                  ('whirl', 'sweeping the katana in a huge low horizontal circle around the body, crouched, pulling enemies in, crimson glow'),
                  ('thirst', 'hunched forward clutching the chest with the free hand, katana dragging on the ground, gritting teeth, crimson aura rising'),
                  ('twister', 'katana raised straight up over the head spinning a crimson whirlwind above, feet planted wide'),
                  ('enrage', 'dual wielding with a katana in EACH hand: leaping in mid-air slashing both katanas wildly downward, berserk expression')],
    # ---- 阿修罗：波动爆发推掌、鬼印珠、插剑放波动剑（冰刃 / 爆炎）、邪光斩、无双波吸引、不动明王阵结印、波动刻印 / 无尽波动 ----
    'sword_asura': [('asBurst', 'the free hand thrust forward with the palm wide open as if releasing a powerful push, the katana held low behind in the other hand, feet planted wide, no visual effects'),
                    ('asOrb1', 'holding a small round orb up beside the head in the free hand, about to throw it, the katana held low, no visual effects'),
                    ('asOrb2', 'having just thrown something forward with the free hand, throwing arm fully extended forward, the katana held back, no visual effects'),
                    ('asPlant', 'crouched low stabbing the katana point-down into the ground in front with both hands, head lowered, no visual effects'),
                    ('asEvil', 'swinging the katana diagonally upward in a huge wide arc, body stretched and following through high, no visual effects'),
                    ('asPull', 'the free hand stretched far forward with fingers clawed as if pulling something toward him, leaning back, the katana held low behind, no visual effects'),
                    ('asSeal', 'kneeling on one knee, the free hand held up in front of the face in a one-handed prayer seal, the katana planted upright in the ground beside him, no visual effects'),
                    ('asAura', 'standing tall and calm with the head slightly lowered, the free hand raised in front of the chest in a one-handed prayer seal, the katana held down at the side, no visual effects')],
    # ---- 剑影的幻鬼（独立伙伴精灵，参考图 art/src/phantom_ref.png = sword_art.py ghostref 的输出；切帧用 frames2.py phantom --src art/src/combat/sheets）----
    'phantom_a': [('pdash1', 'lunging forward in a very low fast dash, the glowing katana thrust straight ahead, smoke trailing behind'),
                  ('pdash2', 'finished a dashing slash: body far forward, the glowing katana swept back behind after cutting through'),
                  ('prend1', 'fast downward diagonal slash with the glowing katana, body leaning in'),
                  ('prend2', 'fast backhand horizontal slash with the glowing katana at chest height, coat flaring'),
                  ('prend3', 'rising upward slash lifting off the ground, the glowing katana ending high above the head'),
                  ('pspin1', 'spinning horizontal slash: body twisted around, the glowing katana sweeping at waist height, ghostly smoke whirling'),
                  ('pspin2', 'mid-spin with the back half turned, the glowing katana trailing a circular arc of blue light'),
                  ('pfloat', 'floating calmly a little above the ground, the glowing katana held low, smoke drifting from the legs')],
    'phantom_b': [('piai1', 'crouched in a deep quick-draw stance, hand on the hilt of the sheathed glowing katana at the hip, legs bent and wrapped in smoke wisps'),
                  ('piai2', 'just finished a wide quick-draw slash: low lunge, the glowing katana extended far forward, legs wrapped in smoke wisps'),
                  ('pdive1', 'high in the air above, both hands raising the glowing katana overhead, about to chop straight down, legs tucked and trailing smoke'),
                  ('pdive2', 'landed chop: crouched, the glowing katana driven down into the ground in front, a burst of blue smoke around the legs'),
                  ('pseal', 'thrusting the free hand forward holding a glowing paper talisman seal, the katana held back, legs wrapped in smoke wisps'),
                  ('pcross', 'crossing slash: the glowing katana swung diagonally down across the body, eyes glowing through the mask, legs wrapped in smoke wisps'),
                  ('pvanish', 'transition frame, vanishing: the same standing body breaking apart into drifting blue ghost smoke, the legs and lower body already turned into smoke, the upper body half transparent and dissolving into wisps'),
                  ('pappear', 'transition frame, appearing: the body forming out of a swirl of blue ghost smoke, crouched low, the legs still made of smoke, the glowing katana held ready')],
}
HOLD = {'phantom': 'holding the long glowing katana'}

# 双持表：avatar_gen.py wpn 的额外说明（两把刀都换成占位棍）
AVATAR_NOTES = {
    'sword_bz2': 'Frames 2, 3, 4, 5 and 9 show TWO katanas, one in each hand: replace BOTH of them with green sticks (two sticks). ',
}

T_, WD_, SQ_ = '1024x1536', '1536x1024', '1024x1024'
FX = {   # 名字: (描述, 尺寸, 发光?)；随各阶段补充（发光类黑底，fxprep.py 转透明度）
    'fudo': ('A single wrathful guardian deity (Acala, Fudo Myo-o) made entirely of translucent blue and violet flame energy: a muscular fierce figure standing with a straight sword held upright in the right hand and a coiled rope in the left, a large ring of blue flames behind the head, fierce glowing eyes, his lower body fading into rising blue flames, front view, tall composition', T_, True),
}
ICONS = [   # (技能 id, 图标描述)；16 个一张，表名 sword_icons_a..（第 1 阶段 17 个 + 第 2 批觉醒前后的技能）
    ('kazan', 'a fierce red ghost demon head with horns floating above a glowing red rune circle'), ('moon', 'a violet crescent moon shaped sword slash with a small rising slash'),
    ('wm_saber', 'a glowing golden lightsaber blade with a crackle of light'), ('wm_arcana', 'five different swords (katana, short sword, greatsword, club, lightsaber) fanned out in a circle'),
    ('wm_mind', 'a calm swordsman silhouette meditating with a soft cyan sword aura rising'), ('wm_autoguard', 'a katana blocking automatically with a blue hexagon shield and a small upward arrow'),
    ('wm_edge', 'a katana blade being sharpened with bright white sparks and a gleam of light on the edge'), ('wm_reverse', 'a sword swinging around behind with a curved turning arrow'),
    ('wm_dragonrush', 'an orange shoulder charge silhouette followed by rapid sword thrusts and an upward dragon-shaped slash'), ('bz_vigor', 'dripping crimson blood drops around a sword with a pulsing red glow'),
    ('bz_madness', 'two crossed crimson swords slashing wildly with red scratch marks'), ('bz_defy', 'a cracked red heart being held together by a glowing hand, refusing death'),
    ('bz_scratch', 'two red blades crossing in an X slash with claw-like red streaks'), ('bz_whirl', 'a crimson circular sword sweep pulling small silhouettes into the center'),
    ('bz_thirst', 'a blood-red fanged mouth made of red mist above a pool of blood'), ('bz_enrage', 'four crimson slash marks hanging in the air about to explode'),
    ('bz_twister', 'a blood-red whirlwind tornado with a sword rising out of it'), ('wm_zantetsu', 'a katana splitting a steel block cleanly in half with a white flash'),
    ('wm_meteor', 'dozens of glowing swords raining down from the sky like meteors onto a target reticle'), ('wm_kuubatto', 'a quick-draw slash releasing a huge round crescent sword wave flying forward'),
    ('wm_shinken', 'five ghostly legendary swordsman silhouettes standing behind a glowing sword'), ('wm_hakuu', 'a sword stance with glowing target marks on distant enemies and a sky-splitting slash'),
    ('wm_shunzan', 'a flying spectral sword dashing through enemies leaving five cyan slash lines'), ('wm_awaken2', 'a storm of hundreds of flying glowing swords circling in the sky'),
    ('wm_formless', 'an invisible sword outlined only by shimmering light distortion'), ('wm_mukei', 'a translucent invisible sword slashing inside a glowing square area'),
    ('wm_awaken3', 'a giant radiant sword of light splitting the heavens with five weapons merging into it'), ('bz_memory', 'a red blood drop with a glowing eye and faint memories of battle'),
    ('bz_snatch', 'a crimson hand grabbing and slamming a silhouette into the ground with a blood burst'), ('bz_surge', 'a crimson blood shield bubble with a red heartbeat line'),
    ('bz_crusher', 'a massive blood-red sword slamming down into the ground with a huge crimson explosion'), ('bz_incarnate', 'a demonic crimson armor shape forming from swirling blood'),
    # 阿修罗（第 2 阶段）+ 狂战士 P1 两个
    ('as_mark', 'five small glowing violet energy orbs circling around a closed eye symbol'), ('as_orb', 'a spinning violet energy orb with rune rings around it flying forward'),
    ('as_sense', 'a black blindfold with a white X mark and faint violet ripples spreading around it'), ('as_evil', 'a huge violet crescent sword wave rising from the ground'),
    ('as_evil_c', 'a charged violet crescent sword wave with speed lines and a bright core'), ('as_will', 'a cracked violet shield glowing with determination and an upward arrow'),
    ('as_burst', 'a violet energy explosion bursting outward from a palm'), ('as_aura', 'a ring of dark violet killing-intent aura with flames around a silhouette'),
    ('as_ice', 'a row of sharp light-blue ice spikes erupting from the ground in a line'), ('as_fire', 'a chain of orange fire explosions bursting along the ground'),
    ('as_musou', 'a violet energy rift vortex pulling small silhouettes inward'), ('as_array', 'a glowing violet hexagram magic circle on the ground with rising waves'),
    ('as_fudo', 'a wrathful blue flame guardian deity holding an upright sword above a glowing seal circle'), ('as_awaken', 'a giant eye opening in a dark violet sky with countless small eyes around it'),
    ('bz_boom', 'a massive crimson blood explosion centered on a kneeling silhouette'), ('bz_fatal', 'two quick crimson slashes and one giant crossing blood-red slash'),
]
FXPREP = {'glow': {'fudo': 384}, 'solid': {}}   # fxprep.py --combat 的输出尺寸（最长边像素）
CUTIN = {   # 转职: ('sword', 描述)
    'asura': ('sword', 'eyes covered by a black cloth blindfold with a white X-shaped seal mark, calm and fierce, one open palm pushed toward the viewer releasing swirling blue-violet wave energy, katana held low, ripples of energy in the air'),
}
# 转职立绘（转职窗口）：以鬼剑士立绘为参考，输出 art/src/quests/job_<转职>.png，再用 job_art.py 去背缩放到 art/final/job/
JOBART = {
    'asura': 'the Asura advancement: a black cloth blindfold tied over both eyes with a white X-shaped seal mark on it, heavy dark steel plate armor with violet trims over a dark indigo coat, a torn dark half cape, calm expression, holding the katana low in one hand while the other open palm releases a swirling blue-violet wave energy aura with faint ripples',
}

# ---- 剑影的幻鬼：独立的伙伴角色（不换武器、不换时装），先出设定立绘，再按立绘出动作表 ----
PHANTOM = ('a chibi ghost swordsman spirit in exactly the same cute chibi art style, proportions and thick outlines as this character, but a DIFFERENT character: '
           'a tall slender masked ghost warrior with pale blue-grey skin, long flowing white hair tied loosely at the back, a cracked white oni half-mask covering the upper face with glowing cyan eyes behind it, '
           'a tattered dark indigo and black kimono-style long coat with torn edges trailing into wisps of blue ghost smoke at the hem, bare pale forearms, '
           'holding a long katana with a pale glowing cyan blade in the right hand; his lower legs fade into drifting blue smoke. '
           'Full body, strict side view facing right, standing in a calm ready stance. Plain pure white background, no text.')

def ghost_jobs():
    from combatgen import SRC, OUT
    return [{'out': os.path.join(OUT, 'ghost', 'phantom_ref.png'), 'ref': os.path.join(SRC, 'sword_ref.png'), 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst',
             'prompt': 'Using this chibi character only as the art style reference, draw ' + PHANTOM}]

# 幻鬼个别帧生图时画得偏大（头身比例对不上其他帧）：切帧后再按比例缩小，锚点一起缩放
PHANTOM_SCALE = {'pfloat': 0.94, 'prend3': 0.94}
def phantom_fix():
    import json
    from PIL import Image
    d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'final', 'spr', 'phantom')
    meta = json.load(open(os.path.join(d, 'spr.json')))
    for fn, k in PHANTOM_SCALE.items():
        F = meta['frames'].get(fn)
        if not F or F.get('fixed'): continue
        im = Image.open(os.path.join(d, fn + '.webp')); w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
        im.resize((w, h), Image.LANCZOS).save(os.path.join(d, fn + '.webp'), 'WEBP', quality=76, method=6)
        meta['frames'][fn] = {'w': w, 'h': h, 'ax': round(F['ax'] * k, 1), 'ay': round(F['ay'] * k, 1), 'fixed': k}
        print('scaled', fn, k)
    json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'))

# 职业配件（按头部锚点叠加的脸部配件，和时装眼镜同一套坐标）：阿修罗的 X 形眼罩
JOB_ACC = {'asura_face': 'a single black cloth blindfold band as worn over the eyes, seen in strict side view facing right: a short slightly curved black cloth strip with a small white X-shaped seal mark on its front end, bold dark outline, clean cel shading, cute chibi RPG style'}
def jobacc_jobs():
    from combatgen import OUT
    return [{'out': os.path.join(OUT, 'acc', f'{n}.png'), 'size': '1024x1024', 'prompt': f'{d}. Plain pure white background, a single isolated object centered, no shadow, no text.'} for n, d in JOB_ACC.items()]
def jobacc_prep():
    from PIL import Image
    from prep import remove_bg
    from combatgen import OUT
    d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'final', 'avatar')
    for n in JOB_ACC:
        im = remove_bg(Image.open(os.path.join(OUT, 'acc', f'{n}.png'))); im = im.crop(im.getchannel('A').getbbox())
        w = round(44 * 1.25); im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS); im.save(os.path.join(d, f'{n}.webp'), 'WEBP', quality=84, method=6); print(n, im.size)

def jobart_jobs(only=''):
    from combatgen import MAIN
    ref = os.path.join(MAIN, 'src', 'quests', 'ref', 'sword.png')
    return [{'out': os.path.join(MAIN, 'src', 'quests', f'job_{j}.png'), 'ref': ref, 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst',
             'prompt': f'Using this exact chibi character (same face, same spiky silver hair, same proportions and the same cute art style with thick outlines), draw a full-body character illustration of him as {d}. Full body, three-quarter view facing right, dynamic confident pose. Plain pure white background, no text.'}
            for j, d in JOBART.items() if j.startswith(only)]

def main():
    sys.path.insert(0, os.path.dirname(__file__))
    import combatgen
    from concurrent.futures import ThreadPoolExecutor
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    only = sys.argv[2] if len(sys.argv) > 2 else ''
    if cmd == 'phantomfix': return phantom_fix()
    if cmd == 'ghostref': L = ghost_jobs()
    elif cmd == 'jobart': L = jobart_jobs(only)
    elif cmd == 'jobacc': L = jobacc_jobs()
    elif cmd == 'jobaccprep': return jobacc_prep()
    else: raise SystemExit('用法：sword_art.py ghostref | jobart [转职] | phantomfix（frames2.py phantom --src art/src/combat/sheets 之后跑）')
    with ThreadPoolExecutor(2) as ex:
        for r in ex.map(combatgen.run, L): print(r, flush=True)

if __name__ == '__main__':
    main()

# 幻鬼的切帧高度（frames2 按参考站姿统一比例；比鬼剑士略高、身形修长）
try:
    import frames as _F; _F.HEIGHT.setdefault('phantom', 110)
except Exception: pass
