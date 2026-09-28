#!/usr/bin/env python3
"""召唤师召唤兽美术（魔法师对齐组）：和 sky_art.py 同一套流水线（参考立绘 → 动作表 → 切帧），只换设定与输出目录。
AI 原图写到主仓库 art/src/summon/；最终 webp 写到本仓库 art/final/spr/<id>/。
召唤兽在地下城里不会被打，所以只出 walk / act / more 三张表（run 用 walk 加速代替）。
赫德尔复用哥布林十夫长（goblinCaptain），库鲁塔复用牛头王（tauKing），不在这里生成。

  summon_art.py refs|sheets|cut [--only 前缀] [--sheets walk,act,more]
生图配额：本组同时最多 1 个请求（主线程 09-28 定），429 退避 65 秒。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import sky_art as A
import witch_art   # 自定义帧名的动作表补丁（names_for / sheet_job），卡西利亚斯用；下面会把 SRC / M 换回召唤师自己的

A.SRC = os.path.join(A.MAIN, 'src', 'summon')
A.PAR = 1
A.BACKOFF = 65

SPIRIT_HOVER = {   # 浮空精灵：没有腿，上下浮动
    'walk': ['floating and bobbing slightly up', 'floating at the top of the bob, tilted slightly forward', 'floating and bobbing down', 'floating at the lowest point of the bob',
             'floating and bobbing up again, sparkles trailing', 'floating high, tilted slightly back', 'floating down, leaning forward', 'floating low, glancing forward'],
    'run': ['gliding forward fast tilted forward, a light trail behind', 'gliding forward fast, bobbing up', 'gliding forward fast, bobbing down', 'gliding forward fast, trail streaming',
            'gliding forward fast tilted forward again', 'gliding forward fast, bobbing up again', 'gliding forward fast, bobbing down again', 'gliding forward fast, trail streaming again'],
}
ROOTED = {'walk': ['swaying gently to the left', 'swaying to the left with the petals opening', 'upright with the petals wide open', 'swaying gently to the right',
                   'swaying to the right with the petals closing', 'upright with the petals half closed', 'bobbing down slightly', 'bobbing up slightly']}
SUMMON_SHEETS = ('walk', 'act', 'more')

A.M = {
    'sandor': dict(h=124, hold='holding a black longsword and a round dark shield', sheets=SUMMON_SHEETS,
        desc='Sandor the Black Knight, a summoned spirit knight: tall dark obsidian plate armor with violet trim, a closed horned great helm with a glowing violet visor slit, '
             'a tattered dark purple cape, holding a black longsword in the right hand and a round dark shield with a silver crescent moon emblem in the left hand.',
        atk='the black longsword', cast='raising the shield and the sword as a violet aura glows around the armor', low='lunging forward with a straight sword thrust'),
    'ador': dict(h=60, hold=None, sheets=SUMMON_SHEETS,
        desc='Ador, a small fire spirit: a cute little creature made of living flame, a round glowing orange-red flame body, tiny stubby arms and feet, big bright yellow eyes, '
             'a flickering flame crest on its head, small sparks floating around it.',
        atk='its flaming little fists', cast='puffing up and flaring its flames brightly', low='hopping forward low'),
    'naias': dict(h=58, hold=None, fly=True, cycle=SPIRIT_HOVER, sheets=SUMMON_SHEETS, holes=False,
        desc='Naias, a small water spirit creature (NOT a human, NOT a woman): a round chubby water-droplet body the size of a cat, translucent light-blue water, a tiny curled fish tail, '
             'two little fin-like arms, big round cyan eyes and a small smile, a little ice crystal sprouting on top of its head, water sparkles around it.',
        atk='a splash of icy water from its little fins', cast='puffing up as a small ice crystal forms above its head', low='diving forward low'),
    'stalker': dict(h=56, hold=None, sheets=SUMMON_SHEETS,
        desc='Stalker, a small shadow spirit: a cute black and purple shadow imp with a wispy smoky body, long pointed ears, glowing violet eyes, a toothy grin, small sharp claws, '
             'crouching like a cat.',
        atk='its small sharp claws', cast='rearing up as dark purple smoke swirls around', low='pouncing forward low like a cat'),
    'wisp': dict(h=54, hold=None, fly=True, cycle=SPIRIT_HOVER, sheets=SUMMON_SHEETS, holes=False,
        desc='Wisp, a small light spirit (NO human, NO girl, the creature alone): a floating glowing pale-yellow ball of light the size of a cat with a cute simple face (two dot eyes and a smile), '
             'two tiny wing-like light petals on its sides, a short glowing wispy tail, little sparkles and small electric arcs around it.',
        atk='a zap of lightning from its body', cast='glowing brightly with crackling electric arcs', low='darting forward low'),
    'frit': dict(h=70, hold=None, sheets=SUMMON_SHEETS,
        desc='Frit, a small baby fire dragon: stout red scales with a cream belly, two short curved horns, tiny wings, a flame-tipped tail, big amber eyes, walking on two stubby legs '
             'with small clawed hands.',
        atk='its snapping jaws', cast='rearing back and breathing out a burst of fire', low='crouching low and roaring'),
    'aukuso': dict(h=110, hold=None, cycle=ROOTED, sheets=SUMMON_SHEETS,
        desc='Aukuso, a demon-realm carnivorous flower: a large dark crimson and black flower rooted in the ground with thick thorny dark-green vines, a giant petal head with a toothy maw '
             'in the center, glowing poison-green spots, several small whip-like vine tentacles around the stem.',
        atk='its thorny vine tentacles', cast='opening its petals wide and puffing out a cloud of green poison spores', low='curling down and stabbing roots into the ground'),
    'luise': dict(h=112, hold='holding a slender lantern-staff', sheets=SUMMON_SHEETS,
        desc='Luise, a summoned sorceress of fire and ice (she must NOT look like a purple-haired witch): long silver-white hair in a high side ponytail, sharp red eyes, '
             'a small tilted crimson top hat decorated with a burning red rose and an ice crystal, a modest high-collared deep crimson and black gothic dress (no cleavage, knee-length layered skirt) with an ice-blue inner lining, opaque black tights, '
             'a short black capelet shaped like folded bat wings, black thigh-high boots, holding a slender black lantern-staff: a red flame burns in the lantern at the top and a blue ice crystal hangs below it.',
        atk='the lantern-staff', cast='raising the lantern-staff as a fireball and an ice shard form above it', low='swinging the lantern-staff forward low'),
    'merkle': dict(h=128, hold='holding a huge purple scythe', sheets=SUMMON_SHEETS,
        desc='Dead Merkle, a large dark spirit: a hooded reaper-like shadow wraith in tattered black robes, glowing purple eyes in the dark hood, skeletal grey hands holding a huge purple scythe, '
             'its lower body fading into dark smoke close to the ground.',
        atk='the huge purple scythe', cast='raising the scythe as dark purple mist spreads on the ground', low='swinging the scythe low along the ground'),
    'glarelin': dict(holes=False, h=130, hold=None, fly=True, cycle=SPIRIT_HOVER, sheets=SUMMON_SHEETS,
        desc='Glarelin, a large light spirit: a floating luminous angel-like being made of pale gold light, a smooth white mask face with a glowing eye mark, flowing light-ribbon arms, '
             'a crown of lightning bolts, electric arcs crackling around, no legs.',
        atk='a light-ribbon arm striking forward', cast='raising both ribbon arms as lightning gathers above', low='leaning forward pointing down to call lightning'),
    'aqueris': dict(holes=False, h=130, hold=None, fly=True, cycle=SPIRIT_HOVER, sheets=SUMMON_SHEETS,
        desc='Aqueris, a large ice spirit: a floating elegant ice maiden made of translucent blue ice crystal, long flowing frost hair, a crystal tiara, icy shards orbiting her, '
             'a trailing misty skirt instead of legs.',
        atk='a thrust of ice shards from one hand', cast='raising both hands as a swirling blizzard forms', low='leaning forward launching ice missiles'),
    'flamehulk': dict(h=132, hold='holding a flaming short sword', sheets=SUMMON_SHEETS,
        desc='Flame Hulk, a large fire spirit: a muscular humanoid made of dark molten lava rock with glowing orange cracks, bright flames for hair and on the shoulders, glowing yellow eyes, '
             'holding a flaming short sword.',
        atk='the flaming short sword', cast='raising the flaming sword overhead with flames roaring', low='lunging forward with a low flaming slash'),
    'echeverria': dict(holes=False, h=140, hold=None, sheets=SUMMON_SHEETS,
        desc='Echeverria the Spirit King: a tall majestic spirit queen with long hair in four elemental colors (red, blue, gold and violet streaks), a radiant crystal crown, '
             'a flowing white and gold gown with elemental gem ornaments, glowing eyes, four small elemental orbs (fire, ice, light, dark) floating around her.',
        atk='a sweep of her hand releasing elemental light', cast='raising both hands as the four elemental orbs spin and gather', low='pointing forward firing a beam'),
    # 一觉：征服者卡西利亚斯（第四使徒的分身，剑豪）。巨型，常驻霸体；出场 / 千鬼杀 / 狱冥天地这些大招的光效都在运行时画，帧里不画特效
    'casillas': dict(h=188, hold='holding the long curved nodachi katana', sheets=('walk', 'act', 'more'),
        desc='Kasijas the Conqueror, a giant legendary swordsman from another dimension: a towering broad-shouldered warrior with ashen grey-blue skin, long wild white hair flowing down his back, '
             'a black horned oni half-mask over the upper face with glowing crimson eyes, heavy dark iron samurai-style armor with crimson lacing, big layered shoulder guards, a tattered deep-red cape, '
             'a thick rope belt, holding a very long curved nodachi katana with a steel blade and a crimson-wrapped hilt, a black lacquered scabbard at his left hip.',
        atk='the long nodachi katana', cast='raising the long katana', low='lunging forward with a low slash',
        custom={'act': [('iai1', 'crouching low in a quick-draw stance, the right hand gripping the hilt at the left hip, the katana still inside its scabbard, no effects'),
                        ('iai2', 'just finished a lightning-fast horizontal quick-draw slash: the long katana extended far forward at shoulder height in the right hand, body twisted forward, no effects'),
                        ('dash', 'dashing forward low and fast, leaning far forward, the long katana held back behind him in the right hand, no speed lines'),
                        ('slash1', 'raising the long katana high above his head with both hands, ready to strike down'),
                        ('slash2', 'the long katana swung down in front of him with both hands, the blade tip near the ground, no effects'),
                        ('spin', 'mid-spin with his back turned to the viewer, the long katana extended horizontally in one hand, the cape swirling'),
                        ('sheath', 'standing upright calmly sliding the long katana back into the black scabbard at his left hip, eyes closed'),
                        ('stance', 'standing in a wide calm stance, the long katana held forward in both hands at a middle guard')],
                'more': [('plunge', 'kneeling on one knee and stabbing the long katana straight down into the ground with both hands, no cracks, no effects'),
                         ('raise', 'standing tall and holding the long katana straight up to the sky in one hand, the cape flowing'),
                         ('step1', 'stepping forward with one foot, head lowered, the long katana held low at his side'),
                         ('step2', 'standing tall after stepping forward, head raised proudly, the long katana held low at his side'),
                         ('thrust', 'a powerful straight forward thrust with the long katana, one leg lunging far forward, no effects'),
                         ('upcut', 'a rising upward slash: the long katana swung up high, body stretched upward, no effects'),
                         ('guard', 'blocking with the long katana held horizontally in front of him with both hands'),
                         ('fade', 'kneeling on one knee, both hands leaning on the katana stabbed into the ground, head bowed')]}),
}
A.HOVER = {'naias': 26, 'wisp': 30, 'glarelin': 34, 'aqueris': 34}

if __name__ == '__main__':
    A.main()
