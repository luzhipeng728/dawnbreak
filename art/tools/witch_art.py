#!/usr/bin/env python3
"""魔道学者的机械 / 召唤物美术（魔法师对齐组）：和 sky_art.py 同一套流水线（参考立绘 → 动作表 → 切帧），另外支持自定义帧名的动作表。
机械里不画魔道学者本人：玩家用自己的帧（带时装）站 / 坐在机械上，或者进到机械里隐藏，这样换了时装也对得上。
AI 原图写到主仓库 art/src/witch/；最终 webp 写到本仓库 art/final/spr/<id>/。

  witch_art.py refs|sheets|cut [--only 前缀]
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import sky_art as A
import frames2

A.SRC = os.path.join(A.MAIN, 'src', 'witch')
A.PAR = 1   # 魔道学者这边最多 1 路并发（全队共用生图账号）
A.BACKOFF = 65

MACHINE = ('No smoke, no sparks, no motion lines, no effects. A cute cartoon steampunk magic machine for a 2D side-scrolling game, seen in strict side view facing RIGHT, chunky rounded shapes, riveted brass and iron, '
           'bold clean outlines, soft cel shading, bright colors. NO person, NO character, nobody riding or operating it. ')
# 自定义动作表：{ 表名: [(帧名, 描述), ...] }（8 帧，第 1 格是参考）
A.M = {
    'shululu': dict(h=64, hold=None, sheets=('walk', 'act'),
        desc='Shululu, a taunting decoy doll: a grinning jack-o-lantern pumpkin head wearing a frilly pink dress and a little bonnet like a rag doll, stubby cloth arms and legs, a stitched mouth, cute and mischievous.',
        atk='its stubby arms waving', cast='waving both arms and taunting', low='hopping forward',
        custom={'act': [('taunt1', 'waving both stubby arms up and down, taunting with a tongue out'), ('taunt2', 'wiggling its hips and pointing forward, taunting'),
                        ('swell1', 'starting to glow orange and swell up slightly, eyes wide'), ('swell2', 'swollen up round and glowing bright orange, about to burst'),
                        ('hop1', 'hopping happily upward with both arms raised'), ('hop2', 'landing from a hop, squashed down'),
                        ('sad', 'slumped sadly with its head hanging down'), ('idle2', 'standing still with its hands on its hips, grinning')]}),
    'furnace': dict(h=110, hold=None, sheets=('act',), holes=True,
        desc=MACHINE + 'A furnace machine: a round iron furnace body with a jack-o-lantern face gauge on the front (glowing orange eyes), a short chimney, a large leather bellows mounted on top with a flat seat, brass pipes, four short stubby legs.',
        custom={'act': [('idle', 'standing still, the jack-o-lantern gauge glowing softly'), ('pump1', 'the bellows on top squeezed down, the furnace glowing brighter'),
                        ('pump2', 'the bellows on top pulled open wide'), ('fire1', 'the front hatch flung open with a bright orange glow inside, body recoiling backward'),
                        ('fire2', 'the front hatch half closed, body settling back after recoil'), ('fail', 'tilted over on two legs, the chimney pointing up, the face gauge looking panicked'),
                        ('boom', 'cracked all over and glowing red hot, about to explode'), ('build', 'half assembled: loose iron plates and pipes floating together')]}),
    'drill': dict(h=100, hold=None, sheets=('act',), holes=False,
        desc=MACHINE + 'A drill car shaped like a snowman: a round white snowman-shaped body on caterpillar treads, an empty open driver seat on top with a small steering lever, a big spiral ice-blue drill bit on the front, a little carrot-nose light.',
        custom={'act': [('idle', 'parked, the drill still'), ('drive1', 'driving forward, treads turning'), ('drive2', 'driving forward, bouncing slightly, drill spinning'),
                        ('drill1', 'lunging forward with the drill bit pushed out far'), ('drill2', 'drill bit turned a quarter, body level'), ('turn', 'turning around, tilted'),
                        ('fail', 'nose-diving into the ground, drill stuck in the dirt, treads in the air'), ('big', 'with a huge crystal ice drill bit, glowing blue')]}),
    'tesla': dict(h=130, hold=None, sheets=('act',), holes=True,
        desc=MACHINE + 'An electric eel tower: a tall tesla-coil tower topped with two little eel-like antenna horns and a glowing yellow orb, with a big wooden hamster wheel at its base (empty), copper coils and brass rings.',
        custom={'act': [('idle', 'standing still, the orb dim'), ('spin1', 'the hamster wheel turned a quarter, the coils glowing orange'), ('spin2', 'the hamster wheel turned half, the orb glowing brighter'),
                        ('zap1', 'the top orb glowing blinding white-yellow, the eel antennas pointing forward'), ('zap2', 'the top orb dimming back, the eel antennas relaxed'), ('fail', 'leaning to one side, the top orb dark and cracked, the wheel stopped'),
                        ('boom', 'overloaded and glowing white, about to explode'), ('build', 'half assembled: coils and wheel parts floating together')]}),
    'antigrav': dict(h=60, hold=None, sheets=('act',), holes=True,
        desc=MACHINE + 'An anti-gravity device: a small round brass platform with a purple glowing lens on top, little light bulbs around the rim, stubby legs, a black cat ear shape on the top.',
        custom={'act': [('idle', 'standing still, lens dim'), ('on1', 'lens glowing bright purple, bulbs flashing'), ('on2', 'the lens glowing very bright purple, legs braced wide'),
                        ('on3', 'the lens glowing purple, the rim bulbs all lit'), ('off', 'powering down, the lens dim'), ('fail', 'tilted, the lens cracked and dark'),
                        ('boom', 'glowing white hot, about to explode'), ('build', 'half assembled: parts floating together')]}),
}
# ---- 觉醒段（P1，魔道学者 a5e1653e1f8c956f1）：光电兔、雪人刨冰机、捣蛋杰克、乌洛波洛斯之环、过山车、一觉的 4 台机械、四个助手、糖果人偶 ----
CUTE = 'A cute chibi creature for a 2D side-scrolling game, strict side view facing RIGHT, bold clean outlines, soft cel shading, bright colors, no effects, no motion lines. '
A.M.update({
    'rabbit': dict(h=118, hold=None, sheets=('act',), holes=True,
        desc=MACHINE + 'An electric rabbit machine: a round white and brass robot body shaped like a cute rabbit, two tall springy metal ears tipped with round yellow light bulbs, a lightning-bolt emblem on the chest, '
             'a short thick copper cannon nozzle for a mouth pointing forward, an empty padded seat on its back, two big springy hind legs.',
        custom={'act': [('idle', 'standing still, ear bulbs dim'), ('build', 'half assembled: body plates, ears and legs floating together'), ('charge', 'crouched on its springy legs, ear bulbs glowing bright yellow'),
                        ('zap1', 'leaning forward, the nozzle mouth glowing bright yellow-white, ears pointing forward'), ('zap2', 'recoiling slightly backward, nozzle glowing, ears swept back'),
                        ('hop', 'hopping up in the air with legs stretched'), ('fail', 'slumped over, ears drooping, bulbs dark, a little dent on its head'), ('boom', 'glowing white hot all over, about to explode')]}),
    'shaved': dict(h=120, hold=None, sheets=('act',), holes=False,
        desc=MACHINE + 'A snowman shaved-ice machine: a big round white snowman-shaped machine with a carrot nose and a knitted red scarf, a big crank lever sticking out of its side, '
             'a round blue ice-shaving blade housing at its base, a glass bowl of colorful shaved ice with syrup on a little tray, brass rivets.',
        custom={'act': [('idle', 'standing still'), ('build', 'half assembled: snowball body parts and brass parts floating together'), ('spin1', 'rotating: seen from the front-right, the crank lever swung forward'),
                        ('spin2', 'rotating: seen from the back, the crank lever swung to the side'), ('spin3', 'rotating: seen from the front-left, the crank lever swung backward'),
                        ('fail', 'jammed and tilted, snow clogging the blade housing, eyes dizzy'), ('boom', 'cracked all over with blue light shining from the cracks, about to explode'), ('idle2', 'standing still, winking')]}),
    'trickjack': dict(h=140, hold=None, sheets=('act',), holes=True,
        desc=CUTE + 'Trick Jack, a giant jack-o-lantern helper: a huge orange pumpkin head with a mischievous carved grin and glowing orange eyes, a small crooked witch hat, a short stubby body in a purple cape, '
             'two short legs in striped stockings, big white gloved hands holding a brass lava nozzle hose.',
        custom={'act': [('idle', 'standing, grinning, the nozzle held at the hip'), ('walk1', 'waddling forward, near leg forward'), ('walk2', 'waddling, legs together, body bobbing up'),
                        ('walk3', 'waddling forward, far leg forward'), ('walk4', 'waddling, legs together, body bobbing down'), ('spray1', 'pointing the lava nozzle forward, leaning back to brace'),
                        ('spray2', 'pointing the lava nozzle forward, pushing forward, cape flapping'), ('turn', 'turning around, looking over its shoulder with a cheeky grin')]}),
    'ouro': dict(h=150, hold=None, sheets=('act',), holes=True,
        desc=MACHINE.replace('NO person, NO character, nobody riding or operating it. ', '') + 'The Ouroboros Ring: a big ring-shaped caterpillar-track vehicle designed as a purple and gold mechanical snake biting its own tail, '
             'riveted gold scales, glowing pink eyes; four tiny cute helpers ride on the top of the ring: a pumpkin-headed doll, a little snowman, a small yellow electric eel and a black cat. Nobody else.',
        custom={'act': [('idle', 'standing still, the snake eyes glowing'), ('build', 'half assembled: ring segments floating together, the helpers waving'), ('move1', 'rolling forward, the treads turning, helpers cheering'),
                        ('move2', 'rolling forward, bouncing slightly, helpers holding on'), ('grab1', 'the snake jaws opened wide, pulling inward'), ('grab2', 'the snake jaws clamped shut on its tail, the ring squeezed tighter'),
                        ('boom', 'cracked and glowing pink-white, about to explode, the helpers jumping off'), ('idle2', 'standing still, the helpers waving')]}),
    'coaster': dict(h=130, hold=None, sheets=('act',), holes=True,
        desc=MACHINE.replace('NO person, NO character, nobody riding or operating it. ', '') + 'The Goblin Express, a cute roller coaster train of three small carts on a short straight rail segment: the front cart shaped like a grinning jack-o-lantern, '
             'a little snowman driving the front cart, a small yellow electric eel in the middle cart holding a lightning rod, a pumpkin-headed doll pulling a big lever in the back cart, a black cat waving. Nobody else.',
        custom={'act': [('ride1', 'speeding forward, carts level'), ('ride2', 'speeding forward, carts bouncing up'), ('derail', 'derailing: the carts tipping over and flying off the rail, riders surprised'),
                        ('idle', 'standing still on the rail'), ('ride3', 'speeding forward, riders cheering with arms up'), ('climb', 'climbing up a slope, tilted up'),
                        ('dive', 'diving down a slope, tilted down'), ('boom', 'the carts cracked and glowing, about to explode')]}),
    'wtAwk': dict(h=120, hold=None, sheets=('act',), holes=True,
        desc=MACHINE + 'Four different magic machines standing side by side in a row: (1) an electric field generator: a brass tripod with a glowing yellow orb and two coil antennas; '
             '(2) a pumpkin factory: a boxy orange workshop machine with a pumpkin-shaped chimney and a conveyor hatch; (3) a snowman spinner: a round white snowman-shaped machine on a turntable with a scoop arm; '
             '(4) a giant cat machine: a huge black cat-head shaped machine with a big hinged mouth and a boxing glove inside.',
        custom={'act': [('field1', 'the electric field generator alone, idle'), ('field2', 'the electric field generator alone, the orb glowing bright'), ('pumpkin1', 'the pumpkin factory alone, idle'),
                        ('pumpkin2', 'the pumpkin factory alone, the hatch open'), ('snow1', 'the snowman spinner alone, idle'), ('snow2', 'the snowman spinner alone, turned sideways mid-spin, scoop arm swung out'),
                        ('cat1', 'the giant cat machine alone, mouth closed'), ('cat2', 'the giant cat machine alone, mouth wide open with the boxing glove punching forward')]}),
    'candyDoll': dict(h=46, hold=None, sheets=('act',), holes=True,
        desc=CUTE + 'A candy doll: a tiny round doll made of a black-and-dark-purple swirl lollipop head with two button eyes and a stitched smile, a little wrapper-like dress, tiny stubby arms and legs.',
        custom={'act': [('idle', 'standing, smiling'), ('walk1', 'running forward, near leg forward'), ('walk2', 'running, legs together'), ('walk3', 'running forward, far leg forward'),
                        ('walk4', 'running, legs together, bobbing'), ('hop1', 'hopping up with arms raised'), ('hop2', 'landing from a hop, squashed'), ('pop', 'puffed up round, eyes wide, about to pop')]}),
})
HELPER = {'helperJack': 'a pumpkin-head hood, an orange and black maid-like work dress, a little lantern', 'helperSnow': 'a white snowman-shaped hood with a carrot on the hood and a knitted red scarf, a white work dress',
          'helperEel': 'a yellow raincoat with an electric-eel shaped hood with little fins, rubber boots', 'helperCat': 'a black cat-eared hood, a black and purple work dress, a long black cat tail'}
for k, v in HELPER.items():
    A.M[k] = dict(h=70, hold=None, sheets=('act',), holes=True,
        desc=CUTE + f'A familiar homunculus helper: a small cute artificial girl the size of a child, round face, big eyes, wearing {v}, work gloves. Modest outfit.',
        custom={'act': [('idle', 'standing, hands on hips'), ('walk1', 'trotting forward, near leg forward'), ('walk2', 'trotting, legs together'), ('walk3', 'trotting forward, far leg forward'),
                        ('walk4', 'trotting, legs together, bobbing'), ('atk1', 'winding up to throw or strike, arm pulled back'), ('atk2', 'throwing or striking forward, arm extended'), ('cast1', 'both arms raised, casting a spell')]})
_nf = frames2.names_for
def names_for(char, sheet):
    d = A.M.get(char)
    if d and d.get('custom') and sheet in d['custom']: return [None] + [n for n, _ in d['custom'][sheet]]
    return _nf(char, sheet)
frames2.names_for = names_for
_sj = A.sheet_job
def sheet_job(name, sheet):
    d = A.M[name]
    if d.get('custom') and sheet in d['custom']:
        import sheets2
        out = os.path.join(A.SRC, 'sheets2', f'{name}_{sheet}.png'); ref = os.path.join(A.SRC, f'{name}_ref.png')
        return out, sheets2.prompt([t for _, t in d['custom'][sheet]], None), [ref]
    return _sj(name, sheet)
A.sheet_job = sheet_job

if __name__ == '__main__':
    A.main()
