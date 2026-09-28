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
A.PAR = 2
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
    'furnace': dict(h=110, hold=None, sheets=('act',), holes=False,
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
    'tesla': dict(h=130, hold=None, sheets=('act',), holes=False,
        desc=MACHINE + 'An electric eel tower: a tall tesla-coil tower topped with two little eel-like antenna horns and a glowing yellow orb, with a big wooden hamster wheel at its base (empty), copper coils and brass rings.',
        custom={'act': [('idle', 'standing still, the orb dim'), ('spin1', 'the hamster wheel turned a quarter, the coils glowing orange'), ('spin2', 'the hamster wheel turned half, the orb glowing brighter'),
                        ('zap1', 'the top orb glowing blinding white-yellow, the eel antennas pointing forward'), ('zap2', 'the top orb dimming back, the eel antennas relaxed'), ('fail', 'leaning to one side, the top orb dark and cracked, the wheel stopped'),
                        ('boom', 'overloaded and glowing white, about to explode'), ('build', 'half assembled: coils and wheel parts floating together')]}),
    'antigrav': dict(h=60, hold=None, sheets=('act',), holes=False,
        desc=MACHINE + 'An anti-gravity device: a small round brass platform with a purple glowing lens on top, little light bulbs around the rim, stubby legs, a black cat ear shape on the top.',
        custom={'act': [('idle', 'standing still, lens dim'), ('on1', 'lens glowing bright purple, bulbs flashing'), ('on2', 'the lens glowing very bright purple, legs braced wide'),
                        ('on3', 'the lens glowing purple, the rim bulbs all lit'), ('off', 'powering down, the lens dim'), ('fail', 'tilted, the lens cracked and dark'),
                        ('boom', 'glowing white hot, about to explode'), ('build', 'half assembled: parts floating together')]}),
}
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
