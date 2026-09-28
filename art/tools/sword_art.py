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
    # ---- 鬼泣：召唤鬼神（举手 / 按地）、鬼影鞭、死亡墓碑、卡洛托火、幽魂降临（空中）、黄泉摆渡（大横斩）----
    'sword_soul': [('sbSummon', 'the left arm raised high with the palm open and fingers spread as if commanding a spirit, the katana held low in the right hand, no visual effects'),
                   ('sbPlace', 'crouched on one knee pressing the left palm flat onto the ground, the katana held back in the right hand, no visual effects'),
                   ('sbWhip1', 'the katana swung far back behind the body at shoulder height, body twisted as if winding up to crack a whip, no visual effects'),
                   ('sbWhip2', 'the katana lashed forward and low with the arm fully extended forward, stepping in, no visual effects'),
                   ('sbTomb', 'standing still with the head bowed and both arms spread wide and slightly down, the katana in the right hand pointing to the ground, solemn, no visual effects'),
                   ('sbKaro', 'the left hand raised in front of the chest palm up as if holding a small floating flame, the katana held low, calm, no visual effects'),
                   ('sbDescent', 'high in the air with the body tilted forward, the left arm thrust down toward the ground, the katana held back, no visual effects'),
                   ('sbFerry', 'a huge horizontal two-handed swing of the katana slicing through the air in front, body twisted, wide stance, no visual effects')],
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
    'sb_tomb': ('A single cute cartoon grey stone tombstone with a rounded top, a carved cross and a crack, a little moss at the base', SQ_, False),
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
    # 鬼泣（第 3 阶段）
    ('sb_unseal', 'a glowing purple ghost arm breaking free from shattered chains'), ('sb_darkmoon', 'a dark violet crescent moon rising over black clouds'),
    ('sb_plemon', 'a sickly green hooded skull ghost above a green rune circle'), ('sb_dark', 'a dark purple swirling orb with a small shield outline'),
    ('sb_kaiga', 'a blue-violet ghost afterimage of a swordsman dashing with motion trails'), ('sb_purge', 'a ghost circle being wiped away by a white sweeping light'),
    ('sb_fullmoon', 'a full violet moon split by an upward sword slash'), ('sb_release', 'several colorful ghost spirits bursting out of an open glowing hand'),
    ('sb_devour', 'a sword wreathed in purple ghost flame swallowing a small spirit'), ('sb_saya', 'a serene icy ghost woman with an ice crown above a frozen circle'),
    ('sb_whip', 'a purple ghostly sword lashing like a whip in a long curve'), ('sb_tomb', 'grey tombstones falling from a dark sky onto the ground'),
    ('sb_rasha', 'a small magenta masked plague imp with claws above a purple circle'), ('sb_flash', 'a violet dash slash line with a ghost silhouette and a burst'),
    ('sb_fury', 'a sword chopping down into a huge purple ghost-flame explosion'), ('sb_karo', 'a black and violet flaming skull wisp flying forward'),
    # 鬼泣 2 个 + 狂战士 P1 4 个 + 剑影（第 4 阶段）
    ('sb_karoblade', 'two black-violet flaming swords crossing in a fiery X'), ('sb_awaken', 'a giant dark purple maw with teeth bursting out of a swamp'),
    ('bz_awaken2', 'a giant crimson blood demon silhouette charging forward'), ('bz_limit', 'a crimson blood shield cracking with red energy at its limit'),
    ('bz_rampant', 'a huge ball of blood energy shattering into flying crimson shards'), ('bz_awaken3', 'a blood-armored demon warrior with a giant crimson sword'),
    ('gb_ghostman', 'a swordsman silhouette merged with a translucent masked ghost'), ('gb_step', 'a blue afterimage streak of a swordsman dashing invisibly'),
    ('gb_chain', 'three quick cyan sword slashes in a row'), ('gb_retrace', 'a swordsman swapping places with a ghost through a blue swirl'),
    ('gb_katana', 'a katana with a cold blue gleam on the edge'), ('gb_issen', 'a masked ghost dashing forward leaving a long cyan slash line'),
    ('gb_power', 'a ghostly blue fist with a masked ghost face behind it'), ('gb_fang', 'a piercing sword thrust pulling small silhouettes to its tip'),
    ('gb_rend', 'a masked ghost slashing four times in a flurry'), ('gb_resonance', 'two overlapping souls, a swordsman and a masked ghost, resonating with blue rings'),
    ('gb_chainex', 'a second glowing blue soul blade rising in crossing slashes'), ('gb_riko', 'a swordsman and a ghost crossing past each other in an X slash'),
    ('gb_break', 'a heavy downward sword chop shattering the ground with blue soul energy'), ('gb_ghostslash', 'a swordsman and a ghost drawing katanas together in a wide crescent'),
    ('gb_kaiten', 'a masked ghost spinning with a wide circular blade sweep'), ('gb_behead', 'an extremely long horizontal sword slash splitting the screen'),
    ('gb_awaken', 'a swordsman and a masked ghost crossing four giant slashes in the dark night'), ('wm_swap', 'two different swords swapping places in a quick circular motion'),
]
FXPREP = {'glow': {'fudo': 384, 'sb_saya': 320, 'sb_plemon': 320, 'sb_rasha': 192, 'sb_blade': 320, 'sb_karo': 160, 'sb_kazan': 320, 'sb_brasha': 448}, 'solid': {'sb_tomb': 96}}   # fxprep.py --combat 的输出尺寸（最长边像素）
# 鬼神 / 明王这类“角色型”特效：以召唤师生物的 Q 版画风为参考（art/src/summon/_refs_all.png），黑底发光，fxprep 转成透明加色
GHOST_STYLE = ('The FIRST image shows cute chibi cartoon game creatures and the SECOND image shows a glowing spectral deity drawn in the same game: use them only as the style reference '
               '(thick dark outlines, simplified chunky shapes, big head and small body, soft cel shading, translucent glowing spectral body on black). Draw ONE new, different character: ')
GHOST_TAIL = ' Translucent glowing spectral look. On a pure solid black background, the character centered with empty black margin around it, nothing else, no text.'
GHOSTS = {   # 名字: (描述, 尺寸)
    'fudo': ('a chibi wrathful guardian deity (Fudo Myo-o / Acala) made of glowing blue and violet spectral flame, heroic chunky proportions with a big head (about 1 to 4 head-to-body), '
             'a fierce but cartoonish scowling face with glowing eyes, holding a big straight sword upright in the right hand and a coiled golden rope in the left hand, '
             'a large ring halo of blue flames behind his head, his lower body fading into rising blue flames, front view, imposing statue-like stance.', '1024x1536'),
    # 鬼泣的鬼神（官方阵色：萨亚 冰阵、普戾蒙 绿阵、罗刹 紫阵、卡赞 红阵、布雷德 刀阵、卡洛 冥炎）
    'sb_saya': ('Saya, the ice ghost: a graceful chibi female ice spirit with long flowing pale-blue hair made of frost, a small ice-crystal crown, closed serene eyes, '
                'a flowing white and icy-blue kimono-like dress that fades into cold mist below the waist, tiny ice shards floating around her, palette of white, ice blue and cyan, '
                'standing, three-quarter view facing right.', '1024x1536'),
    'sb_plemon': ('Plemon, the erosion ghost: a chubby hunched chibi spirit in a tattered hooded cloak of sickly green, a round skull-like mask face with glowing yellow-green eyes, '
                  'short stubby arms, dripping green corrosive ooze and bubbling green miasma around it, palette of sickly green, dark olive and acid yellow-green, floating, three-quarter view facing right.', '1024x1536'),
    'sb_rasha': ('Rasha, the plague imp: a small chibi plague demon imp with a cracked purple mask, long thin clawed arms, a torn magenta cloak, glowing pink eyes, a wisp of poisonous purple and magenta miasma for a tail, '
                 'palette of magenta, violet and dark purple, crouched ready to pounce, three-quarter view facing right.', '1024x1024'),
    'sb_blade': ('Bleide, the blade ghost: a tall hooded chibi ghost of a swordsman with a pale steel-grey cloak and a white skull-like face with cold blue glowing eyes, '
                 'surrounded by a ring of eight floating ghostly swords glowing with cold blue light, palette of steel grey, white and cold ice blue, floating, front view.', '1024x1536'),
    'sb_karo': ('Karo, the underworld flame spirit: a small floating chibi skull-headed wisp made of black flames with deep violet and purple fire edges, big glowing violet eyes, a long flickering flame tail behind it, '
                'flying to the RIGHT, side view.', '1024x1024'),
    'sb_kazan': ('Kazan, the blade demon: a stocky chibi red oni ghost warrior with two horns, a glowing blood-red rune on the forehead, fierce glowing eyes, spiky dark-red hair, '
                 'blood-red spectral flames rising from the shoulders, holding a broad curved blade, his lower body fading into red smoke, palette of blood red, crimson and dark maroon, three-quarter view facing right.', '1024x1536'),
    'sb_brasha': ('Brasha, the forbidden seventh ghost: a huge monstrous maw bursting up out of a dark swamp, a gaping round mouth full of jagged teeth with a glowing violet throat, '
                  'tiny glowing eyes above the mouth, dark purple shadowy body with dripping swamp muck and shadowy tendrils, chunky cartoon shapes, palette of dark purple, violet and black, front view, wide composition.', '1536x1024'),
}
CUTIN = {   # 转职: ('sword', 描述)
    'asura': ('sword', 'eyes covered by a black cloth blindfold with a white X-shaped seal mark, calm and fierce, one open palm pushed toward the viewer releasing swirling blue-violet wave energy, katana held low, ripples of energy in the air'),
    'soulbender': ('sword', 'the unchained left arm glowing with eerie purple ghost energy raised toward the viewer, broken chains flying from the wrist, several small ghost spirits (an icy blue one, a sickly green one, a purple one) swirling around him, cold eerie smile'),
    'ghostblade': ('sword', 'pale grey skin and a pale bluish glowing ghost left hand, cold focused eyes, katana drawn in a quick-draw pose, a translucent masked white-haired ghost swordsman with a glowing katana looming right behind him mirroring his pose, cold blue light'),
}
# 转职立绘（转职窗口）：以鬼剑士立绘为参考，输出 art/src/quests/job_<转职>.png，再用 job_art.py 去背缩放到 art/final/job/
JOBART = {
    'asura': 'the Asura advancement: a black cloth blindfold tied over both eyes with a white X-shaped seal mark on it, heavy dark steel plate armor with violet trims over a dark indigo coat, a torn dark half cape, calm expression, holding the katana low in one hand while the other open palm releases a swirling blue-violet wave energy aura with faint ripples',
    'soulbender': 'the Soul Bender advancement: the left arm freed from its chains and glowing with ghostly purple energy, broken chains dangling from the left wrist, a long dark violet and black coat with ghostly purple trims, a large translucent purple ghost silhouette looming behind him, holding the katana low in the right hand, calm eerie expression',
    'ghostblade': 'the Ghostblade advancement: slightly pale grey skin and a pale bluish ghostly left hand, a sleek dark grey and black leather coat with cold blue trims, a katana held in a low quick-draw stance, and right behind him a translucent ghost swordsman with long white hair, a cracked white oni half-mask and a glowing cyan katana, standing back to back with him, cold calm expression',
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

def ghost_fx_jobs(only=''):
    from combatgen import MAIN, OUT
    refs = [os.path.join(MAIN, 'src', 'summon', '_refs_all.png')] + ([os.path.join(OUT, 'fx', 'fudo.png')] if only != 'fudo' else [])   # 不动明王定稿后作为第二张画风参考
    return [{'out': os.path.join(OUT, 'fx', f'{n}.png'), 'refs': refs, 'size': sz, 'model': 'gpt-image-2.5-sunburst', 'prompt': GHOST_STYLE + d + GHOST_TAIL}
            for n, (d, sz) in GHOSTS.items() if n.startswith(only) and n != 'fudo' or n == only]

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
    elif cmd == 'ghostfx':   # 多张参考图：借用 avatar_gen 的生成函数
        import avatar_gen as AG
        base, key, _ = AG.gi.load_cfg(); L = ghost_fx_jobs(only)
        with ThreadPoolExecutor(2) as ex:
            for r in ex.map(lambda j: AG.run(j, base, key, False), L): print(r, flush=True)
        return
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
