#!/usr/bin/env python3
"""魔法师对齐组的美术：新动作表 / 图标 / 特效（沿用 combatgen.py 的流水线，只替换表的内容，不修改 combatgen.py）。
原图写到主仓库 art/src/combat/，之后按 docs/ARCHITECTURE.md 的外观流水线：avatar_gen.py wpn → avatar_frames.py。

  mage_art.py sheets [--only 前缀]     动作表 → <主仓库>/art/src/combat/sheets/<表>.png
  mage_art.py icons  [--only 前缀]     图标表 → <主仓库>/art/src/combat/icons/<表>.png
  mage_art.py fx     [--only 前缀]     特效   → <主仓库>/art/src/combat/fx/<名字>.png
  mage_art.py frames [--set 套装] 前缀  切帧（avatar_frames.py，先把本文件的帧名登记进 frames2.NAMES）
生图并发最多 2（全队约定），429 退避 65 秒。已存在的输出跳过。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

# 每张表 8 帧：(帧名, 描述)；人物面朝右
C.SHEETS = {
    # 基础：普攻第 3 下（挥杖重击）、空中挥杖、鞭挞、别过来!（抱头蹲）、魔法秀、驱散魔法
    'mage_base2': [('m3_1', 'heavy staff swing wind-up: stepping forward, the staff raised high behind the head with both hands'),
                   ('m3_2', 'heavy staff swing strike: the staff swung down hard in front at waist height with both hands, body leaning forward'),
                   ('jatkS1', 'mid-air staff swing start: airborne with knees tucked, the staff raised above the head ready to swing'),
                   ('jatkS2', 'mid-air staff swing: airborne with knees tucked, the staff swept down and forward in front of the body'),
                   ('whip', 'lashing forward overhand with the free hand fully extended as if cracking a whip, the staff held back in the other hand'),
                   ('cower', 'scared: turned half away crouching down low with both hands covering the head, eyes squeezed shut'),
                   ('showtime', 'show time pose: standing on one foot with the staff raised high overhead, the free hand on the hip, winking happily'),
                   ('dispel', 'both arms spread wide to the sides, the staff held out in one hand, chest up, releasing magic all around')],
    # 战斗法师（现版）：尼巫的战术第 3 下 / 碎霸的大横扫、闪击碎霸原地转、双重锤击、圆舞棍举起 / 摔到身后、超级炫纹 / 星纹陨爆的托球
    'mage_bm2': [('bmSweep1', 'big horizontal sweep wind-up: body twisted far back, the staff held low behind the body with both hands, weight on the back foot'),
                 ('bmSweep2', 'big horizontal sweep follow-through: the staff swung all the way across in front at waist height with both hands, body rotated forward, a wide arc'),
                 ('bmSpin', 'spinning in place on one foot with the staff held out horizontally at arm length, hair and skirt swirling'),
                 ('bmDouble1', 'airborne jumping smash: leaping high with both hands raising the staff straight overhead, knees tucked'),
                 ('bmDouble2', 'landing overhead smash: crouched low with the staff slammed straight down into the ground in front with both hands'),
                 ('bmThrow1', 'lifting the staff high overhead with both hands as if hoisting something heavy on its tip, leaning back'),
                 ('bmThrow2', 'swinging the staff down over the shoulder behind her back with both hands, as if slamming something onto the ground behind her'),
                 ('bmCall', 'one hand raised high above the head holding up a glowing orb of light, the staff held in the other hand, looking up confidently')],
}
C.ICON_SHEETS = {}
C.FX = {}

def frames(argv):
    import frames2, avatar_frames
    for k, v in C.SHEETS.items():
        c, sh = k.split('_', 1); frames2.NAMES.setdefault(c, {})[sh] = [n for n, _ in v]
    # 这张表的衣袖是纯白色，默认的补洞阈值（90 像素）会把袖子挖出小洞：只去掉更大的白底洞
    ma = int(os.environ.get('HOLE_MIN', 0))
    if ma:
        f0 = avatar_frames.fill_holes
        avatar_frames.fill_holes = lambda im, min_area=90, thr=251: f0(im, min_area=max(min_area, ma), thr=thr)
    sys.argv = ['avatar_frames.py'] + argv
    avatar_frames.main()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'frames': frames(sys.argv[2:])
    else: C.main()
