#!/usr/bin/env python3
"""武器 v2 生图：一把武器一张图（1536x1024 白底，横放、握柄在左、尖端 / 枪口 / 杖头在右）→ 主仓库 art/src/avatar/weapons2/<key>.png
  weapon_gen.py <key 或前缀，逗号隔开 | all> [--force] [-j 2]
  例：weapon_gen.py ep_ss_shura,shortsword     weapon_gen.py ep_     weapon_gen.py all
统一画风：同一段风格提示词 STYLE + 同一张画风参考图 weapons2/style_ref.png（三职业立绘拼成一张）；
品级外观 <类型>_r2/_r3/_r4 另带同类型的基础外观 weapons2/<类型>.png 当“同一家族”参考（所以基础外观先出）。
设计文字沿用 avatar_gen.py 的 BOLD（类型剪影）/ BOLD_EPICS（史诗）/ WEAPON_SKINS（装扮）；EPIC_V2 里是重写过的史诗设计。
出图后跑 avatar_weapons.py 切图（有 weapons2/<key>.png 的优先用它）。并发 -j 4（最多 6，三家中转自动分摊）。
"""
import os, sys, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import avatar_gen as G

G.SH.upload = lambda base, key, p: 'local:' + os.path.abspath(p)   # 路由自己传图；不走共享的上传缓存文件（两个线程同时读写会读到半个 JSON）
V2 = os.path.join(G.OUT, 'weapons2')
STYLE_REF = os.path.join(V2, 'style_ref.png')
SIZE = '1536x1024'

BASE = {   # 普通 / 高级：好看但朴素
    'shortsword': 'a short straight double-edged sword with a small brass crossguard, a blue leather-wrapped grip and a round brass pommel',
    'katana': 'a katana with a polished steel blade with a wavy temper line, a round dark iron tsuba with a brass rim and a navy diamond-wrapped hilt',
    'club': 'a spiked iron mace: a wooden handle with leather wrapping and a big round iron head with short thick spikes',
    'greatsword': 'a massive two-handed greatsword: a very broad thick straight steel blade with a central fuller, a heavy iron crossguard, a long leather-wrapped grip and a round iron pommel',
    'lightsaber': 'a lightsaber: a ribbed silver metal hilt with black grip bands and a small emitter guard, and a straight thick cyan-blue energy blade with a white core and a rounded tip',
    'revolver': 'a silver revolver with a big round cylinder, a thick barrel and a brown wooden grip',
    'autopistol': 'a black semi-automatic pistol with a thick slide, a textured grip and a steel trigger guard',
    'rifle': 'a musket-style rifle: a brown wooden stock on the left, a brass trigger under the middle and a long steel barrel with brass bands',
    'handcannon': 'a stubby hand cannon: a fat dark iron barrel with brass rings and a wide flared muzzle, a wooden pistol grip',
    'bowgun': 'a wooden hand crossbow: a pistol-grip stock on the left, a loaded steel-tipped bolt and dark curved bow limbs with a taut string at the front',
    'spear': 'a spear: a navy blue shaft with brass bands and a brass butt cap, and a big leaf-shaped polished steel spearhead',
    'pole': 'a fighting staff: a smooth dark hardwood pole with big steel caps on both ends and a leather grip wrap in the middle',
    'rod': 'a magic wand: a twisted wooden handle with a brass pommel and a big shining gold star on the tip',
    'staff': 'a mage staff: a twisted golden-brown wooden shaft, a big sky-blue crystal orb held by curling wooden prongs at the head',
    'broom': 'a witch broom: a long wooden handle and a big bushy golden straw brush tied with red cord',
}
TIER = {   # 稀有 / 神器 / 传说：同一家族，剪影一级比一级大、一级比一级华丽（不能只换颜色）
    2: 'RARE grade (purple): the basic weapon shown in the second image, upgraded with ONE added feature: an engraved silver trim band and one faceted purple amethyst gem; '
       'polished steel with violet accents; the same size and outline as the basic weapon plus that small addition',
    3: 'ARTIFACT grade (pink): a clearly more ornate version of the basic weapon in the second image: a BIGGER guard / head / body with side ornaments sticking out on both sides '
       '(fins, curls or small spikes), engraved silver with rose-pink enamel and a large faceted pink crystal',
    4: 'LEGENDARY grade (orange-gold): the most magnificent version of the basic weapon in the second image: the largest and longest, a pair of golden wings or a halo-like crest on the '
       'guard / head / body, gold and bright orange with a big faceted amber gem, flowing gold filigree and glowing orange rune lines painted on it',
}
EPIC_V2 = {   # 重写过的史诗设计（没写的用 avatar_gen.BOLD_EPICS）
    'ep_gs_evildragon': 'Evil Dragon Demon Sword: a straight jagged purple-black blade with bone-white spikes along both edges and glowing violet rune lines down the center, ending in a straight sharp point; '
                        'the crossguard is a black dragon skull with one red gem eye and small bone horns, a dark purple wrapped grip and a spiked black pommel',
    'ep_gs_conqueror': 'Wing of the Conqueror: a straight broad bronze-gold blade with feather-shaped serrations along both edges like two folded golden wings, glowing gold runes down the center, '
                       'ending in a straight sharp point; a crimson-and-gold eagle-head crossguard with a red gem, a red wrapped grip and a gold pommel',
    'ep_ss_shura': "Asura's Slaughter, the top abyss short sword: a wide black obsidian blade with a jagged glowing crimson cutting edge, a purple demon eye engraved at the base of the blade "
                   'with thin crimson rune lines running from it along the blade, a black-and-silver guard shaped like two curled demon horns holding a big purple gem, a crimson-wrapped grip and a spiked silver pommel',
    'ep_ls_elegy': 'Elegy of Blood: an ornate black-and-silver hilt wrapped in thorny vines, a big crimson rose blooming where the blade comes out and a short red ribbon hanging from the pommel; '
                   'a THICK solid straight blood-red energy blade with a bright pink-white core and a straight rounded tip (no hook, no curve)',
    'ep_kt_ninedragon': 'Nine Dragons Soul Guard: a deep jade-colored blade with a gold dragon coiling along its back edge, a gold dragon-head tsuba with red gem eyes, '
                        'a jade-and-black wrapped hilt and a gold dragon-claw pommel holding a pearl',
    'ep_rv_python': 'Golden Python .33: a heavy long-barreled gold revolver; a gold python coils around the barrel and its fanged open-mouthed head forms the muzzle, emerald gem eyes, '
                    'an engraved big round cylinder, a dark ebony grip with gold inlay',
    'ep_cb_soulmate': 'Soulmate Thunder: a white-and-gold war hammer with a big block-shaped white stone head engraved with a bright yellow lightning-bolt emblem, '
                      'small golden wing ornaments on both sides of the head and a gold handle',   # 原描述（头上坐着黄色小雷精）被安全审核拒绝
    'ep_st_moon':'Moonstream Staff: a slender silver and ice-blue staff topped with a BIG silver crescent moon cradling a glowing pale-blue moon orb, small crystal shards fixed along the crescent, '
                  'flowing silver ribbons tied below the head',
}
THICK = {   # 第一批出图时这两类刀身画得太细（巨剑像普通长剑、太刀像一根线），1 倍下看不清
    'greatsword': 'IMPORTANT: a GIANT heavy two-handed greatsword, never a normal longsword: the blade is a huge thick slab about one quarter as wide as the whole weapon is long, much wider than the grip is long. '
                  'The blade runs perfectly STRAIGHT along the center line and ends in a straight sharp point (or a squared chisel tip) centered on that line; '
                  'absolutely NO hook, no curved, curled, bent, forked or scythe-like tip, the point never turns up or down. Decorative spikes or serrations may run along the edges but the outline stays straight and roughly symmetric.',
    'katana': 'IMPORTANT: the blade is clearly wide and thick for a katana (its width is about one ninth of the whole weapon length), never a thin line. '
              'The blade is almost straight (only a very slight natural curve) and ends in a clean pointed tip; NO hook, no curled, forked or scythe-like tip.',
    # 用户（2026-09-29）：所有刀剑都要直刃直尖，不许弯钩卷尖
    'shortsword': 'IMPORTANT: the blade runs STRAIGHT along the center line and ends in a straight sharp point; NO hook, no curled, forked, bent or scythe-like tip.',
    'lightsaber': 'IMPORTANT: the energy blade is a STRAIGHT thick beam along the center line ending in a straight rounded or pointed tip; NO hook, no curve, no curled or scythe-like tip.',
}
APOPHIS = ('Apophis the cursed demon sword, THE SHOWPIECE and the most menacing, domineering greatsword of all. '   # 按官方立绘的要素重写（2026-09-29）：紫色直刃、蓝色眼宝石、骷髅护手 + 两对角、三骷髅柄头，没有弯钩
           'A huge, wide, perfectly straight double-edged blade of deep glossy violet-purple with bright silver bevelled cutting edges, widest near the guard and tapering in long straight lines '
           'to a sharp point on the center line. Near the base of the blade a pair of sharp crescent-shaped flanges juts out from both edges. '
           'At the base of the blade sits a big glowing sapphire-blue gem shaped like a slit demon eye, set in an ornate magenta-red tribal frame, with a thin glowing red line running from the eye '
           'down the middle of the blade and engraved silver tribal patterns beside it. The crossguard is a grinning bone-white skull with two pairs of curved demon horns sweeping back toward the grip: '
           'big red ridged horns on the outside and smaller teal-blue horns inside. A long dark leather-wrapped grip, and a pommel made of a cluster of three small carved skulls')

STYLE = ('Premium 2D game weapon art for a cute chibi (Q-style) action RPG in the style of Dungeon Fighter Online weapon avatars. '
         'Draw exactly ONE weapon, alone, lying perfectly HORIZONTAL in strict side view (flat profile, not diagonal, no perspective), '
         'the grip / handle / stock at the LEFT end and the blade tip / muzzle / head pointing to the RIGHT, centered and spanning about 85% of the image width. '
         '{what} '
         'Rendering: thick clean dark outline around the whole silhouette and the main parts, crisp cel shading with one light and one dark tone plus sharp white highlights, '
         'rich materials (polished metal with bright reflections, faceted gems with glints, engraved gold or silver filigree, wrapped leather or silk cord); '
         'any glowing runes, energy or crystal light is painted INSIDE the weapon as bright flat shapes with a lighter core. '
         'Big bold readable shapes that stay recognizable when shown small. '
         'Match the line weight, colors and cel shading of the chibi characters in the first image (they are only a style reference: do not copy their weapons). '
         'No hands, no character, no text, no frame, no cast shadow, no glow halo or aura outside the silhouette, no sparks, no particles, no smoke, no motion lines. '
         'Do not use pure neon green (#00FF00) or pure magenta (#FF00FF) anywhere. Plain pure white background.')
EPIC_LINE = 'This is an EPIC-grade showpiece weapon: luxurious and unmistakable, with an iconic silhouette, ornate fittings, big faceted gems and glowing rune lines painted into it.'

def all_keys():
    ks = list(BASE) + [f'{t}_r{r}' for t in BASE for r in (2, 3, 4)] + [k for L in G.BOLD_EPICS.values() for k, _ in L]
    ks += [f'{sk}_{t}' for sk, per in G.WEAPON_SKINS.items() for L in per.values() for t, _ in L]
    return ks

def spec(key):
    """key → (武器类型, 描述, 参考图列表)"""
    refs = [STYLE_REF]
    if key in BASE: t = key; d = f'COMMON grade: a clean, handsome, well-made basic weapon, no gems. Design: {BASE[key]}.'
    elif key[:-3] in BASE and key[-3:-1] == '_r':
        t = key[:-3]; d = f'{TIER[int(key[-1])]}.'; refs.append(os.path.join(V2, f'{t}.png'))
    elif key.startswith('ep_'):
        t = next(t for t, L in G.BOLD_EPICS.items() if any(k == key for k, _ in L))
        d = APOPHIS if key == 'ep_gs_apophis' else EPIC_V2.get(key) or dict(G.BOLD_EPICS[t])[key]
        d = f'Design: {d}. {EPIC_LINE}'
    else:
        sk, t = key.split('_', 1)
        d = f'Design: {dict((w, x) for L in G.WEAPON_SKINS[sk].values() for w, x in L)[t]}.'
    what = f'Weapon type: {G.BOLD[t]}. {d} {THICK.get(t, "")}'
    if len(refs) > 1: what += ' The second image shows the basic weapon of this family: keep its weapon type, proportions and overall design, restyled for this grade.'
    return t, what, refs

def job(key):
    t, what, refs = spec(key)
    return {'out': os.path.join(V2, f'{key}.png'), 'refs': refs, 'prompt': STYLE.format(what=what), 'size': SIZE}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('only'); ap.add_argument('--force', action='store_true'); ap.add_argument('-j', type=int, default=2)
    ap.add_argument('--show', action='store_true')   # 只打印提示词
    a = ap.parse_args()
    pre = a.only.split(',')
    keys = [k for k in all_keys() if a.only == 'all' or any(k == p or k.startswith(p) for p in pre)]
    if a.show:
        for k in keys: print(k, '\n ', job(k)['prompt'], '\n  refs', job(k)['refs'])
        return
    base, key, _ = G.gi.load_cfg()
    first = [k for k in keys if k in BASE]; rest = [k for k in keys if k not in BASE]   # 基础外观先出（品级外观要拿它当参考）
    print(f'{len(keys)} 把', flush=True)
    for batch in (first, rest):
        with ThreadPoolExecutor(min(6, a.j)) as ex:
            fs = {ex.submit(G.run, job(k), base, key, a.force): k for k in batch}
            for f in as_completed(fs):
                try: print(f.result(), flush=True)
                except Exception as e: print(f'FAIL {fs[f]}: {e}', flush=True)   # 一把失败不影响其他（重跑同一条命令只补缺的）

if __name__ == '__main__':
    main()
