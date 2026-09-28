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
}
# 魔道学者：骑扫把（占位棍 = 扫把，骑在身下）、旋转扫把、摔倒、熏黑
C.SHEETS['mage_witch1'] = [
    ('brIdle', 'flying while sitting sideways on the staff held horizontally under her like a flying broom, legs dangling to one side, both hands holding the staff in front of her'),
    ('brDash', 'flying fast while sitting on the staff held horizontally under her like a flying broom, leaning far forward, hair and skirt streaming back'),
    ('brAtk1', 'mid-air while sitting sideways on the staff held horizontally under her like a flying broom, twisting her body and kicking forward with one leg'),
    ('brAtk2', 'mid-air while sitting on the staff held horizontally under her like a flying broom, diving down diagonally forward, one fist punching down'),
    ('brFall', 'floating down slowly, hanging from the staff held horizontally above her head with both hands like a parachute, legs dangling'),
    ('brSpin', 'spinning like a top with the staff held horizontally in both hands at waist height, body leaning, motion swirl'),
    ('faceplant', 'fallen flat on her face on the ground, arms spread, legs up behind her, dizzy, the staff dropped beside her'),
    ('sooty', 'standing dazed with her face and clothes covered in black soot from an explosion, hair frizzed and puffed up, coughing a small puff of smoke, holding the staff limply')]
# 魔道学者：技能道具表（不拿扫把：药瓶、大苍蝇拍、大棒棒糖；外观流水线按 NO_WPN 处理，不画占位棍）
C.SHEETS['mage_witch2'] = [
    ('potion1', 'winding up to throw overhand, holding a small round glass potion flask with bubbling orange liquid in the raised hand, the other hand forward for balance, no staff'),
    ('potion2', 'just threw something forward overhand: throwing arm fully extended forward, hand open and empty, leaning forward, no staff'),
    ('swat1', 'raising a giant cartoon fly swatter (a long wooden handle with a big square green mesh paddle) high up behind her head with both hands, no staff'),
    ('swat2', 'slamming the giant cartoon fly swatter down in front of her with both hands, the square green mesh paddle hitting the ground, no staff'),
    ('fling', 'both arms thrown forward with open hands as if flinging a big cloth forward, leaning forward, no staff, nothing in her hands'),
    ('hammer', 'crouching and swinging a small wooden mallet down in front of her as if building something on the ground, focused expression, no staff'),
    ('candy1', 'holding a giant swirly rainbow lollipop high above her head with both hands, about to smash it down, no staff'),
    ('cheer', 'jumping happily with both fists raised in celebration, big grin, no staff')]
NO_WPN_SHEETS = {'mage_witch2'}
# 技能图标：16 个一张（combatgen 的图标画风），切图：mage_art.py iconcut
ICONS = [
    ('mg_jackair', 'a flaming jack-o-lantern pumpkin shooting diagonally down from the sky with a small witch hat silhouette above'),
    ('mg_hodor', 'a sturdy armored goblin with a steel helmet and a wooden club, grinning, a summoning circle below'),
    ('mg_keepaway', 'a creepy cute cursed voodoo doll with button eyes stuck on a target, a small explosion spark'),
    ('mg_whip', 'a glowing violet magic whip cracking in an S curve with sparkles'),
    ('mg_phase', 'a little straw scarecrow doll left behind while a girl silhouette blinks away in golden light'),
    ('mg_dispel', 'a blue hexagram magic circle shattering buff icons into fragments'),
    ('mg_showtime', 'a sparkling magic show: a star-tipped wand with confetti, stars and a spotlight'),
    ('el_memorize', 'an open glowing spell book with four colored element runes floating above it'),
    ('el_movecast', 'a small running boot with a glowing charging magic orb trailing behind'),
    ('el_burn', 'four element orbs (red fire, blue ice, yellow light, purple dark) orbiting in a ring, all lit'),
    ('el_mastery', 'a crest with four element gems (fire, ice, light, dark) set in gold'),
    ('el_amplify', 'a violet crystal with surging magic energy rings expanding outward'),
    ('bm_combo', 'a combo counter number with motion streaks and a spear tip'),
    ('bm_shieldup', 'a blue magic barrier bubble with a spear crossed behind it'),
    ('bm_niu', 'three spear strike streaks: a thrust, an upward arc and a wide sweep'),
    ('bm_realphase', 'a golden speed dash afterimage of a girl with a straw doll fading behind')]
ICONS2 = [
    ('bm_instinct', 'a fist wrapped in crackling red lightning aura'),
    ('bm_weapon', 'a crossed spear and fighting pole with a shining gem'),
    ('bm_double', 'a spear slamming the ground twice with a shockwave ring'),
    ('bm_bomb', 'a glowing blue orb with a ticking timer ring and fuse sparks'),
    ('bm_super', 'many small blue light orbs fusing into one giant blue energy ball'),
    ('bm_will', 'a golden fighting spirit flame with three stacked chevrons'),
    ('sm_aura', 'a purple summoning aura ring powering up a small monster silhouette'),
    ('sm_telepathy', 'a glowing link line between a girl silhouette and a knight silhouette, heart-mind symbol'),
    ('sm_lesser', 'four tiny elemental spirits: a flame sprite, a water droplet sprite, a shadow imp and a light wisp'),
    ('sm_wait', 'a raised open palm STOP gesture over a small monster silhouette'),
    ('sm_follow', 'footprints with small monster footprints following behind'),
    ('sm_dismiss', 'a summoning circle fading away into sparkles'),
    ('sm_frit', 'a cute little red baby fire dragon breathing a small flame'),
    ('sm_sacrifice', 'a magic circle with four small elemental spirits exploding in colored bursts'),
    ('sm_sandor', 'a dark black knight helm with glowing violet visor and a crescent moon shield'),
    ('sm_domin', 'a violet whip wrapped around a crown')]
ICONS3 = [
    ('sm_mark', 'a pink crosshair target mark stamped on a monster silhouette'),
    ('sm_frenzy', 'a raging red monster eye with speed lines and a burst'),
    ('sm_aukuso', 'a dark crimson carnivorous flower with sharp teeth and thorny vines'),
    ('sm_merkle', 'a hooded shadow reaper with a purple scythe'),
    ('sm_glarelin', 'a floating golden light angel mask with lightning'),
    ('sm_aqueris', 'an elegant ice maiden spirit made of blue crystal'),
    ('sm_flamehulk', 'a muscular lava rock fire giant with a flaming sword'),
    ('sm_luise', 'a silver-haired witch with a crimson top hat and a lantern staff with fire and ice'),
    ('sm_echeverria', 'a radiant spirit queen crown with four element orbs'),
    ('sm_teleport', 'monster silhouettes warping to a glowing point with swirl'),
    ('sm_kuruta', 'a huge minotaur king head with a giant battle axe'),
    ('sm_bind', 'a green slime bottle bursting and gluing the ground'),
    ('sm_soul', 'a crescent moon over a glowing chain ring of domination'),
    ('bm_awaken', 'a giant golden star quasar orb exploding with rings of light'),
    ('bm_chaser', 'a single glowing blue magic orb with a white core and small trail'),
    ('mg_shield', 'a translucent blue magic barrier dome with a hexagon pattern')]
C.ICON_SHEETS = {'mg_icons_a': ICONS, 'mg_icons_b': ICONS2, 'mg_icons_c': ICONS3}
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

def avatar(argv):
    import avatar_gen as G
    G.NO_WPN |= NO_WPN_SHEETS
    sys.argv = ['avatar_gen.py'] + argv
    G.main()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'frames': frames(sys.argv[2:])
    elif len(sys.argv) > 1 and sys.argv[1] == 'avatar': avatar(sys.argv[2:])   # mage_art.py avatar set --only ...（NO_WPN 表用原表改时装）
    elif len(sys.argv) > 1 and sys.argv[1] == 'iconcut':   # 切图标：→ art/final/icon/<技能 id>.webp
        import icons; sys.argv = ['icons.py', '--combat']; icons.main()
    else: C.main()
