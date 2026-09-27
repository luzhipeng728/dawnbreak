#!/usr/bin/env python3
"""天帷巨兽美术（地下城内容组）：和 sky_art.py 同一套流水线，只是换了怪物 / 背景设定与输出目录。
AI 原图写到主仓库 art/src/behemoth/；最终 webp 写到本仓库 art/final/spr/<id>/、art/final/bg/。
生图配额：天帷同时最多 1 个请求，429 退避 90 秒（2026-09-28 主线程规定）。

  behemoth_art.py refs|sheets|cut|bg|edge|bgcut [--only 前缀] [--sheets walk,run,act,more]
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import sky_art as A

A.SRC = os.path.join(A.MAIN, 'src', 'behemoth')
A.PAR = 1
A.BACKOFF = 95

ROLL = {   # 车辆：没有腿，走 / 跑是车轮滚动
    'walk': ['rolling forward slowly, wheels turning, front slightly up', 'rolling forward slowly, wheels turned a quarter', 'rolling forward slowly, bouncing a little', 'rolling forward slowly, wheels turned further',
             'rolling forward slowly, front slightly down', 'rolling forward slowly, wheels turned a quarter again', 'rolling forward slowly, bouncing a little again', 'rolling forward slowly, wheels almost a full turn'],
    'run': ['rushing forward fast, wheels blurred, dust behind', 'rushing forward fast, leaning forward, sparks', 'rushing forward fast, bouncing up', 'rushing forward fast, bouncing down',
            'rushing forward fast, wheels blurred, dust behind again', 'rushing forward fast, leaning forward', 'rushing forward fast, bouncing up again', 'rushing forward fast, bouncing down again'],
}
HOVERING = {   # 飞行器：螺旋桨转动、上下浮动
    'walk': ['hovering, propeller spinning, bobbing up', 'hovering, propeller blurred, at the top of the bob', 'hovering, propeller spinning, bobbing down', 'hovering at the lowest point of the bob',
             'hovering, tilted slightly forward, bobbing up', 'hovering high, smoke puff behind', 'hovering, bobbing down, propeller spinning', 'hovering low, tilted slightly back'],
    'run': ['flying forward fast, tilted forward, smoke trailing', 'flying forward fast, propeller blurred', 'flying forward fast, bobbing up', 'flying forward fast, bobbing down',
            'flying forward fast, tilted forward, smoke trailing again', 'flying forward fast, propeller blurred again', 'flying forward fast, bobbing up again', 'flying forward fast, bobbing down again'],
}
WADDLE = {   # 章鱼：用触手走路
    'walk': ['waddling forward on its tentacles, front tentacles reaching forward', 'waddling, body squashed down', 'waddling, tentacles curling under the body', 'waddling, body stretched up',
             'waddling forward, other tentacles reaching forward', 'waddling, body squashed down again', 'waddling, tentacles curling under the body again', 'waddling, body stretched up again'],
    'run': ['scurrying forward fast on its tentacles, leaning forward', 'scurrying, tentacles blurred', 'scurrying, hopping slightly up', 'scurrying, landing squashed',
            'scurrying forward fast, leaning forward again', 'scurrying, tentacles blurred again', 'scurrying, hopping slightly up again', 'scurrying, landing squashed again'],
}
SWAY = {'walk': ['swaying gently to the left', 'swaying to the left with petals opening', 'upright with petals wide open', 'swaying gently to the right',
                 'swaying to the right with petals closing', 'upright with petals half closed', 'bobbing down slightly', 'bobbing up slightly']}

A.M = {
    'gbl': dict(h=100, hold='holding the curved ritual dagger',
        desc='A GBL cultist monster (a member of an ancient sky-temple cult): a hooded pale grey and teal ritual robe with gold trim and a round sun-eye emblem on the chest, a white porcelain half-mask covering the eyes, pale skin, a rope belt with little charms, sandals, holding a curved ritual dagger.',
        atk='the curved ritual dagger', cast='raising the dagger overhead and chanting', low='lunging forward low with the dagger thrust out'),
    'octopus': dict(h=72, hold=None, cycle=WADDLE,
        desc='An octopus monster that walks upright on its tentacles: a round purple-pink head with big yellow eyes and a small beak mouth, eight wiggly tentacles (two used like arms), suction cups, shiny slimy skin, a little seaweed on its head.',
        atk='two tentacle arms slapping', cast='puffing up its cheeks to spit ink', low='crouching flat ready to jump'),
    'yaksha': dict(h=104, hold='holding two curved short blades',
        desc='A yaksha demon warrior monster: dark red skin, wild white hair, two small horns, glowing yellow eyes, small fangs, a bare muscular torso with gold armbands, a ragged black loincloth and sash, holding a curved short blade in each hand.',
        atk='the two curved blades', cast='crossing both blades in front of the chest with a fiery aura', low='dashing forward low with both blades held back'),
    'treant': dict(h=118, hold=None,
        desc='A treant monster (a walking tree): a thick gnarled brown bark body with a grumpy face in the trunk (glowing green eyes, a knot nose), a leafy green crown with a few small flowers, two long branch arms with twig fingers, two short stubby root legs.',
        atk='both heavy branch arms', cast='raising both branch arms as roots burst from the ground', low='hunching forward with the arms dragging on the ground'),
    'flower': dict(h=66, hold=None, cycle=SWAY, sheets=('walk', 'act', 'more'),
        desc='A confusion flower monster: a giant carnivorous flower rooted in the ground, a big pink and purple petal head with a toothy smiling mouth in the center, swirly hypnotic patterns on the petals, a thick green stem, two leaf arms, roots at the bottom, sparkling pollen around it.',
        atk='its toothy petal head biting forward', cast='opening its petals wide and puffing out sparkling pollen', low='curling down into a closed bud'),
    'dragonCannon': dict(h=70, hold=None, cycle=ROLL,
        desc='A dragon-head cannon monster (an ancient mechanical war cannon): a bronze cannon shaped like a dragon head whose open mouth is the barrel, glowing orange eyes, mounted on a small wooden cart with two big wheels, iron rivets, smoke puffing from its nostrils.',
        atk='its dragon-head barrel recoiling after a shot', cast='charging a glowing fireball inside its open mouth', low='tilting its barrel down low'),
    'sawCart': dict(h=78, hold=None, cycle=ROLL,
        desc='A saw-horned ramming cart monster: a sturdy wooden war cart with a giant circular saw blade mounted in front like a horn, bull-horn decorations, iron plates, four wheels, glowing red eye lamps, puffs of steam from a small chimney.',
        atk='its spinning saw blade', cast='revving its saw blade with sparks flying', low='lowering its saw blade to charge'),
    'donnier': dict(holes=False, h=70, hold=None, fly=True, cycle=HOVERING,
        desc='A donnier monster: a small flying gondola airship of the sky temple, a round white and gold hull with a spinning propeller on top and two little wings, a big glowing blue eye-lens at the front, a bomb hatch underneath, a little smoke trail. No legs, hovering in the air.',
        atk='a quick ramming lunge of its hull', cast='opening its bomb hatch as the eye-lens glows red', low='tilting down to aim at the ground'),
    'archbishop': dict(holes=False, h=128, hold='holding the tall golden sun staff',
        desc='The GBL Archbishop boss monster: an old cult leader wearing a tall ornate white and gold mitre hat with a sun-eye emblem, a long flowing teal and gold robe, a golden mask over the upper face, a long white beard, holding a tall golden staff topped with a glowing sun disc.',
        atk='the golden sun staff', cast='raising the sun staff high as a golden holy light shines', low='slamming the staff butt toward the ground'),
    'highPriest': dict(holes=False, h=122, hold='holding the open glowing holy book',
        desc='The GBL High Priestess boss monster: a mysterious priestess in a hooded deep purple and gold robe with a sun-eye emblem, a silver veil over the lower face, long silver hair, glowing violet eyes, little floating ritual candles around her, holding an open glowing holy book.',
        atk='a burst of light from the open book', cast='holding the book high as healing light pours out', low='kneeling slightly while reading a spell'),
    'rodin': dict(h=160, hold=None,
        desc='Rodin, the Giant Tree Guardian boss monster: an enormous ancient treant with a massive mossy trunk body, a wise angry face with glowing amber eyes and a long moss beard, a huge leafy crown with glowing flowers, two huge branch arms wrapped in thorny vines, thick root legs.',
        atk='both huge branch arms', cast='raising both arms as giant roots and thorns burst from the ground', low='slamming both arms down to the ground'),
    'yakshaKing': dict(holes=False, h=132, hold='holding the huge curved glaive',
        desc='The Yaksha King boss monster: a large demon king with crimson skin, a flaming white mane, four glowing yellow eyes, curved black horns with gold rings, ornate black and gold armor pieces, a torn red cape, holding a huge curved glaive (a long-handled blade).',
        atk='the huge curved glaive', cast='roaring with the glaive raised as a fiery shockwave bursts out', low='dashing forward very low with the glaive trailing'),
    'donnierEX': dict(holes=False, h=108, hold=None, fly=True, cycle=HOVERING,
        desc='Donnier EX boss monster: a large armored flying airship of the sky temple, a white and gold hull with glowing blue runes, a huge glowing red eye-lens at the front, a cannon turret on each side, a big propeller on top, small wings, bomb hatches underneath, trailing smoke. No legs, hovering in the air.',
        atk='a ramming lunge with its armored prow', cast='opening all bomb hatches as the red eye-lens flares', low='tilting down and aiming its cannons at the ground'),
    'lotus': dict(h=150, hold=None, cycle=WADDLE,
        desc='Lotus the Long-legged boss monster: a colossal dark purple octopus with an enormous bulbous head, many glowing red eyes, a sharp beak, a crown of coral spikes, extremely long thick tentacles spreading around it, glowing pink suction cups, dripping slime.',
        atk='a huge tentacle slam', cast='raising all tentacles high as its eyes glow', low='sinking low with the tentacles spread flat'),
    'marcel': dict(h=126, hold='holding a long ritual dagger in each hand',
        desc='Marcel the Inquisitor boss monster: a gaunt undead inquisitor of the sky-temple cult, a torn blood-red and black hooded robe with a broken sun-eye emblem, a cracked white mask, glowing red eyes, pale ghostly skin, chains wrapped around the arms, a red spectral aura, holding a long ritual dagger in each hand.',
        atk='the two ritual daggers', cast='crossing the daggers as a red barrier of light forms', low='lunging forward low with both daggers'),
}
A.HOVER = {'donnier': 42, 'donnierEX': 48}
A.BG = {
    'bhTemple': ('The outskirts of an ancient cult temple built on the back of a gigantic whale-like beast flying above a sea of clouds: weathered white stone pillars and stairs with teal and gold sun-eye banners, crumbling archways, the huge ridged back of the beast rising at the horizon, bright sky, soft mist.',
                 'ancient white temple flagstones with faded teal and gold sun-eye mosaics, cracks with grass tufts and drifts of sand, bright daylight',
                 'a low broken temple wall with small stone sun-eye statues, teal banners, potted palms and fallen column pieces'),
    'bhJungle': ('A dense magical jungle growing on the back of a giant sky beast: huge twisted trees with sleepy faces in the bark, giant hanging vines, oversized pink and purple flowers releasing sparkling pollen, glowing mushrooms, dappled green light.',
                 'jungle ground of soft moss, curling roots, fallen pink petals and small puddles, dappled green light',
                 'thick ferns, giant pink flowers, thorny vines and curling roots'),
    'bhPurgatory': ('A hellish volcanic temple deep inside a giant beast: dark obsidian temple ruins, rivers of glowing lava, fire braziers, hanging chains, red smoke and a crimson glow, ominous but still cute cartoon style.',
                    'cracked black volcanic stone floor with glowing orange lava cracks, ash and small bones, warm red light',
                    'black obsidian rocks, burning braziers, iron spikes and chains'),
    'bhDay': ('A dazzling golden sun temple under an endless midday sun (polar day, the sun never sets): white and gold terraces, giant sun-disc statues, beams of light, small round airships flying in the bright sky.',
              'shining white marble terrace floor with golden sun-ray patterns, very bright and warm',
              'a golden balustrade with small sun-disc statues, light crystals and white flowers'),
    'bhSpine': ('Inside the giant spine of a colossal sky beast: huge ivory vertebra bones forming arches, pink-purple fleshy walls with softly glowing veins, pools of sea water, coral and barnacles, bioluminescent light, a mysterious deep-sea mood.',
                'wet ivory bone floor plates with sea water puddles, barnacles and small pink corals, soft blue-pink light',
                'bone ridges, coral clusters, barnacles and glowing sea anemones'),
    'bhForbidden': ('The forbidden sanctum of a cursed cult deep inside a giant beast: dark stone halls with blood-red banners, broken sun-eye statues, rows of red candles, ghostly red wisps, chains and stone coffins, eerie crimson light, still cute cartoon style.',
                    'dark cracked temple floor with a faded blood-red ritual circle, melted red candles and scattered paper talismans',
                    'broken statues, red candles, stone coffins and chains'),
}
A.FLOOR_W = {'bhTemple': 1800, 'bhJungle': 2000, 'bhPurgatory': 1700, 'bhDay': 1800, 'bhSpine': 1800, 'bhForbidden': 1700}

# 地下城门（沿用世界组 jobs.py 的 GATE 画风；原图写到主仓库 art/src/world/，再用 worldprep.py 处理成 art/final/world/g_<id>.webp）
GATES = {
    'g_temple_outskirts': 'an ancient sky-cult temple gate: a white stone temple doorway with teal and gold sun-eye banners, two small sun-disc pillars, weathered carvings, a teal portal',
    'g_treant_jungle': 'a magical jungle gate: an arch formed by two giant living trees with sleepy faces in the bark, hanging vines and big pink flowers, sparkling pollen, a bright green portal',
    'g_purgatory': 'a hellish temple gate: a black obsidian arch with glowing lava cracks, two burning braziers, chains and small horned demon masks, a fiery orange-red portal',
    'g_polar_day': 'a sun temple gate: a dazzling gold and white archway crowned with a huge radiant sun disc, rays of light, a small airship statue on top, a bright pale-gold portal',
    'g_second_spine': 'a giant beast spine gate: an arch made of huge ivory vertebra bones covered with pink coral and barnacles, dripping sea water, a purple-violet portal',
    'g_forbidden_land': 'a forbidden cult sanctum gate: a dark stone arch with a broken sun-eye emblem, blood-red banners, chains, red candles and a stone coffin on each side, a blood-red portal',
}

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'gates':
        import jobs
        from concurrent.futures import ThreadPoolExecutor
        L = [(os.path.join(A.MAIN, 'src', 'world', f'{n}.png'), f'{d}. {jobs.GATE}', '1536x1024', None, ()) for n, d in GATES.items()]
        with ThreadPoolExecutor(A.PAR) as ex:
            for r in ex.map(lambda j: A.gen(*j), L): print(r, flush=True)
    else:
        A.main()
