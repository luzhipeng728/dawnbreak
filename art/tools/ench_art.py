#!/usr/bin/env python3
"""小魔女的召唤物 / 物件美术（魔法师对齐组）：疯疯熊、僵尸人偶、林中小屋。流水线同 witch_art.py（sky_art 的参考立绘 → 动作表 → 切帧，支持自定义帧名）。
AI 原图写到主仓库 art/src/ench/；最终 webp 写到本仓库 art/final/spr/<id>/。

  ench_art.py refs|sheets|cut [--only 前缀]
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import witch_art as W   # 复用自定义帧名的补丁（names_for / sheet_job）
A = W.A
A.SRC = os.path.join(A.MAIN, 'src', 'ench')
A.M = {
    'madbear': dict(h=100, hold=None, sheets=('walk', 'act', 'more'),
        desc='Mad, a big creepy-cute stitched teddy bear puppet: brown fur made of patched fabric with visible cross stitches, mismatched black button eyes, a stitched smile, '
             'one ear half torn and sewn back, a purple patch on the belly, big round paws with sharp little claws, standing upright like a guardian, faint puppet strings from its shoulders.',
        atk='its clawed paws', cast='roaring with both arms raised', low='crouching to leap',
        custom={'act': [('scratch1', 'slashing forward with the right claws, body twisted, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('scratch2', 'slashing forward with the left claws, body twisted the other way, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('punch1', 'pulling one paw back to punch, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('punch2', 'punching forward, the whole forearm shooting forward on a stretched string, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('slam1', 'raising both paws high overhead, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('slam2', 'slamming both paws down onto the ground, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                        ('guard', 'standing in front with both arms spread wide, blocking and protecting, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('hurt', 'flinching backward, a few stitches coming loose, the two thin puppet strings from its shoulders going straight up out of frame as always')],
                'more': [('leap', 'leaping high into the air with arms up, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('fall', 'falling down from the sky belly-first, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('roar', 'roaring with its mouth wide open and both arms raised, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('claw1', 'wild frenzied clawing, a flurry of paws, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('claw2', 'wild frenzied clawing, the other paw, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('idle2', 'sitting lazily with its legs out, head tilted, the two thin puppet strings from its shoulders going straight up out of frame as always'),
                         ('cheer', 'hopping happily with both arms up, the two thin puppet strings from its shoulders going straight up out of frame as always'), ('down', 'lying flat on its back, limp like a doll, the two thin puppet strings from its shoulders going straight up out of frame as always')]}),
    'zombiedoll': dict(h=46, hold=None, sheets=('walk', 'act'),
        desc='A small cursed zombie puppet doll: a pale greenish rag doll with stitched X eyes, a crooked stitched mouth, patched clothes, a big rusty needle stuck in its head, wobbly arms stretched forward.',
        atk='its wobbly arms', cast='swelling up glowing purple', low='lunging forward',
        custom={'act': [('run1', 'running forward clumsily with arms stretched out'), ('run2', 'running forward clumsily, other leg'), ('swell1', 'starting to glow purple and swell, eyes spinning'),
                        ('swell2', 'swollen round and glowing bright purple, about to pop'), ('grab', 'hugging onto something tightly'), ('fall', 'tripping and falling flat'),
                        ('idle2', 'standing and swaying creepily'), ('cheer', 'waving both arms')]}),
    'thornhut': dict(h=120, hold=None, sheets=('act',), holes=False,
        desc='A small creepy-cute witch hut made of twisting black thorny vines and dark wood planks, a round door with a glowing violet keyhole, red roses growing on the roof, a crooked little chimney, NO person.',
        custom={'act': [('idle', 'standing still, roses gently glowing'), ('wiggle1', 'the whole hut wiggling and squirming to the left, vines writhing'),
                        ('wiggle2', 'the whole hut wiggling and squirming to the right, vines writhing'), ('stab', 'thorny vines shooting out sideways from the walls'),
                        ('open', 'the door swinging open with a violet glow inside'), ('grow1', 'only a small tangle of black thorny vine sprouts coming out of the ground, no hut yet'),
                        ('grow2', 'half grown: vines weaving into walls, the roof not finished yet'), ('wither', 'collapsing: the roof caved in, walls sagging, vines drying up')]}),
}

if __name__ == '__main__':
    A.main()
