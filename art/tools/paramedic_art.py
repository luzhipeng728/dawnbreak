#!/usr/bin/env python3
"""协战师（神枪手第 5 转职）美术：强袭战斗服整套动作帧、技能图标、特效、转职立绘、觉醒插图。
原图写到主仓库 art/src/paramedic/（不进 git），切好的素材输出到本仓库 art/final。
  paramedic_art.py ref                 战斗服参考立绘（原版女枪立绘 → 穿强袭战斗服）→ src/paramedic/pmsuit_ref.png
  paramedic_art.py sheets [--only 表]  动作表（3×3：第 1 格站姿参考 + 8 帧）→ src/paramedic/sheets/pmsuit_<表>.png
  paramedic_art.py cut [--only 表]     切帧（frames2 的对齐规则：脚底锚点、按站姿统一比例）→ art/final/spr/pmsuit/
  paramedic_art.py icons | fx | job | cutin   图标表 / 特效 / 转职立绘 / 觉醒插图
  paramedic_art.py prep                图标、特效、立绘、插图切图 → art/final/{icon,fx,job,cutin}
战斗服是变身：地下城里整套换成战斗服帧集（不显示时装），所以只有一套，不乘 7 套时装；武器（手枪 / 能量刃）画在帧里，没有占位棍 / 武器轨迹。
生图：全队共用接口，本组同时只发 1 个请求；429 退避 65 秒。避开纯绿 / 品红（流水线用作标记色）。
"""
import os, sys, json, time, argparse
sys.path.insert(0, os.path.dirname(__file__))
import sheets as SH
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SRC = os.path.join(MAIN, 'src')
OUT = os.path.join(SRC, 'paramedic')
REF = os.path.join(OUT, 'pmsuit_ref.png')
SH.CACHE = os.path.join(OUT, '.upload_cache.json')
gi = SH.gi
MODEL = 'gpt-image-2.5-sunburst'

SUIT = ('a sleek high-tech ASSAULT BATTLE SUIT: a form-fitting dark navy bodysuit that covers her whole body from the neck down to the wrists and ankles (modest, no bare skin except the face), '
        'smooth glossy white armor plates on the chest, the shoulders, the forearms, the hips and the shins, thin glowing sky-blue light lines along the edges of the plates, '
        'a compact white thruster backpack with two short fins and small sky-blue vents, armored white knee-high boots with dark navy soles, dark navy gloves, '
        'a white tactical headset over the ears with a small transparent sky-blue visor pushed up on the forehead (NO hat, NO cap), '
        'on the forearm of her back arm a white armored gauntlet with a folded sky-blue energy blade lying flat along the outside of the forearm, '
        'and in her front hand a compact white-and-navy sci-fi pistol with a sky-blue light strip')
HOLD = 'wearing the assault battle suit and holding the compact sci-fi pistol'
BLADE = 'the sky-blue energy blade extended forward out of the forearm gauntlet'

def ref_prompt():
    return ('Redraw this exact chibi character: the SAME face, the same big blue eyes, the same brown hair and long brown ponytail, the same body proportions and the same height, '
            'the same pose (standing in side view facing RIGHT) and the same cute hand-painted art style with thick outlines. '
            f'Change ONLY the outfit and the weapon: she now wears {SUIT}. '
            'Keep the design clean and readable at a small sprite size: big simple shapes, no tiny details, no text, no logos, no emblems with crosses. '
            'Colors: white, dark navy and sky-blue glow only (no green, no magenta, no pink). Plain pure white background, full body visible, nothing else.')

# 表名 → [(帧名, 描述)]；walk / run 用姿势参考图（帧名固定：idle + walk1..8 / run1..8），jump 的帧名 jump1..5 + jatk1..3
SHEETS = {
    'walk': None, 'run': None,
    'jump': [('jump1', 'jump take-off: crouched low with bent knees ready to spring up'), ('jump2', 'jumping up: body stretched rising into the air, legs trailing below'),
             ('jump3', 'jump apex: floating at the top with knees tucked up'), ('jump4', 'falling: legs reaching down, arms up for balance'),
             ('jump5', 'landing: knees bent absorbing the impact, slightly crouched'),
             ('jatk1', f'mid-air slash wind-up: airborne, {BLADE}, blade arm raised high behind the head'),
             ('jatk2', f'mid-air slash: airborne, {BLADE}, slashing diagonally downward in front of her'),
             ('jatk3', f'mid-air slash follow-through: airborne with knees tucked, {BLADE} pointing low in front')],
    'combo': [('a1_1', f'close-quarters slash wind-up: {BLADE}, the blade arm drawn back across the chest, body low and coiled, pistol held back at the hip'),
              ('a1_2', f'horizontal slash: {BLADE}, the blade swept forward horizontally at chest height, body twisted forward'),
              ('a2_1', f'second slash wind-up: {BLADE}, the blade arm held low behind the hip, weight on the back foot'),
              ('a2_2', f'rising slash: {BLADE}, the blade swung upward in a rising arc above the head, rising onto the toes'),
              ('a3_1', 'spinning kick wind-up: body turning away so the back faces the viewer, one knee raised, arms tucked in'),
              ('a3_2', 'spinning back kick: one armored leg extended straight forward at waist height, body leaning back, arms out for balance'),
              ('a4_1', 'point-blank shot: stepping in and thrusting the sci-fi pistol forward at full arm length, aiming straight ahead at close range'),
              ('a4_2', 'firing the pistol point-blank: the arm kicked upward by a strong recoil, body leaning back slightly')],
    'react': [('hit1', 'hurt: flinching backward, eyes shut in pain'), ('hit2', 'hurt harder: knocked back with the upper body bent backward'),
              ('air', 'knocked into the air: body horizontal tumbling backward mid-air, arms and legs flailing'), ('down', 'lying knocked down flat on the back on the ground'),
              ('getup', 'getting up from the ground: on one knee pushing up with a hand'), ('roll', 'dodge roll: curled up into a tight ball rolling forward'),
              ('dash1', f'dash attack start: lunging forward very low, {BLADE}, blade held forward'), ('dash2', f'dash attack: long sliding lunge on the ground, {BLADE}, blade thrust straight forward')],
    'react2': [('hit3', 'hit hard: knocked backward off balance, body bent far back, head thrown back, one foot lifted off the ground'),
               ('airUp', 'launched up into the air by a hit: body arched backward and rising, arms and legs flung out, clearly airborne high above the ground'),
               ('tumble', 'tumbling helplessly in mid-air upside down in an uncontrolled backward flip, head pointing down, airborne'),
               ('bounce', 'slammed onto the ground and bouncing: lying on the back with the legs and arms thrown up in the air'),
               ('held', 'lifted off the ground by an invisible force as if grabbed by the collar: dangling helplessly, feet off the ground, legs kicking, pained face, NO other person, NO hand holding her'),
               ('tech', 'quick recovery: crouched low on one knee, pistol ready, about to spring up'),
               ('charge', 'bracing in a low wide stance with the gauntlet arm raised in front, charging power'),
               ('shoot1', 'aiming the sci-fi pistol straight forward with the arm fully extended, the other arm tucked, feet apart')],
    # 协战师能学的 5 个基础技能（后撩踢 / 浮空弹 / 钉刺射 / 刺踢 / 上旋踢）在战斗服里的姿势
    'base': [('kick1', 'chambering a kick: one armored knee raised high in front, arms up for balance'),
             ('kick2', 'rising high kick: one armored leg kicking straight up above the head, body leaning back'),
             ('slide1', 'dropping low into a slide, one leg forward'), ('slide2', 'sliding feet-first along the ground in a low slide kick, the front leg extended'),
             ('stomp1', 'standing over a fallen enemy position with one boot stamped down in front, aiming the pistol straight down at the ground in front of her feet'),
             ('stomp2', 'firing the pistol straight down at the ground in front of her feet, recoil, the stamping boot still planted'),
             ('flash', 'lightning-fast straight thrust kick: one armored leg thrust straight forward at chest height, body leaning back, arms back'),
             ('sk1', 'spinning kick in mid-turn: body spinning with one leg swung out to the side at waist height, arms tucked')],
    'skillA': [('shoot2', 'firing the sci-fi pistol straight forward, the arm kicked up a little by the recoil, a small sky-blue muzzle flash at the barrel'),
               ('slideShot', 'sliding forward low along the ground on one knee and one foot while aiming the pistol straight forward'),
               ('dashKick', 'dashing forward low and fast, body leaning far forward, the backpack thrusters firing short sky-blue jets behind her'),
               ('backKick', 'powerful spinning back kick in the air: one armored leg swung around at head height, body turned, hair whipping around'),
               ('bladeBack', f'hopping backward off the ground while slashing: {BLADE}, slashing forward in a wide arc as she jumps back'),
               ('raid1', f'lunging deep forward: {BLADE}, the blade thrust straight forward at full extension, front knee deeply bent'),
               ('raid2', f'fast flurry: {BLADE}, the blade raised high then slashing down, torso twisted, strong forward lean'),
               ('shieldBash', 'charging forward shoulder-first with the armored gauntlet raised in front of her body as if bracing behind a shield, head down, running')],
    'skillB': [('cannon1', 'the gauntlet of her back arm transformed into a chunky white arm cannon with a sky-blue core, aimed straight forward, bracing it with the other hand, wide stance'),
               ('cannon2', 'firing the white arm cannon straight forward, leaning into the heavy recoil, feet planted wide, hair blown back'),
               ('command', 'raising one arm high and pointing up to the sky, calling in air support, a confident look, the other hand on the hip'),
               ('backflip', 'doing a backflip in mid-air: body upside down, knees tucked, arms out'),
               ('swing', 'swinging a huge white-and-navy mechanical greatsword with a sky-blue edge horizontally with both hands, the blade sweeping in front of her'),
               ('deploy', 'kneeling on one knee and placing a small white device on the ground in front of her with one hand'),
               ('fieldCast', 'standing firm with both arms spread wide and palms open, chin up, as if projecting a protective field around herself'),
               ('overlimit', f'rushing forward extremely fast, body almost horizontal, {BLADE}, the blade trailing low behind her')],
    'skillC': [('awk2a', 'holding a huge white rail cannon at the hip with both hands and firing it forward, strong recoil, feet sliding back'),
               ('awk2b', 'leaping forward and bringing the huge white-and-navy mechanical greatsword down overhead with both hands in a finishing smash'),
               ('dive', 'diving down from the sky feet-first: body straight and vertical, arms at the sides, hair streaming upward'),
               ('landing', 'landing from a great height: crouched low with one knee and one fist on the ground, head up'),
               ('guard', 'crouching low with both forearms crossed in front of the face, bracing, eyes closed'),
               ('salute', 'standing straight and giving a crisp military salute with the right hand, a small confident smile'),
               ('aimUp', 'aiming the sci-fi pistol diagonally upward with the arm extended'),
               ('victory', 'victory pose: pistol raised beside the face, a wink, the other hand on the hip')],
}
# 帧名表（给 frames2：idle / walk / run / jump 的帧名由 frames2 自己定）
NAMES = {k: [n for n, _ in v] for k, v in SHEETS.items() if v and k != 'jump'}

def sheet_out(name): return os.path.join(OUT, 'sheets', f'pmsuit_{name}.png')

def post(prompt, refs, out, size):
    """发一个生图请求（同时只 1 个；429 退避 65 秒）"""
    base, key, _ = gi.load_cfg()
    urls = [SH.upload(base, key, p) for p in refs]
    payload = {'model': MODEL, 'prompt': prompt, 'n': 1, 'size': size, 'quality': 'high', 'response_format': 'b64_json'}
    if urls: payload['image'] = urls
    os.makedirs(os.path.dirname(out), exist_ok=True)
    t = time.time(); err = ''
    for i in range(5):
        try:
            resp = gi.post_json(f'{base}/images/generations', key, payload, 900); gi.save_images(resp, out, False, False)
            print(f'ok   {os.path.relpath(out, OUT)}  {time.time() - t:.0f}s', flush=True); return True
        except (SystemExit, OSError) as e:
            err = str(e); print(f'  retry {i + 1}: {err[:160]}', flush=True)
            if 'HTTP 400' in err: break
            time.sleep(65 if '429' in err else 12)
    print(f'FAIL {os.path.relpath(out, OUT)}: {err[:200]}', flush=True); return False

def cmd_ref(a):
    if os.path.exists(REF) and not a.force: print('skip ref'); return
    post(ref_prompt(), [os.path.join(SRC, 'gun_ref.png')], REF, '1024x1536')

def cmd_sheets(a):
    from sheets2 import prompt as sheet_prompt, guide_prompt
    for name, frames in SHEETS.items():
        if a.only and name not in a.only.split(','): continue
        out = sheet_out(name)
        if os.path.exists(out) and not a.force: print('skip', name); continue
        if frames is None:   # 走 / 跑：加姿势参考图，保证手脚反向摆动
            post(guide_prompt(name, HOLD), [REF, os.path.join(SRC, f'guide_{name}.png')], out, '2048x2048')
        else:
            post(sheet_prompt([d for _, d in frames], HOLD), [REF], out, '2048x2048')

def cmd_cut(a):
    """切帧：沿用 frames2 的切法（按站姿统一比例、脚底锚点）；--keep 追加到现有 spr.json"""
    import frames2
    frames2.HEIGHT['pmsuit'] = 100   # 站姿参考格 → 200 像素高，和原版女枪 idle 帧（200）一样高
    frames2.NAMES['pmsuit'] = NAMES
    src = os.path.join(OUT, 'sheets_cut'); os.makedirs(src, exist_ok=True)
    for f in os.listdir(src): os.remove(os.path.join(src, f))
    for name in SHEETS:
        if a.only and name not in a.only.split(','): continue
        p = sheet_out(name)
        if os.path.exists(p): os.symlink(p, os.path.join(src, f'pmsuit_{name}.png'))
    sys.argv = ['frames2.py', '--src', src] + (['--keep'] if a.keep else []) + ['pmsuit']
    frames2.main()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); ap.add_argument('--keep', action='store_true')
    a = ap.parse_args()
    {'ref': cmd_ref, 'sheets': cmd_sheets, 'cut': cmd_cut}[a.cmd](a)

if __name__ == '__main__':
    main()
