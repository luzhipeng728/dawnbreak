#!/usr/bin/env python3
"""批量生图：按阶段定义全部美术任务，并发调用 gpt-image 技能脚本；已存在的输出自动跳过（可断点续跑）。

  jobs.py refs     # 阶段 A：角色 / 怪物 / NPC 立绘、场景远景与地面、标题图
  jobs.py parts    # 阶段 B：以立绘为参考生成拆件图；以远景为参考生成交界带；图标、头像等
  jobs.py list     # 只列出任务
  -j 8 并发数，--only 名字前缀过滤
"""
import os, sys, json, subprocess, argparse, time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
# 画风：Q 版可爱卡通（用户 2026-09-27 选定）
CHIBI = ('cute chibi / super-deformed (Q-version) 2D side-scrolling mobile game art, about 3 heads tall with a big head and big expressive eyes, '
         'thick clean dark outlines, bright flat colors with simple soft shading, very cute and polished')
STYLE = ('cute cartoon 2D side-scrolling game background art, bright saturated colors, clean simple shapes, thick soft outlines, '
         'soft cel shading, whimsical and cozy, very polished mobile game quality')
POSE = ('Strict side view profile facing RIGHT, neutral relaxed standing pose, arms hanging slightly away from the body '
        'and legs slightly apart so every limb is clearly separated and visible.')
REF_TAIL = f'Art style: {CHIBI}. Plain pure white background, isolated single character, full body visible, no ground shadow, no text.'
NPC_TAIL = f'Art style: {CHIBI}. Plain pure white background, isolated single character, full body visible, no ground shadow, no text.'

# ---- 角色立绘（要拆件做骨骼动画的） ----
CHARS = {
    'sword': 'An original young swordsman hero: spiky silver-white hair, red eyes, navy-blue knee-length coat with gold trim and high collar, long red scarf, dark trousers, brown leather gloves and boots, a slim katana held in the front hand pointing down.',
    'gun': 'An original young female gunslinger: long chestnut-brown hair in a high ponytail, blue eyes, a brown newsboy cap, short brown leather jacket with brass buttons over a white shirt, blue neckerchief, dark shorts with a gun belt and thigh holster, knee-high brown leather boots, fingerless gloves, a large silver revolver held in the front hand pointing down.',
    'mage': 'An original young female elementalist mage: long lavender-purple hair, golden eyes, a tall pointed purple witch hat with a gold band, a purple and navy mage dress with gold trim and a knee-length flared skirt, a short cape, dark tights, purple boots, holding a long wooden staff topped with a glowing pink crystal orb.',
    'goblin': 'A small green goblin warrior monster: wrinkled green skin, huge pointy ears, big yellow eyes, sharp teeth, hunched posture, red cloth bandana, ragged brown loincloth and leather straps, bare feet with claws, holding a spiked wooden club.',
    'goblinCaptain': 'A goblin captain monster: green skin, huge pointy ears, yellow eyes, sharp teeth, wearing a dented iron helmet, a leather cuirass with metal plates and a torn red sash, leather boots, holding a notched short sword.',
    'goblinChief': 'A burly goblin chieftain boss monster: dark olive-green skin, big pointy ears with gold rings, fierce yellow eyes, tusks, a headdress of bones and red feathers, a wolf-fur mantle over the shoulders, leather loincloth with a skull belt buckle, bare clawed feet, big muscular arms, empty fists (he throws boulders).',
    'goblinShaman': 'A goblin lightning shaman boss monster: pale grey-white skin, huge ears, glowing cyan eyes, a hooded dark-blue ritual robe with lightning rune patterns, bone necklaces, crackling electricity around the hands, holding a curved scimitar.',
    'flameMage': 'A goblin fire sorcerer boss monster: reddish-orange skin, huge ears, glowing yellow eyes, a crimson and black mage robe with flame patterns and gold trim, a tall collar, holding a gnarled wooden staff topped with a burning fire crystal.',
    'cat': 'A cat demon monster, a feline beast-woman: grey-lavender fur with darker stripes, cat ears, slit yellow eyes, fangs, long tail, sharp claws on hands and feet, tattered purple cloth wraps around chest and hips, crouched agile predatory stance.',
    'catKing': 'A poison panther queen boss monster, a regal feline beast-woman: sleek dark purple fur, glowing acid-green eyes, a gold crown with an emerald, gold armlets, a flowing purple and black silk sash, long whip-like tail, long venomous green-tipped claws, green poison mist around her.',
    'tau': 'A minotaur warrior monster (bull-headed humanoid): brown fur, huge curved ivory horns, a brass nose ring, glowing red eyes, massive muscular body, a leather loincloth and belt, hooves, holding a heavy double-bladed battle axe.',
    'tauArmored': 'A minotaur commander monster (bull-headed humanoid): dark brown fur, huge white horns, glowing red eyes, wearing heavy steel plate armor on the chest and shoulders, a dark purple battle skirt, armored greaves, hooves, holding a huge steel battle axe.',
    'tauKing': 'A giant minotaur king boss monster (bull-headed humanoid): black-brown fur, enormous golden horns, a gold crown, glowing red eyes, ornate gold and crimson plate armor with a red cape, huge muscular arms, hooves, holding a gigantic golden double-bladed axe.',
    'zombie': 'An undead ghoul zombie monster: grey-green rotting skin, sunken glowing red eyes, messy dark hair, torn grey shirt and ragged trousers, exposed ribs, long bony fingers, barefoot, hunched shambling stance.',
    'boneLord': 'An undead bone lord boss monster: a tall skeleton king with a cracked bone crown, glowing icy blue eyes, a tattered black and dark blue royal robe with silver trim, bone shoulder armor, frost mist, long skeletal clawed hands.',
}
NPCS = {
    'npc_smith': 'An original burly bald blacksmith NPC with a thick brown beard, soot-stained arms, a leather apron over a brown shirt, heavy boots, holding a forging hammer, friendly face, standing in a relaxed 3/4 view facing right.',
    'npc_potion': 'An original young alchemist woman NPC with long wavy red hair, green eyes, a green dress with a white apron and many potion bottles on her belt, a small satchel, cheerful face, standing in a relaxed 3/4 view facing right.',
    'npc_trainer': 'An original stern swordmaster NPC, a man in his forties with black hair tied back and a short beard, a long dark red coat with black trim, a katana at his waist, arms crossed, standing in a relaxed 3/4 view facing right.',
    'npc_merchant': 'An original traveling merchant NPC, an old man with grey hair and a long mustache, round glasses, a mustard yellow coat with a blue scarf, carrying an enormous backpack stacked with goods, standing in a relaxed 3/4 view facing right.',
}
# ---- 场景：远景 / 地面 / 交界带 ----
BG = {
    'forest': ('A deep enchanted twilight forest: towering ancient trees with thick mossy trunks and roots, layered depth with misty distant trees fading into blue fog, soft teal moonbeams falling through the canopy, glowing mushrooms, a few fireflies.',
               'a twilight forest floor: a winding dirt path through short grass, small stones, fallen leaves, a few roots and moss patches, subtle teal moonlight',
               'dense dark undergrowth: ferns, bushes, mossy rocks, tree roots and a few glowing blue mushrooms'),
    'forestDark': ('A haunted shadow forest at night: twisted dead black trees, thick purple-blue fog, huge gnarled roots, faint ghostly lights between the trunks, a pale moon hidden behind branches, eerie and gloomy.',
                   'a dark haunted forest floor: black soil, dead leaves, twisted roots, patches of pale moss and small bones, cold blue mist lying on the ground',
                   'dark thorny undergrowth: twisted black roots, dead thorn bushes, pale glowing mushrooms and purple fog'),
    'ruins': ('Ancient stone temple ruins under a thunderstorm: broken marble columns and collapsed arches, overgrown with vines, dark stormy clouds with lightning in the distance, heavy rain, dramatic blue-grey lighting.',
              'wet ancient stone floor tiles: cracked grey flagstones with moss in the gaps, puddles reflecting the stormy sky, scattered rubble',
              'a low crumbled stone wall with fallen column pieces, broken statues and vines'),
    'ruinsPoison': ('Ancient ruins drowning in toxic swamp: crumbling purple stone pillars, twisted dead trees, bubbling green poison pools giving off glowing green mist, sickly purple sky, eerie atmosphere.',
                    'a ruined stone floor corrupted by poison: cracked purple-grey flagstones, glowing toxic green puddles, dead weeds and slime',
                    'crumbled purple stone blocks, dead roots and glowing toxic green plants'),
    'camp': ('A savage minotaur war camp at sunset: large hide tents, wooden palisade walls with sharpened stakes, tribal totems with bull skulls, torches, dusty orange sky with distant mountains.',
             'a dusty dirt ground of a war camp: packed brown earth with hoof prints, scattered bones, straw, wooden planks and small rocks, warm sunset light',
             'a row of sharpened wooden stakes, crates, barrels, bull skulls on poles and piled logs'),
    'campFire': ('A war camp engulfed in flames at night: burning tents and wooden towers, huge fires and thick black smoke, glowing embers flying, red-orange sky, dramatic fiery lighting.',
                 'scorched earth of a burning camp: blackened cracked ground with glowing lava-like ember cracks, ash, charred wood and bones, fiery orange light',
                 'burning wooden debris, charred stakes, smoldering barrels and small flames'),
    'ruinsDark': ('A cursed undead crypt ruin at night: gothic stone arches and crypt entrances, cracked tombstones, dead trees, cold blue ghost fires floating, a huge pale moon, heavy mist.',
                  'an old crypt floor: dark cracked flagstones, scattered bones and skulls, dried blood stains, cold blue mist creeping on the ground',
                  'a low broken graveyard wall with tombstones, iron fence, bones and blue ghost candles'),
    'town': ('A peaceful fantasy frontier town square in the morning: timber-framed houses with red and brown roofs, a stone watchtower, market stalls with awnings, lanterns, flower boxes, green trees, bright blue sky with soft clouds.',
             'a cobblestone town street: warm grey cobblestones in neat rows, a few fallen leaves and flower petals, bright morning light',
             'a low wooden fence with flower planters, crates, barrels and small bushes'),
}

def far_prompt(t): return (f'Side-scrolling game stage background, {STYLE}. {BG[t][0]} Only the scenery behind the play area: the bottom 12 percent of the image '
                           'is dark foreground ground detail where the walkable floor begins. Wide horizontal composition, detail spread evenly across the whole width, no single focal point, no characters, no text, no UI.')
def floor_prompt(t): return (f'Floor texture for the walkable ground of a 2D side-scrolling beat-em-up stage, seen from the side at a shallow top-down angle like the floor of a classic belt-scrolling brawler: {BG[t][1]}. '
                             f'{STYLE}, evenly lit, details evenly distributed across the entire image, no horizon, no sky, no walls, no characters, no text, fills the frame edge to edge.')
def edge_prompt(t): return (f'Using the same place, same colors and art style as this image, paint a long horizontal strip of {BG[t][2]} for a side-scrolling game, seen from the side. '
                            'The strip spans the ENTIRE width of the image from the left edge to the right edge and occupies only the bottom 35 percent of the image; its top outline is irregular. '
                            'Everything above it is plain pure white background. No sky, no ground plane, no characters, no text.')

PARTS_BASE = ('Using this exact chibi character (same design, same colors, same cute art style and thick outlines), create a 2D cutout-animation body parts sheet for a skeletal rig, on a plain pure white background. '
              'Draw each part separately with wide white space around every part; no part may touch or overlap another; tidy grid layout. '
              'STRICT RULES: no joint pegs, no peach or skin-colored connector circles, no mannequin stumps; every part simply ends cleanly where it is cut, with a slightly rounded cut end. '
              'All limbs perfectly straight and vertical, all parts at the same scale as on the character. Parts: ')
PARTS_HUMAN = ('1) the head (with hair / headwear) and a short neck only, side view facing right, WITHOUT any collar; '
               '2) the torso from the neck down to the hips, including collar and belt, but with NO arms and NO sleeves at all (shoulders end cleanly), facing right; '
               '3) one upper arm, hanging perfectly straight down, shoulder at the top; '
               '4) one forearm with the hand closed in a fist, hanging perfectly straight down, elbow at the top; '
               '5) one thigh, perfectly vertical; 6) one lower leg, perfectly vertical, WITHOUT the foot; '
               '7) one foot only from ankle to toe, side view with the toe pointing right')
PARTS_EXTRA = {
    'sword': '; 8) the lower coat skirt / coat tails hanging from the waist; 9) the long red scarf tail; 10) the katana alone, vertical, handle at the top, blade pointing down.',
    'gun': '; 8) the silver revolver alone, vertical, grip at the top and barrel pointing down; 9) the ponytail of hair alone.',
    'mage': '; 8) the flared skirt of the dress alone, hanging from the waist; 9) the short cape alone; 10) the staff alone, vertical, the crystal orb at the BOTTOM end and the plain end at the top.',
    'goblin': '; 8) the spiked wooden club alone, vertical, handle at the top; 9) the ragged loincloth alone hanging from the waist.',
    'goblinCaptain': '; 8) the short sword alone, vertical, handle at the top, blade pointing down; 9) the torn red sash tail alone.',
    'goblinChief': '; 8) the fur mantle / cape alone; 9) the loincloth alone hanging from the waist.',
    'goblinShaman': '; 8) the curved scimitar alone, vertical, handle at the top; 9) the lower part of the robe alone hanging from the waist.',
    'flameMage': '; 8) the fire staff alone, vertical, burning crystal at the BOTTOM end; 9) the lower part of the robe alone hanging from the waist.',
    'cat': '; 8) the long cat tail alone; 9) the tattered hip cloth alone hanging from the waist.',
    'catKing': '; 8) the long whip-like tail alone; 9) the flowing silk sash alone hanging from the waist.',
    'tau': '; 8) the double-bladed battle axe alone, vertical, handle at the top and the blades at the BOTTOM; 9) the leather loincloth alone hanging from the waist.',
    'tauArmored': '; 8) the steel battle axe alone, vertical, handle at the top and the blades at the BOTTOM; 9) the battle skirt alone hanging from the waist.',
    'tauKing': '; 8) the golden double-bladed axe alone, vertical, handle at the top and the blades at the BOTTOM; 9) the red cape alone; 10) the armored battle skirt alone hanging from the waist.',
    'zombie': '; 8) the ragged shirt tail / torn cloth alone hanging from the waist.',
    'boneLord': '; 8) the long tattered robe skirt alone hanging from the waist; 9) the tattered cape alone.',
}

ICON_STYLE = ('cute cartoon mobile RPG icon style, bold clean outlines, bright saturated colors, soft shading, glossy and polished; '
              'every icon is a rounded square tile with its own colored background and a thick dark border')
SKILL_ICONS = [
    ('skills_a', ['a sword slashing upward in a bright blue crescent arc', 'three fast cyan dash slashes in a row', 'a blue sword energy wave rushing along the ground', 'a sword smashing into the ground with an orange shockwave',
                 'a glowing purple sword aura buff', 'a golden quick-draw sword flash splitting the tile', 'a green spinning circular sword slash', 'a radiant golden dawn sun flash with a sword (ultimate)',
                 'a flurry of pink rapid sword thrusts', 'a fiery orange rising dragon sword strike', 'a boot kicking upward with motion lines', 'a spinning kick with a green swirl']),
    ('skills_b', ['a sliding kick along the ground with dust', 'a revolver firing bullets upward and forward', 'a round grenade with a lit fuse and fire', 'a glowing revolver cylinder with purple aura (buff)',
                 'two revolvers spinning like boomerangs', 'a red sniper crosshair on a target', 'a heavy gatling gun firing', 'a golden bullet storm explosion (ultimate)',
                 'three pink homing magic missiles', 'a sharp ice spear', 'a pillar of fire rising from the ground', 'a yellow chain lightning bolt']),
    ('skills_c', ['a snowflake frost nova ring', 'three elemental orbs orbiting (buff)', 'a flaming meteor falling', 'a green whirling tornado',
                 'a swirling purple black hole', 'fire ice and lightning combined into a star (ultimate)', 'a red heart potion', 'a blue mana crystal',
                 'a golden treasure chest', 'a silver shield', 'a brown leather bag', 'a scroll']),
]
ITEM_ICONS = [
    ('items_a', ['a katana sword', 'a silver revolver', 'a wooden magic staff with a glowing orb', 'metal shoulder armor pauldrons',
                 'a leather chest armor', 'leather armored pants', 'a leather belt with a buckle', 'a pair of leather boots',
                 'a gold necklace with a gem', 'a silver bracelet', 'a ring with a blue gem', 'a small red health potion bottle',
                 'a medium red health potion bottle', 'a large red health potion bottle', 'a small blue mana potion bottle', 'a medium blue mana potion bottle']),
    ('items_b', ['a golden elixir flask glowing', 'a pile of clear colorless crystal shards', 'a blue magic protection ticket scroll with a shield emblem', 'a golden revive coin with a wing emblem',
                 'a pile of gold coins', 'a sword with glowing enhancement sparkles', 'a golden trophy', 'a treasure card with a question mark',
                 'a red demon skull', 'a map scroll', 'a key', 'a bomb']),
]
def icon_prompt(items): return (f'A sprite sheet of {len(items)} separate game icons arranged in a grid of 4 columns and {len(items) // 4} rows on a plain pure white background, '
                                f'evenly spaced with generous white gaps between icons, no icon touching another, {ICON_STYLE}. In reading order (left to right, top to bottom): '
                                + '; '.join(f'({i + 1}) {t}' for i, t in enumerate(items)) + '. No text, no numbers, no labels.')

def J(out, prompt, size, q='high', model=None, ref=None, transparent=False):
    return {'out': out, 'prompt': prompt, 'size': size, 'q': q, 'model': model, 'ref': ref}

def jobs(phase):
    L = []
    if phase == 'refs':
        for n, d in CHARS.items():
            L.append(J(f'src/{n}_ref.png', f'Full-body character design image for a 2D side-scrolling beat-em-up game. {POSE} {d} {REF_TAIL}', '1024x1536', model='gpt-image-2.5-sunburst'))
        for n, d in NPCS.items():
            L.append(J(f'src/{n}.png', f'Full-body NPC character illustration for a 2D side-scrolling fantasy RPG town. {d} {NPC_TAIL}', '1024x1536', model='gpt-image-2.5-sunburst'))
        for t in BG:
            L.append(J(f'src/bg/{t}_far.png', far_prompt(t), '3840x2160'))
            L.append(J(f'src/bg/{t}_floor.png', floor_prompt(t), '3840x2160'))
        L.append(J('src/title.png', f'Title screen key art for a cute 2D fantasy action game called Dawnbreak Dungeon, {STYLE}. A cheerful sunrise over a colorful fantasy valley: '
                   'a cute cartoon dungeon entrance carved into a rocky hill with a big stone door, golden light rays, a winding path, round fluffy trees, distant castle and mountains, '
                   'inviting composition with empty sky space in the upper middle for a logo. No characters, no text, no logo, no UI.', '3840x2160', model='gpt-image-2.5-sunburst'))
    if phase == 'cutin':
        acts = {'sword': 'swinging the katana in a huge golden crescent slash with golden light rays and sparkles',
                'gun': 'aiming the big silver revolver forward with a fierce wink, glowing muzzle flash and flying bullet casings',
                'mage': 'raising the crystal staff high while fire, ice and lightning swirl around her in a magic circle'}
        for n, act in acts.items():
            L.append(J(f'src/cutin_{n}.png', f'Using this exact chibi character (same design, same colors, same cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {act}. Plain pure white background, no text.', '1536x1024', model='gpt-image-2.5-sunburst', ref=f'src/{n}_ref.png'))
    if phase == 'fx':
        FXS = 'cute cartoon 2D mobile game VFX sprite, hand-painted, bold clean shapes, vibrant saturated colors, polished'
        GLOW = f'{FXS}. On a pure solid black background, a single isolated effect centered with empty black margin around it, nothing else, no text, no border.'
        SOLID = f'{FXS}, thick dark outline, soft cel shading. Plain pure white background, a single isolated object centered, no shadow, no text.'
        T = '1024x1536'; Wd = '1536x1024'; Sq = '1024x1024'
        for n, d, sz in [
            ('slash', 'A single sword slash crescent swoosh: a thick glowing cyan and white crescent arc shaped like a wide C mirrored, the crescent curves from the top to the bottom with its round convex side facing RIGHT, bright white leading edge fading to a thin tail at both tips', Sq),
            ('thrust', 'A single horizontal piercing stab streak pointing RIGHT: a long sharp spear of cyan-white light, thick and bright at the right tip, fading to thin transparent at the left, with a few speed lines', Wd),
            ('slashx', 'A single cross-shaped double sword slash: two long crossing bright white and light-blue slash lines forming a big X, sharp tapered ends, sparks at the intersection', Sq),
            ('spark', 'A single hit impact spark: a bright white and pale yellow star burst with sharp rays and small sparks radiating outward', Sq),
            ('crit', 'A single big critical hit impact burst: an explosive orange, red and yellow star flash with jagged rays, a shockwave ring and flying sparks', Sq),
            ('explosion', 'A single cartoon fire explosion: a round fiery burst of yellow and orange flames with dark red smoke puffs at the edges and sparks', Sq),
            ('pillar', 'A single tall vertical pillar of fire erupting upward from the ground: bright yellow core, orange and red flames, a wide flame burst at the bottom and flame tongues at the top, tall narrow composition', T),
            ('fireball', 'A single fireball projectile flying to the RIGHT: a bright yellow-white core at the right with orange and red flames trailing behind to the LEFT', Wd),
            ('icespike', 'A single glowing ice lance projectile pointing RIGHT: a long sharp crystal icicle, light blue and white, with frost sparkles around it', Wd),
            ('frost', 'A single frost explosion seen from a low side angle: a flat wide ring of ice shards and frost mist bursting outward, light blue and white, wide horizontal composition', Wd),
            ('lightning', 'A single vertical lightning bolt striking straight down from the top edge to the bottom edge: jagged bright white-yellow core with electric blue and purple glow and small branches, tall narrow composition', T),
            ('orb', 'A single glowing magic orb: a bright pink and purple energy sphere with a white hot core, swirling sparkles and soft glow', Sq),
            ('tornado', 'A single swirling green wind tornado: a funnel of translucent green and white wind spirals, wide at the top and narrow at the bottom, with a few leaves, tall narrow composition', T),
            ('vortex', 'A single swirling black hole vortex seen from the front: glowing violet and magenta spiral arms spinning around a dark center, with sparkles', Sq),
            ('wave', 'A single ground sword-energy wave moving to the RIGHT: a tall glowing blue and white crescent blade of energy rising from the ground, with a spray of light particles at its base, tall narrow composition', T),
            ('shock', 'A single flat ground shockwave seen from a low side angle: a bright orange and white elliptical ring spreading on the ground with dust and small rock debris flying outward, wide horizontal composition', Wd),
            ('muzzle', 'A single gun muzzle flash seen from the side, pointing RIGHT: a bright yellow-white star-shaped flash with orange fire petals', Sq),
            ('meteor', 'A single flaming meteor falling diagonally from the top-left toward the bottom-right: a glowing molten rock at the bottom-right with a long fiery trail behind it toward the top-left', Sq),
            ('heal', 'A single healing light effect: a soft column of green and white light with rising sparkles and small plus-shaped particles, tall narrow composition', T),
            ('poison', 'A single toxic poison cloud: bubbly purple and acid-green gas puffs with small bubbles and a soft glow', Wd),
            ('rune', 'A single magic warning circle seen from directly above: a glowing white rune circle with an outer ring, an inner ring and simple geometric symbols, thin crisp lines, perfectly round, filling most of the frame', Sq),
            ('hexagram', 'A single magic circle seen from directly above: a six-pointed star hexagram between two glowing rings with runes, bright white thin crisp lines, perfectly round, filling most of the frame', Sq),
            ('aura', 'A single rising power-up aura: a column of golden-white energy flames and light streaks rising from a glowing ellipse on the ground, tall narrow composition', T),
            ('burst', 'A single radiant light burst: a big golden-white starburst flash with many long thin light rays radiating from the center and sparkles', Sq),
            ('bullet', 'A single glowing bullet tracer flying to the RIGHT: a small bright white-yellow bullet at the right end with a long thin orange light streak behind it to the left', Wd),
        ]:
            L.append(J(f'src/fx/{n}.png', f'{d}. {GLOW}', sz))
        for n, d in [('dust', 'A single cartoon dust cloud: a cluster of round beige and light brown smoke puffs'), ('rock', 'A single cartoon grey boulder rock, roundish with cracks'),
                     ('grenade', 'A single cartoon olive-green round hand grenade with a metal pin and lever'), ('bomb', 'A single cartoon black round bomb with a short lit fuse and sparks')]:
            L.append(J(f'src/fx/{n}.png', f'{d}. {SOLID}', Sq))
    if phase == 'icons':
        for n, items in SKILL_ICONS + ITEM_ICONS:
            L.append(J(f'src/icons/{n}.png', icon_prompt(items), '2048x2048' if len(items) == 16 else '2048x1152'))
    if phase == 'parts':
        for n in CHARS:
            if n == 'sword' and os.path.exists(os.path.join(ROOT, 'src/sword_parts.png')): continue
            L.append(J(f'src/{n}_parts.png', PARTS_BASE + PARTS_HUMAN + PARTS_EXTRA[n], '2048x2048', model='gpt-image-2.5-sunburst', ref=f'src/{n}_ref.png'))
        for t in BG:
            L.append(J(f'src/bg/{t}_edge.png', edge_prompt(t), '3840x2160', ref=f'src/bg/{t}_far.png'))
    return L

def run(job, i, n):
    out = os.path.join(ROOT, job['out'])
    if os.path.exists(out): return f'skip {job["out"]}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if job['ref']:
        cmd = ['python3', S, 'edit', job['prompt'], '-i', os.path.join(ROOT, job['ref']), '-o', out, '-s', job['size'], '-q', job['q']]
    else:
        cmd = ['python3', S, 'gen', job['prompt'], '-o', out, '-s', job['size'], '-q', job['q']]
    if job['model']: cmd += ['-m', job['model']]
    t = time.time()
    for attempt in range(6):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out): return f'ok   {job["out"]}  {time.time() - t:.0f}s'
        time.sleep(65 if '429' in (r.stderr + r.stdout) else 5 + attempt * 5)   # 上传接口限流：每分钟 5 次
    return f'FAIL {job["out"]}: {(r.stderr or r.stdout)[-300:]}'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('-j', type=int, default=8); ap.add_argument('--only', default='')
    a = ap.parse_args()
    if a.phase == 'list':
        for ph in ('refs', 'parts'):
            for j in jobs(ph): print(ph, j['out'])
        return
    L = [j for j in jobs(a.phase) if os.path.basename(j['out']).startswith(a.only) or not a.only]
    print(f'{len(L)} jobs, {a.j} parallel', flush=True)
    with ThreadPoolExecutor(a.j) as ex:
        fs = [ex.submit(run, j, i, len(L)) for i, j in enumerate(L)]
        for f in as_completed(fs): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
