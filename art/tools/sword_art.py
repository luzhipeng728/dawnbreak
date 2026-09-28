#!/usr/bin/env python3
"""鬼剑士（男）五个转职的美术数据：新动作表、特效、技能图标、转职立绘 / 觉醒插图、剑影的幻鬼。
数据由 combatgen.py（sheets / fx / icons / cutin）和 avatar_gen.py（wpn 的双持说明）在导入时合并，
所以出图、切帧、时装流水线的用法不变：
  combatgen.py sheets --only sword_wm        → art/src/combat/sheets/sword_wm.png
  avatar_gen.py wpn --only sword_wm           → art/src/avatar/sheets/sword_wm.png（武器换成绿色占位棍）
  avatar_gen.py set --only academy/sword_wm   → art/src/avatar/sets/academy/sword_wm.png（6 套时装各一次）
  avatar_frames.py sword_wm [--set academy]   → art/final/spr/sword[@套装]/
幻鬼（剑影的伙伴，独立精灵、不走时装和占位棍）：
  sword_art.py ghostref                       → art/src/combat/ghost/phantom_ref.png
"""
import os, sys

# 每张表 8 帧（第 1 格站姿参考由 sheets2.prompt 自动加）：(帧名, 描述)；人物一律面朝右
SHEETS = {
    # ---- 剑魂：里·鬼剑术（现版“第二套普攻”，按武器缩放）、破军斩龙击肩撞、拔刀回旋、流星落 / 破空斩（P1 先画好）----
    'sword_wm': [('rk1', 'second-style slash: stepping in low and cutting horizontally forward at chest height, katana extended forward, torso twisted into the cut'),
                 ('rk2', 'second-style backhand slash: body spun around with the back half turned to the viewer, katana swept backhand at waist height, coat flaring out'),
                 ('rk3', 'second-style rising cut: hopping slightly off the ground and cutting diagonally upward, katana ending high above the head in front'),
                 ('rk4', 'second-style heavy chop: both hands on the katana swinging it straight down to the ground in front, knees bent low, body leaning forward'),
                 ('rush1', 'shoulder tackle: charging forward shoulder-first, body low and leaning hard into the charge, katana held back low behind the body'),
                 ('iaiSpin', 'after a lightning-fast quick draw: body spun a full circle, katana swept flat all the way around at waist height, low wide stance, coat whirling'),
                 ('meteorAim', 'high up in the air above the ground, body tilted forward looking down at a target below, katana pointed straight down, coat flying upward'),
                 ('hakuu', 'crouched very low in a deep quick-draw stance, one hand gripping the hilt at the left hip, eyes glowing, body coiled like a spring')],
    # ---- 狂战士：狂暴之力二刀流普攻、狂热回旋、饥渴蓄力、嗜魂封魔斩、暴怒狂斩 ----
    'sword_bz2': [('dual1', 'dual wielding with a katana in EACH hand: crossing both katanas in an X slash in front of the chest, wild grin'),
                  ('dual2', 'dual wielding with a katana in EACH hand: both arms swung wide apart outward after a double slash, body leaning forward'),
                  ('dual3', 'dual wielding with a katana in EACH hand: one katana raised high overhead, the other thrust low forward, stepping in'),
                  ('dual4', 'dual wielding with a katana in EACH hand: spinning slash, both katanas swept around at waist height, coat flaring'),
                  ('whirl', 'sweeping the katana in a huge low horizontal circle around the body, crouched, pulling enemies in, crimson glow'),
                  ('thirst', 'hunched forward clutching the chest with the free hand, katana dragging on the ground, gritting teeth, crimson aura rising'),
                  ('twister', 'katana raised straight up over the head spinning a crimson whirlwind above, feet planted wide'),
                  ('enrage', 'dual wielding with a katana in EACH hand: leaping in mid-air slashing both katanas wildly downward, berserk expression')],
    # ---- 剑影的幻鬼（独立伙伴精灵，参考图 art/src/phantom_ref.png = sword_art.py ghostref 的输出；切帧用 frames2.py phantom --src art/src/combat/sheets）----
    'phantom_a': [('pdash1', 'lunging forward in a very low fast dash, the glowing katana thrust straight ahead, smoke trailing behind'),
                  ('pdash2', 'finished a dashing slash: body far forward, the glowing katana swept back behind after cutting through'),
                  ('prend1', 'fast downward diagonal slash with the glowing katana, body leaning in'),
                  ('prend2', 'fast backhand horizontal slash with the glowing katana at chest height, coat flaring'),
                  ('prend3', 'rising upward slash lifting off the ground, the glowing katana ending high above the head'),
                  ('pspin1', 'spinning horizontal slash: body twisted around, the glowing katana sweeping at waist height, ghostly smoke whirling'),
                  ('pspin2', 'mid-spin with the back half turned, the glowing katana trailing a circular arc of blue light'),
                  ('pfloat', 'floating calmly a little above the ground, the glowing katana held low, smoke drifting from the legs')],
    'phantom_b': [('piai1', 'crouched in a deep quick-draw stance, hand on the hilt of the sheathed glowing katana at the hip, legs bent and wrapped in smoke wisps'),
                  ('piai2', 'just finished a wide quick-draw slash: low lunge, the glowing katana extended far forward, legs wrapped in smoke wisps'),
                  ('pdive1', 'high in the air above, both hands raising the glowing katana overhead, about to chop straight down, legs tucked and trailing smoke'),
                  ('pdive2', 'landed chop: crouched, the glowing katana driven down into the ground in front, a burst of blue smoke around the legs'),
                  ('pseal', 'thrusting the free hand forward holding a glowing paper talisman seal, the katana held back, legs wrapped in smoke wisps'),
                  ('pcross', 'crossing slash: the glowing katana swung diagonally down across the body, eyes glowing through the mask, legs wrapped in smoke wisps'),
                  ('pvanish', 'transition frame, vanishing: the same standing body breaking apart into drifting blue ghost smoke, the legs and lower body already turned into smoke, the upper body half transparent and dissolving into wisps'),
                  ('pappear', 'transition frame, appearing: the body forming out of a swirl of blue ghost smoke, crouched low, the legs still made of smoke, the glowing katana held ready')],
}
HOLD = {'phantom': 'holding the long glowing katana'}

# 双持表：avatar_gen.py wpn 的额外说明（两把刀都换成占位棍）
AVATAR_NOTES = {
    'sword_bz2': 'Frames 2, 3, 4, 5 and 9 show TWO katanas, one in each hand: replace BOTH of them with green sticks (two sticks). ',
}

FX = {}      # 名字: (描述, 尺寸, 发光?)；随各阶段补充
ICONS = []   # (技能 id, 图标描述)；16 个一张，表名 sword_icons_a..
CUTIN = {}   # 转职: ('sword', 描述)

# ---- 剑影的幻鬼：独立的伙伴角色（不换武器、不换时装），先出设定立绘，再按立绘出动作表 ----
PHANTOM = ('a chibi ghost swordsman spirit in exactly the same cute chibi art style, proportions and thick outlines as this character, but a DIFFERENT character: '
           'a tall slender masked ghost warrior with pale blue-grey skin, long flowing white hair tied loosely at the back, a cracked white oni half-mask covering the upper face with glowing cyan eyes behind it, '
           'a tattered dark indigo and black kimono-style long coat with torn edges trailing into wisps of blue ghost smoke at the hem, bare pale forearms, '
           'holding a long katana with a pale glowing cyan blade in the right hand; his lower legs fade into drifting blue smoke. '
           'Full body, strict side view facing right, standing in a calm ready stance. Plain pure white background, no text.')

def ghost_jobs():
    from combatgen import SRC, OUT
    return [{'out': os.path.join(OUT, 'ghost', 'phantom_ref.png'), 'ref': os.path.join(SRC, 'sword_ref.png'), 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst',
             'prompt': 'Using this chibi character only as the art style reference, draw ' + PHANTOM}]

# 幻鬼个别帧生图时画得偏大（头身比例对不上其他帧）：切帧后再按比例缩小，锚点一起缩放
PHANTOM_SCALE = {'pfloat': 0.94, 'prend3': 0.94}
def phantom_fix():
    import json
    from PIL import Image
    d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'final', 'spr', 'phantom')
    meta = json.load(open(os.path.join(d, 'spr.json')))
    for fn, k in PHANTOM_SCALE.items():
        F = meta['frames'].get(fn)
        if not F or F.get('fixed'): continue
        im = Image.open(os.path.join(d, fn + '.webp')); w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
        im.resize((w, h), Image.LANCZOS).save(os.path.join(d, fn + '.webp'), 'WEBP', quality=76, method=6)
        meta['frames'][fn] = {'w': w, 'h': h, 'ax': round(F['ax'] * k, 1), 'ay': round(F['ay'] * k, 1), 'fixed': k}
        print('scaled', fn, k)
    json.dump(meta, open(os.path.join(d, 'spr.json'), 'w'))

def main():
    sys.path.insert(0, os.path.dirname(__file__))
    import combatgen
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'phantomfix': return phantom_fix()
    if cmd == 'ghostref': L = ghost_jobs()
    else: raise SystemExit('用法：sword_art.py ghostref | phantomfix（frames2.py phantom --src art/src/combat/sheets 之后跑）')
    for j in L: print(combatgen.run(j), flush=True)

if __name__ == '__main__':
    main()

# 幻鬼的切帧高度（frames2 按参考站姿统一比例；比鬼剑士略高、身形修长）
try:
    import frames as _F; _F.HEIGHT.setdefault('phantom', 110)
except Exception: pass
