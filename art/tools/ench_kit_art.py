#!/usr/bin/env python3
"""小魔女（enchantress）的人物动作表 / 特效 / 图标 / 插图（小魔女组；召唤物与物件见 ench_art.py）。
沿用 combatgen.py 的流水线，只替换表的内容；原图写到主仓库 art/src/combat/，人物帧按外观流水线：
  ench_kit_art.py sheets [--only 前缀]          动作表 → <主仓库>/art/src/combat/sheets/<表>.png（样图先给主线程验收）
  ench_kit_art.py avatar wpn|set [--only 前缀]  占位棍版 / 6 套时装版（avatar_gen.py）
  ench_kit_art.py frames [--set 套装] 前缀       切帧（avatar_frames.py）
  ench_kit_art.py icons | fx | cutin [--only 前缀]
生图配额：本组同时最多 1 个请求（-j 1），429 退避 65 秒。已存在的输出跳过。
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
C.ICON_SHEETS = {}
C.FX = {}

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
    else: C.main()
