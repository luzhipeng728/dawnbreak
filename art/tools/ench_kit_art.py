#!/usr/bin/env python3
"""小魔女（enchantress）的人物动作表 / 特效 / 图标 / 插图（小魔女组；召唤物与物件见 ench_art.py）。
沿用 combatgen.py 的流水线，只替换表的内容；原图写到主仓库 art/src/combat/，人物帧按外观流水线：
  ench_kit_art.py sheets [--only 前缀]          动作表 → <主仓库>/art/src/combat/sheets/<表>.png（样图先给主线程验收）
  ench_kit_art.py avatar wpn|set [--only 前缀]  占位棍版 / 6 套时装版（avatar_gen.py）
  ench_kit_art.py frames [--set 套装] 前缀       切帧（avatar_frames.py）
  ench_kit_art.py icons | fx | forest | cutin [--only 前缀]   生图（-j 2）
  ench_kit_art.py iconcut | fxcut | cutinprep                  切图 → art/final/{icon,fx,cutin}
生图配额：每个 agent 同时最多 2 个请求（-j 2），429 退避 65 秒。已存在的输出跳过。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 坏坏兔（Happy）：一直抱在怀里的布偶道具。每一帧都写同一句描述，保证造型一致（不用纯绿 / 纯品红）
BUNNY = ('a small cream-white stitched bunny rag doll about the size of her head, long floppy ears with dusty-pink insides (the left ear bent), '
         'one black button eye and one stitched X eye, a stitched smile, a small dusty-rose ribbon around its neck')
STAFF_KEEP = 'the staff held in the other hand'
C.SHEETS = {
    # 官方为小魔女单独加的动作：下令（牵线）、抱兔前踏 → 万岁（抛兔）、缝纫、抱紧人偶、捂耳朵、缠绷带、钉钉子
    'mage_ench1': [
        ('enCmd', f'commanding a puppet: the free hand thrust forward at shoulder height with the fingers spread and slightly bent like a puppeteer pulling strings, {STAFF_KEEP} held back, confident smirk'),
        ('enStep', f'taking a small step forward while holding {BUNNY} against her chest with the free arm, {STAFF_KEEP}'),
        ('enBanzai', f'cheerful banzai pose: both arms raised straight up overhead, tossing {BUNNY} up into the air just above her hands, the staff still gripped in one raised hand, big happy open-mouth smile'),
        ('enSew', f'the staff tucked under her arm, holding {BUNNY} in one hand at chest height and pulling a big silver sewing needle with a long red thread through its side with the other hand, gentle focused smile'),
        ('enHug', f'hugging {BUNNY} tightly to her chest with both arms, her cheek pressed against its head, eyes closed lovingly, the staff resting in the crook of her arm'),
        ('enEars', 'covering both ears with her hands, eyes squeezed shut, shoulders hunched, wincing at a very loud roar, the staff pressed against her body under one arm'),
        ('enBandage', f'the staff tucked under her arm, holding {BUNNY} in front of her in one hand and wrapping a white bandage around its body with the other hand, worried caring expression'),
        # 第 8 帧要拿着法杖（倒握当锤子）：没有法杖的帧，外观流水线的占位棍会认错（第一版画成木槌 + 长钉，已弃用：mage_ench1_alt.png）
        ('enNail', 'gripping the staff upside down near its top with both hands like a hammer, raised high overhead, about to pound a big iron nail sticking out of the ground in front of her, leaning forward, mischievous grin'),
    ],
}
NO_WPN_SHEETS = set()
# 技能图标：32 个（P0 21 个 + 二觉 / 三觉段 11 个），16 个一张，画风同 combatgen
ICONS = [
    ('en_rosevine', 'a creeping black thorny vine with small red roses crawling along the ground'),
    ('en_broom', 'a dark witch broom with purple ribbons and a small sparkle'),
    ('en_puppeteer', 'a hand with puppet strings controlling a small stitched brown teddy bear puppet'),
    ('en_mend', 'a big silver sewing needle with red thread stitching a cream-white bunny rag doll'),
    ('en_scratch', 'a brown stitched teddy bear paw with sharp claws slashing, three claw marks'),
    ('en_favor', 'a cream-white stitched bunny rag doll hugged inside a big pink heart'),
    ('en_curiosity', 'a mischievous glowing purple eye peeking through a keyhole'),
    ('en_rocket', 'a stitched teddy bear fist flying forward on a puppet string with a shockwave ring'),
    ('en_hotfeet', 'a small green zombie rag doll with its feet on fire, cheerful flames'),
    ('en_rosewhip', 'a long thorny rose vine whip cracking in an S curve with red roses'),
    ('en_forbidden', 'a cursed bunny rag doll tossed up in a swirling purple curse glow with a dark crescent'),
    ('en_guard', 'a brown stitched teddy bear leaping down and smashing the ground with a shockwave'),
    ('en_thornspike', 'sharp black thorn spikes erupting from the ground in a row'),
    ('en_bearfall', 'a big stitched teddy bear falling from the sky belly-first onto the ground'),
    ('en_madcall', 'five small green zombie rag dolls running forward with purple curse sparkles'),
    ('en_rosejail', 'a ring of black thorns with red roses blooming, trapping a shadowy silhouette'),
    ('en_firstaid', 'a cream-white bunny rag doll wrapped in white bandages over a pink healing magic circle'),
    ('en_hut', 'a small creepy-cute witch hut made of black thorny vines with red roses and a violet glowing door'),
    ('en_bigbear', 'a giant stitched brown teddy bear towering and clawing furiously'),
    ('en_girllove', 'a glowing pink heart aura radiating waves with small hearts'),
    ('en_awaken', 'a red theater curtain opening on a stage with a stitched teddy bear puppet hanging on strings'),
    ('en_puppettrick', 'a small goblin-shaped rag doll with a big iron nail hammered into it'),
    ('en_lovesting', 'black thorny vine wings spreading behind a hugged bunny doll with thorns raining down'),
    ('en_possession', 'glowing puppet strings descending from above lifting a fallen figure back up'),
    ('en_wakaka', 'a roaring stitched teddy bear with its mouth wide open and sound waves'),
    ('en_bloom', 'a dark purple crescent moon blooming like a flower with petals'),
    ('en_garden', 'a circular thorny rose garden with black thorns and red roses all around'),
    ('en_roarbear', 'a giant stitched teddy bear breathing out a purple curse breath'),
    ('en_awaken2', 'a dark purple puppet forest with a gigantic stitched teddy bear silhouette firing a purple laser'),
    ('en_sinister', 'a creepy stitched smile with one black button eye, sinister and cute'),
    ('en_lovecage', 'a large birdcage woven from black thorny vines with red roses'),
    ('en_awaken3', 'a grand theater stage with a crimson curtain and a giant teddy bear puppet on strings, final curtain call')]
C.ICON_SHEETS = {'en_icons_a': ICONS[:16], 'en_icons_b': ICONS[16:]}
# 特效：名字 → (描述, 尺寸, 发光?)；FX_MAX = 切好后的最长边（fxcut）
Sq, Wd, T = '1024x1024', '1536x1024', '1024x1536'
C.FX = {
    'enVine': ('A single long horizontal black thorny vine crawling along the ground from left to right, small red roses and dark green leaves along it, very wide and low composition', Wd, False),
    'enSpike': ('A single cluster of five sharp black thorn spikes erupting upward from a small patch of cracked ground, pointed tips', Sq, False),
    'enRose': ('A single blooming deep red rose flower seen from slightly above, with two small dark green leaves', Sq, False),
    'enBandage': ('A single perfectly round magic circle seen from straight above, made of white bandage strips and soft pink glowing runes with small hearts around the rim', Sq, True),
    'enNeedle': ('A single big silver sewing needle pointing up-right with a long red thread curling behind it', Sq, False),
    'enWhip': ('A single long thorny rose vine whip stretched horizontally from left to right, black thorny stem with red roses along it, wide flat composition', Wd, False),
    'enCage': ('A single tall birdcage woven entirely from twisting black thorny vines with red roses on it, a dome top with a little ring, the front open between the bars, nothing inside', T, False),
}
FX_MAX = {'enVine': 512, 'enSpike': 192, 'enRose': 96, 'enBandage': 384, 'enNeedle': 96, 'enWhip': 384, 'enCage': 320}
FOREST = ('A dark eerie cute puppet forest at night for a 2D game background: twisted purple trees with hanging puppet strings and little stitched rag dolls, '
          'violet fog, a huge pale full moon, red roses on thorny bushes, wide landscape painting, cartoon style with clean shapes, no characters, no text')
# 觉醒插图（一觉 / 二觉 / 三觉）：cutin/enchantress、enchantress2、enchantress3
C.CUTIN = {
    'enchantress': ('mage', 'hugging a small cream-white stitched bunny rag doll with one arm and pulling glowing puppet strings with the other hand, a big stitched brown teddy bear puppet looming behind her, red theater curtains and roses, playful mischievous smile'),
    'enchantress2': ('mage', 'standing in a dark purple puppet forest under a pale full moon, one eye closed with a wink, a gigantic stitched brown teddy bear rising behind her with glowing eyes, purple roses and hanging puppet strings'),
    'enchantress3': ('mage', 'taking a bow on a grand theater stage with crimson curtains, both hands raised pulling many golden puppet strings, a giant stitched teddy bear puppet and small dolls dancing behind her, spotlight, confetti of rose petals'),
}

def fxcut():
    """特效原图 → art/final/fx/<名字>.webp（发光类黑底转透明，实体类去白底）；人偶之森是整张背景，只缩放"""
    from fxprep import glow_to_rgba, fit
    from prep import remove_bg
    from PIL import Image
    out = os.path.join(C.HERE, 'final', 'fx'); src = os.path.join(C.OUT, 'fx')
    for n, (_, _, g) in C.FX.items():
        p = os.path.join(src, f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        im = glow_to_rgba(Image.open(p)) if g else remove_bg(Image.open(p))
        im = fit(im, FX_MAX[n]); f = os.path.join(out, f'{n}.webp'); im.save(f, 'WEBP', quality=80, method=6); print(n, im.size, os.path.getsize(f) // 1024, 'K')
    p = os.path.join(src, 'enForest.png')
    if os.path.exists(p):
        im = Image.open(p).convert('RGB').resize((960, 640), Image.LANCZOS).crop((0, 50, 960, 590)); f = os.path.join(out, 'enForest.webp'); im.save(f, 'WEBP', quality=72, method=6); print('enForest', im.size, os.path.getsize(f) // 1024, 'K')

def frames(argv):
    import frames2, avatar_frames
    for k, v in C.SHEETS.items():
        c, sh = k.split('_', 1); frames2.NAMES.setdefault(c, {})[sh] = [n for n, _ in v]
    sys.argv = ['avatar_frames.py'] + argv
    avatar_frames.main()

def avatar(argv):
    import avatar_gen as G
    G.NO_WPN |= NO_WPN_SHEETS
    sys.argv = ['avatar_gen.py'] + argv
    G.main()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'frames': frames(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == 'avatar': avatar(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == 'iconcut':
        import icons; sys.argv = ['icons.py', '--combat']; icons.main()
    elif len(sys.argv) > 1 and sys.argv[1] == 'fxcut': fxcut()
    elif len(sys.argv) > 1 and sys.argv[1] == 'forest':
        print(C.run({'out': os.path.join(C.OUT, 'fx', 'enForest.png'), 'prompt': FOREST, 'size': '1536x1024'}))
    else: C.main()
