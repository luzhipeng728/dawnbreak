#!/usr/bin/env python3
"""机械师（女）美术：机器人（召唤框架的 follower）的参考图 → 动作表 → 切帧；技能图标；转职立绘 / 觉醒插图。
和 summon_art.py / sky_art.py 同一套做法，只换设定与输出目录。AI 原图写到主仓库 art/src/mech/（不进 git），最终 webp 写到本仓库 art/final。
机器人不烘焙特效（烟、火花、光束、枪口火光都是运行时特效），只画机器人本体。

  mech_art.py lineup                 全家福参考图（统一画风 / 配色 / 相对大小，先给主线程审）→ art/src/mech/_lineup.png
  mech_art.py refs   [--only 前缀]   单个机器人的参考立绘（以全家福为参考改图）→ art/src/mech/<id>_ref.png
  mech_art.py sheets [--only 前缀]   动作表（3×3，第 1 格是参考站姿）→ art/src/mech/sheets/<id>.png
  mech_art.py cut    [--only 前缀]   切帧 → art/final/spr/mech_<id>/*.webp + spr.json（预览在 art/src/mech/cut/）
  mech_art.py strip  [--only 前缀]   游戏内比例连拍（站在城镇背景上，左边放神枪手站姿）→ art/src/mech/_<id>_strip.png
生图并发 1（全队共用一个账号，约 9 个组），429 退避 65 秒。已存在的输出自动跳过（--force 重做）。
"""
import os, sys, json, time, argparse, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))            # 本仓库 art/
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')  # 主仓库 art/（原图共享目录）
SRC = os.path.join(MAIN, 'src', 'mech')
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
BACKOFF = 65
RES = 2.0   # 帧像素 / 世界单位

STYLE = ('cute chibi / Q-version 2D side-scrolling mobile game art with thick clean dark outlines, bright flat colors and simple soft cel shading, very polished, '
         'the same art style as the cute creature lineup in the reference image')
PALETTE = ('Shared color scheme for every robot: glossy white and light-grey armor plates, dark gunmetal joints and frames, orange-yellow accent stripes, '
           'glowing cyan-blue lights and eye lenses. Absolutely no pure green and no magenta anywhere.')
NOFX = 'Draw ONLY the robot body itself: no muzzle flash, no smoke, no sparks, no lightning, no laser beams, no speed lines, no glow halos, no ground, no shadow, no text.'

# ---- 机器人设定：h = 游戏里的高度（世界单位，悬浮的按机身本体算）；frames = 动作表 9 格（第 1 格是参考站姿）----
M = {
    'rx78': dict(h=36, name='RX-78 Land Runner',
        desc='a small tracked self-destruct robot: a grey boxy body on dark rubber tank treads, a round silver dome head with one red siren light on top and a red lens eye, a yellow-and-black hazard stripe band',
        frames=['standing idle on its treads', 'rolling forward, treads turning, leaning slightly forward', 'rolling forward, treads turning the other phase',
                'rolling forward fast, leaning forward more', 'braking with the front lifting slightly', 'crouching down low on its treads, siren light blinking',
                'hopping up slightly off the ground', 'landing squashed down on its treads', 'looking up with the red eye wide open']),
    'ez8': dict(h=40, name='EZ-8 Time Bomb',
        desc='a round squat bomb robot like a chubby ball on two stubby little legs, a small dark digital timer screen on its face, a yellow-and-black hazard stripe belt, a short antenna with a red bulb on top',
        frames=['standing idle', 'standing idle with the antenna bulb lit up bright red and the timer screen glowing red', 'crouching down ready to hop',
                'hopping up into the air with legs tucked', 'at the top of a hop, curled up', 'landing squashed flat', 'shaking and trembling nervously',
                'swelling up a little, about to burst (no explosion drawn)', 'standing idle again, looking to the right']),
    'g1': dict(h=40, fly=True, name='G-1 Corona',
        desc='a floating round white orb drone about the size of a head, a short gunmetal cannon barrel sticking out in front, two small swept-back fins at the back, one big glowing yellow-white core lens in the middle, no legs',
        frames=['floating idle', 'floating, bobbing slightly up', 'floating, bobbing slightly down', 'turning its cannon slightly up',
                'recoiling backward right after firing its cannon (no muzzle flash drawn)', 'recovering forward after firing', 'tilting forward as if flying forward fast',
                'fins spread wide, charging (core lens brighter)', 'floating idle, tilted slightly back']),
    'g2': dict(h=22, fly=True, name='G-2 Rolling Thunder',
        desc='a flat round spinning-top shaped hovering drone, a white disc body with an orange-yellow rim, a dark gunmetal base ring, a stubby blue tesla-coil core sticking up on top, no legs',
        frames=['hovering idle, seen from the side, slightly tilted toward the viewer', 'spinning, disc rotated a quarter turn', 'spinning, disc rotated half a turn',
                'spinning, disc rotated three quarters', 'hovering tilted forward', 'hovering tilted backward', 'tesla coil core raised up and fully charged (brighter blue, no lightning drawn)',
                'tesla coil core raised up, tilted forward aiming ahead', 'hovering idle again']),
    'g3': dict(h=24, fly=True, name='G-3 Raptor',
        desc='a small bird-like hovering drone: a white rounded metal body, two folding gunmetal wings, a pointed orange beak, a red visor eye, two tiny grabbing claws underneath, no legs other than the claws',
        frames=['hovering idle with wings half open', 'flapping wings up', 'flapping wings down', 'gliding with wings spread wide', 'diving forward with wings folded back',
                'claws opened wide, grabbing forward', 'clinging and biting forward, claws clamped', 'pulling back after a bite, wings up', 'hovering idle, wings half open again']),
    'viper': dict(h=42, name='EX-S Viper',
        desc='a squat ground gun turret robot standing on three sturdy gunmetal tripod legs, a boxy white turret head with a cyan visor and a twin-barrel machine gun pointing forward, orange-yellow side panel',
        frames=['standing idle on its tripod', 'twin barrels firing, recoiling back (no muzzle flash drawn)', 'twin barrels firing, pushing forward again',
                'turret head tilted slightly up aiming high', 'turret head tilted slightly down aiming low', 'legs folding, lowering to set up', 'legs extended, rising up',
                'overheating, shaking (no smoke drawn)', 'standing idle again']),
    'gale': dict(h=48, fly=True, name='Air Bomb Mech Gale Force',
        desc='a chunky flying air-bomber mech: a rounded white fuselage with a cyan canopy visor, two stubby side wings each with a horizontal rotor pod, a small machine gun under the nose, a rack of red missiles under the belly, no legs',
        frames=['flying idle, level', 'flying, bobbing up', 'flying, bobbing down', 'tilting nose-down while firing its nose machine gun (no muzzle flash drawn)',
                'missile rack opened, launching missiles upward (missiles drawn leaving the rack, no smoke)', 'banking into a turn', 'diving down steeply nose-first',
                'climbing up, nose raised', 'flying idle again']),
    'sparrow': dict(h=16, fly=True, name='Sparrow interceptor',
        desc='a tiny palm-sized interceptor drone like a little white bird-shaped plane with two short wings, a cyan eye lens and a tiny gun under the nose',
        frames=['flying idle', 'wings up', 'wings down', 'tilting nose-down attacking', 'banking left', 'diving', 'climbing', 'spinning', 'flying idle again']),
    'factory': dict(h=74, name='Sparrow Factory',
        desc='a cute boxy little factory robot building on short stubby legs: white walls with orange-yellow hazard stripes, a big square hatch door in the front, a rooftop landing pad with a small antenna and a blinking light',
        frames=['standing idle with the hatch closed', 'hatch door opening', 'hatch door wide open (dark inside)', 'hatch open, a tiny sparrow drone peeking out',
                'hatch door closing', 'shaking and rattling while working', 'antenna light blinking, leaning slightly', 'bracing, about to burst (no explosion drawn)', 'standing idle again']),
    'g0': dict(h=160, name='G-0 Battleroid',
        desc='a big heroic humanoid battle mech (much taller and bulkier than the other robots): white and light-grey heavy armor, a helmet head with a cyan V-shaped visor, a huge gatling gun as the right arm, '
             'box-shaped missile pods on both shoulders, a round glowing red-orange core in the chest, thick legs with gunmetal joints',
        frames=['standing idle, heroic stance', 'raising the gatling gun arm forward to aim', 'firing the gatling gun, recoiling (no muzzle flash drawn)', 'firing the gatling gun, barrels spun',
                'shoulder missile pods flipped open, missiles leaving (no smoke)', 'bracing low with the chest core opened wide, about to fire a beam (no beam drawn)',
                'leaning back from the recoil of the chest cannon', 'dropping to one knee, powering down', 'standing idle again, arm lowered']),
}
FLY_HOVER = {'g1': 0, 'g2': 0, 'g3': 0, 'gale': 0, 'sparrow': 0}   # 悬浮高度由代码控制（s.hz），帧本身按机身底部对齐

def gen(out, prompt, size, refs=(), model='gpt-image-2.5-sunburst', force=False):
    """调用 gpt-image 技能脚本；429 退避 65 秒，其他错误短暂重试。同一时刻只跑一个（并发 1）。"""
    if os.path.exists(out) and not force: return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cmd = ['python3', GI, 'edit' if refs else 'gen', prompt, '-o', out, '-s', size, '-q', 'high', '-m', model]
    for r in refs: cmd += ['-i', r]
    t = time.time(); err = ''
    for attempt in range(6):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out): return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        err = (r.stderr + r.stdout)[-400:]
        time.sleep(BACKOFF if '429' in err else 8 + attempt * 6)
    return f'FAIL {os.path.basename(out)}: {err}'

def lineup_prompt():
    order = ['rx78', 'ez8', 'g1', 'g2', 'g3', 'viper', 'gale', 'sparrow', 'factory', 'g0']
    rel = {'rx78': 1.0, 'ez8': 1.1, 'g1': 0.9, 'g2': 0.6, 'g3': 0.65, 'viper': 1.15, 'gale': 1.35, 'sparrow': 0.45, 'factory': 2.0, 'g0': 4.4}
    items = '; '.join(f'({i + 1}) {M[k]["name"]}: {M[k]["desc"]} (height about {rel[k]:.1f}x the first robot)' for i, k in enumerate(order))
    return (f'Using the art style of the FIRST image and the robot design of the SECOND image, draw a character design lineup sheet of {len(order)} cute combat robots built by a young female mechanic, '
            f'{STYLE}. Every robot in strict side view FACING RIGHT, all standing (or hovering) on one shared baseline in a single row from left to right, each clearly separated by wide white gaps, '
            f'relative sizes exactly as stated. The first robot must look exactly like the robot in the SECOND image. In order from left to right: {items}. {PALETTE} '
            f'{NOFX} Plain pure white background.')

def ref_prompt(k):
    d = M[k]
    return (f'The FIRST image is a lineup of robots. Redraw ONLY the robot called "{d["name"]}" ({d["desc"]}) from that lineup, alone and large, full body, '
            f'in strict side view FACING RIGHT, keeping exactly its design, colors, proportions and the cute thick-outline art style. {PALETTE} {NOFX} Plain pure white background, centered.')

def sheet_prompt(k):
    d = M[k]; items = '; '.join(f'({i + 1}) {p}' for i, p in enumerate(d['frames']))
    fly = 'It is a hovering robot: draw it floating with no ground contact, all frames at the same height. ' if d.get('fly') else 'The bottom of every grounded frame in each row sits on the same baseline. '
    return (f'Using this exact robot (same design, same colors, same proportions and the same cute art style with thick outlines), draw a professional 2D game SPRITE ANIMATION SHEET: '
            f'9 frames of this SAME robot at exactly the SAME scale, every frame in strict side view FACING RIGHT, arranged in a grid of 3 columns and 3 rows, '
            f'with wide empty white gaps so that no frame touches or overlaps another. {fly}Frames in reading order (left to right, top to bottom): {items}. '
            f'Consecutive frames must be clearly different so the animation reads smoothly. {NOFX} Plain pure white background, no numbers.')

# 动作表 9 格的帧名（第 1 格 = 参考站姿 idle）；代码里 MECH_LOOK 按这些名字取帧
NAMES = {
    'rx78': ['idle', 'run1', 'run2', 'run3', 'brake', 'crouch', 'hop', 'land', 'look'],
    'ez8': ['idle', 'blink', 'crouch', 'hop1', 'hop2', 'land', 'shake', 'swell', 'idle2'],
    'g1': ['idle', 'bob1', 'bob2', 'aimUp', 'fire', 'recover', 'fly', 'charge', 'idle2'],
    'g2': ['idle', 'spin1', 'spin2', 'spin3', 'tiltF', 'tiltB', 'charged', 'aim', 'idle2'],
    'g3': ['idle', 'flapU', 'flapD', 'glide', 'dive', 'grab', 'bite', 'pull', 'idle2'],
    'viper': ['idle', 'fire1', 'fire2', 'aimUp', 'aimDown', 'fold', 'rise', 'heat', 'idle2'],
    'gale': ['idle', 'bob1', 'bob2', 'fire', 'missile', 'bank', 'dive', 'climb', 'idle2'],
    'sparrow': ['idle', 'up', 'down', 'attack', 'bank', 'dive', 'climb', 'spin', 'idle2'],
    'factory': ['idle', 'open1', 'open2', 'peek', 'close', 'work', 'blink', 'brace', 'idle2'],
    'g0': ['idle', 'aim', 'gat1', 'gat2', 'missile', 'laser', 'recoil', 'kneel', 'idle2'],
}
LINEUP_ORDER = ['rx78', 'ez8', 'g1', 'g2', 'g3', 'viper', 'gale', 'sparrow', 'factory', 'g0']

def crop_lineup():
    """全家福 → 每个机器人一张参考图（白底，加边距）：连通块按从左到右排序，小碎块并进最近的大块（主线程：用全家福的格子当参考，不再单独生成）。"""
    from prep import components
    im = Image.open(os.path.join(SRC, '_lineup.png')).convert('RGBA'); arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=4)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); n = len(LINEUP_ORDER); big, small = boxes[:n], boxes[n:]
    for sm in small:
        cx, cy = (sm['x0'] + sm['x1']) / 2, (sm['y0'] + sm['y1']) / 2
        dist = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=dist)
        if dist(b) > 60: continue
        b['ids'].append(sm['ids'][0]); b['x0'] = min(b['x0'], sm['x0']); b['x1'] = max(b['x1'], sm['x1']); b['y0'] = min(b['y0'], sm['y0']); b['y1'] = max(b['y1'], sm['y1'])
    big.sort(key=lambda b: (b['x0'] + b['x1']) / 2)
    for k, b in zip(LINEUP_ORDER, big):
        sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
        fr = Image.fromarray(sub, 'RGBA'); m = max(fr.size) // 6 + 20
        bg = Image.new('RGBA', (fr.width + m * 2, fr.height + m * 2), (255, 255, 255, 255)); bg.alpha_composite(fr, (m, m))
        bg.convert('RGB').save(os.path.join(SRC, f'{k}_ref.png')); print(k, fr.size)

def cut(k):
    """切帧：按第 1 格（参考站姿）的高度统一缩放到设定高度；每行按行基线对齐（保留上下浮动），横向按机身中段像素的中位数对齐。"""
    import sky_art
    src = os.path.join(SRC, 'sheets', f'{k}.png')
    if not os.path.exists(src): print('缺少', src); return
    im, arr, lab, order = sky_art.cut9(src, holes=False)
    rows_ok = [sum(1 for b in order if b['row'] == r) for r in range(3)]
    print(f'{k}: {len(order)} frames rows={rows_ok}{"  <-- CHECK" if len(order) != 9 or rows_ok != [3, 3, 3] else ""}')
    names = NAMES[k]; out = os.path.join(HERE, 'final', 'spr', 'mech_' + k)
    if os.path.isdir(out):
        for x in os.listdir(out): os.remove(os.path.join(out, x))
    os.makedirs(out, exist_ok=True)
    pv_dir = os.path.join(SRC, 'cut'); os.makedirs(pv_dir, exist_ok=True)
    pv = Image.new('RGB', im.size, (60, 64, 72)); pv.paste(im, (0, 0), im); dr = ImageDraw.Draw(pv)
    for i, b in enumerate(order):
        dr.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], outline=(255, 220, 60), width=3); dr.text((b['x0'] + 4, b['y0'] + 4), f'{i} {names[i] if i < len(names) else "?"}', fill=(255, 60, 60))
    pv.thumbnail((900, 900)); pv.save(os.path.join(pv_dir, f'{k}.png'))
    ref = order[0]; kk = M[k]['h'] * RES / (ref['y1'] - ref['y0'])
    base = {r: max(b['y1'] for b in order if b['row'] == r) for r in range(3) if any(b['row'] == r for b in order)}
    meta = {'res': RES, 'frames': {}}
    for b, fn in zip(order, names):
        sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
        a = sub[..., 3] > 40; h = a.shape[0]
        xs = np.where(a[int(h * 0.15):int(h * 0.85)])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
        ay = base[b['row']] - b['y0']
        fr = Image.fromarray(sub, 'RGBA'); sm = fr.resize((max(1, round(fr.width * kk)), max(1, round(fr.height * kk))), Image.LANCZOS)
        sm.save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=80, method=6)
        meta['frames'][fn] = {'w': sm.width, 'h': sm.height, 'ax': round(ax * kk, 1), 'ay': round(ay * kk, 1)}
    json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1)
    tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith('.webp'))
    print(f'  -> mech_{k}: {len(meta["frames"])} frames, {tot // 1024} KB')
    if k == 'rx78': derive_buster(out, meta)

def derive_buster(src_dir, meta):
    """空投支援的银色破坏者 = RX-78 换色（灰色车身提亮成银白、红灯换成粉红），不另外生图。"""
    import colorsys
    out = os.path.join(HERE, 'final', 'spr', 'mech_buster'); os.makedirs(out, exist_ok=True)
    for fn in meta['frames']:
        a = np.array(Image.open(os.path.join(src_dir, f'{fn}.webp')).convert('RGBA')).astype(np.float32) / 255
        r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = a[..., :3].max(-1); mn = a[..., :3].min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        grey = (sat < 0.18) & (mx > 0.25)
        a[..., :3] = np.where(grey[..., None], np.clip(a[..., :3] * 1.18 + np.array([0.02, 0.03, 0.06]), 0, 1), a[..., :3])
        red = (sat > 0.45) & (r > g * 1.6) & (r > b * 1.6)
        pink = np.stack([np.clip(r * 1.0 + 0.1, 0, 1), np.clip(r * 0.45, 0, 1), np.clip(r * 0.75, 0, 1)], -1)
        a[..., :3] = np.where(red[..., None], pink, a[..., :3])
        Image.fromarray((a * 255).astype(np.uint8), 'RGBA').save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=80, method=6)
    json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1); print('  -> mech_buster（RX-78 换色）')

def strip(k):
    """游戏内比例连拍：神枪手站姿 + 机器人全部 9 帧（summon_strip.py 同一套），输出 art/src/mech/_mech_<id>_strip.png"""
    import summon_strip as SS
    SS.OUT = SRC
    SS.strip('mech_' + k, 'town', vs=('gun',), seq=NAMES[k])

# ---- 人物新动作（机械师）：一张 3×3 表（第 1 格参考站姿 + 8 帧），走外观流水线：
#   pose（原表，手里是左轮）→ avatar_gen wpn（换成占位棍）→ avatar_gen set ×6（时装）→ avatar_frames（切帧 + 武器轨迹）→ avatar_hatcheck
POSE_NAME = 'gun_mech'
REMOTE = 'a small dark-grey handheld remote control with a red button and a short antenna'
POSE_FRAMES = [
    ('mSet1', 'crouching down on one knee, one hand reaching down toward the ground in front as if setting something down, the other hand resting on the knee'),
    ('mSet2', 'kneeling on one knee, one hand pressed flat on the ground in front, looking down at it with a confident smile'),
    ('mRemote1', f'standing, holding {REMOTE} at chest height in one hand, thumb on the button, the other arm relaxed'),
    ('mRemote2', f'pressing the button of {REMOTE} firmly, the remote raised to face height, a playful grin'),
    ('mCall', 'one arm raised straight up high with an open palm signalling to the sky, the other hand on the hip'),
    ('mPoint', 'one arm extended straight forward with the index finger pointing ahead like giving a command, leaning slightly forward'),
    ('mAwk1', f'dramatic command pose: {REMOTE} held high above the head in one hand, the other arm sweeping forward, hair and scarf flowing'),
    ('mAwk2', f'wide heroic stance, one arm thrust forward with an open hand while the other holds {REMOTE} up beside the face, eyes sharp and determined'),
]
NOGUN = ' IMPORTANT: in ALL 9 frames (including the first standing frame) her hands hold NO gun and NO revolver: the revolver is not visible anywhere; only the small remote control appears where a frame mentions it.'
POSE_NOTE = f'The small remote control ({REMOTE}) is NOT the revolver: keep it exactly as it is in the hand that holds it. '

def pose_sheet(force=False):
    import sheets2
    ref = os.path.join(MAIN, 'src', 'gun_ref.png')
    out = os.path.join(MAIN, 'src', 'combat', 'sheets', f'{POSE_NAME}.png')
    return gen(out, sheets2.prompt([d for _, d in POSE_FRAMES], None) + NOGUN, '2048x2048', [ref], force=force)

# ---- 技能图标（和 combatgen.py 的图标表同一画风；以全家福和现有的 RX-78 图标为参考，机器人造型和精灵一致）----
ICON_STYLE = ('cute cartoon mobile RPG icon style, bold clean outlines, bright saturated colors, soft shading, glossy and polished; '
              'every icon is a rounded square tile with its own colored background and a thick dark border')
ROBOT_NOTE = 'Any robot drawn in an icon must look exactly like the matching robot in the FIRST image (white and light-grey armor, orange-yellow stripes, cyan lights). '
ICONS = {
    'mech_a': [
        ('gm_ez8', 'the round white EZ-8 bomb robot on stubby legs with a red digital timer screen and a lit red antenna bulb, orange warning glow behind it'),
        ('gm_robotics', 'a small white robot being upgraded by a wrench and a spinning gear, a glowing blue upward arrow'),
        ('gm_detonate', 'a hand pressing the red button of a dark-grey remote control with a short antenna, a big orange explosion behind'),
        ('gm_backup', 'the small grey tracked RX-78 robot with a red siren light bursting forward out of a red warning triangle'),
        ('gm_g1', 'the floating white orb drone G-1 Corona with a yellow core lens firing a glowing yellow light bullet'),
        ('gm_g2', 'three white spinning-top disc drones with blue tesla coils circling in a ring with crackling blue electricity'),
        ('gm_viper', 'the white tripod turret robot with a cyan visor firing its twin-barrel gun, bullet streaks'),
        ('gm_convert', 'a gear with an electric bolt turning into a glowing golden light orb'),
        ('gm_camo', 'a girl silhouette fading into a transparent cyan hexagon camouflage pattern'),
        ('gm_hold', 'a dark-grey remote control showing a big pause symbol, a small robot stopping with raised hands'),
        ('gm_g3', 'several small white bird-like drones with orange beaks and grabbing claws swooping down'),
        ('gm_gale', 'the white flying bomber mech with twin rotor pods launching red missiles'),
        ('gm_magnet', 'a purple magnetic energy bullet shaped like a horseshoe magnet pulling small shadowy enemies into a glowing field'),
        ('gm_drop', 'a dark bomber plane in the sky dropping many small silver tracked robots'),
        ('gm_factory', 'the boxy white factory robot with an open hatch and tiny white interceptor drones flying out'),
        ('gm_g0', 'the big white battle mech with a gatling gun arm, shoulder missile pods and a glowing red chest core, a red lock-on reticle'),
    ],
    'mech_b': [
        ('gm_hitech', 'a glowing blue circuit chip with a golden gear and sparkles'),
        ('gm_solar', 'tiny white drones linked edge to edge into a glowing solar panel firing a bright beam'),
        ('gm_gext', 'three G-series robots (an orb drone, a disc drone, a bird drone) in a circle of transformation arrows with a stacking gold bar'),
        ('q_magic_tinder', 'a small magical flame ember glowing orange and violet inside a cracked crystal shell'),
    ],
}
def icon_prompt(items):
    rows = max(1, len(items) // 4)
    return (f'The FIRST image shows the robot designs; the SECOND image is an example of the icon style. Draw a sprite sheet of {len(items)} separate game icons arranged in a grid of 4 columns and {rows} rows '
            f'on a plain pure white background, evenly spaced with generous white gaps between icons, no icon touching another, {ICON_STYLE}. {ROBOT_NOTE}In reading order (left to right, top to bottom): '
            + '; '.join(f'({i + 1}) {t}' for i, (_, t) in enumerate(items)) + '. No text, no numbers, no labels.')
def icons_gen(only, force):
    ex = os.path.join(SRC, '_icon_example.png')
    if not os.path.exists(ex):
        im = Image.open(os.path.join(HERE, 'final', 'icon', 'g_rx78.webp')).convert('RGBA').resize((416, 416), Image.LANCZOS)
        bg = Image.new('RGBA', (512, 512), (255, 255, 255, 255)); bg.alpha_composite(im, (48, 48)); bg.convert('RGB').save(ex)
    for n, items in ICONS.items():
        if n.startswith(only): print(gen(os.path.join(SRC, 'icons', f'{n}.png'), icon_prompt(items), '2048x2048' if len(items) > 8 else '2048x1152', [os.path.join(SRC, '_lineup_review.png'), ex], force=force), flush=True)
def icons_cut(only):
    """同 icons.py：去背 → 连通块 → 按行列排序 → 104×104 WebP（art/final/icon/<id>.webp）"""
    from prep import remove_bg, components
    out = os.path.join(HERE, 'final', 'icon')
    for n, items in ICONS.items():
        p = os.path.join(SRC, 'icons', f'{n}.png')
        if not n.startswith(only) or not os.path.exists(p): continue
        arr = np.array(remove_bg(Image.open(p))); lab, comps = components(arr[..., 3], min_cells=200)
        boxes = []
        for c, cells in comps:
            ys, xs = np.where(lab == c); boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, c))
        boxes = sorted([b for b in boxes if (b[1] - b[0]) > 80 and (b[3] - b[2]) > 80], key=lambda b: (b[0] + b[1]) / 2)
        rows, cur = [], []
        for b in boxes:
            if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
            cur.append(b)
        if cur: rows.append(cur)
        order = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
        print(n, 'found', len(order), 'expected', len(items))
        for b, (name, _) in zip(order, items):
            y0, y1, x0, x1, c = b
            crop = arr[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(lab[y0:y1, x0:x1] == c, crop[..., 3], 0)
            ic = Image.fromarray(crop, 'RGBA'); s = max(ic.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(ic, ((s - ic.width) // 2, (s - ic.height) // 2))
            sq.resize((104, 104), Image.LANCZOS).save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=84, method=6)

# ---- 转职立绘 job/mechanic（615×900 同款）与觉醒插图 cutin/mechanic（720×480，一觉 G-0）----
CHAR = 'this exact chibi girl gunner (same face, same brown ponytail, same brown newsboy cap, same brown jacket, blue scarf, shorts and boots)'
JOB_PROMPT = (f'Full-body character art of {CHAR}, now as a Mechanic: small brass goggles on the cap, a tool belt with a wrench, a mechanical fingerless gauntlet on one hand. '
              'She stands in a relaxed confident 3/4 pose facing right, holding a small dark-grey remote control with a red button up in one hand and the silver revolver in the other; '
              'the little white orb drone (G-1 Corona) from the second image floats next to her shoulder and the small grey tracked robot (RX-78) from the second image sits at her feet. '
              'Modest outfit. Same cute chibi art style with thick outlines. Plain pure white background, full body visible, no ground shadow, no text.')
CUTIN = {
    'mechanic': ('pointing forward with a small dark-grey remote control raised in the other hand, a huge white battle mech (the big G-0 Battleroid from the second image, with its gatling gun arm, '
                 'shoulder missile pods and glowing red chest core) looming behind her, red lock-on reticles, confident grin, hair blown back'),
}
def cutout(p, max_h=None, size=None):
    from prep import remove_bg
    im = remove_bg(Image.open(p)); bb = im.getbbox(); im = im.crop(bb) if bb and max_h else im
    if max_h and im.height > max_h: im = im.resize((round(im.width * max_h / im.height), max_h), Image.LANCZOS)
    if size: im = im.resize(size, Image.LANCZOS)
    return im
def job_art(force):
    refs = [os.path.join(MAIN, 'src', 'gun_ref.png'), os.path.join(SRC, '_lineup_review.png')]
    print(gen(os.path.join(SRC, 'job_mechanic.png'), JOB_PROMPT, '1024x1536', refs, force=force), flush=True)
    for j, d in CUTIN.items():
        print(gen(os.path.join(SRC, f'cutin_{j}.png'), f'Using {CHAR} from the FIRST image (same design, same colors, same cute art style), draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Plain pure white background, no text.',
                  '1536x1024', refs, force=force), flush=True)
def job_prep():
    p = os.path.join(SRC, 'job_mechanic.png')
    if os.path.exists(p): os.makedirs(os.path.join(HERE, 'final', 'job'), exist_ok=True); cutout(p, max_h=900).save(os.path.join(HERE, 'final', 'job', 'mechanic.webp'), 'WEBP', quality=84, method=6); print('job/mechanic')
    for j in CUTIN:
        p = os.path.join(SRC, f'cutin_{j}.png')
        if os.path.exists(p): cutout(p, size=(720, 480)).save(os.path.join(HERE, 'final', 'cutin', f'{j}.webp'), 'WEBP', quality=82, method=6); print('cutin/' + j)

def avatar_step(args):
    """外观流水线的一步：把本表的帧名 / 道具说明临时登记进 avatar_gen / frames2（不改它们的文件），再调用它们的 main。"""
    import avatar_gen as AG, frames2 as F2
    AG.NOTES[POSE_NAME] = POSE_NOTE
    AG.NO_WPN.add(POSE_NAME)   # 这张表人物手里没有枪（左轮收起来了）：不做占位棍，时装版直接用原表换衣服
    F2.NAMES.setdefault('gun', {})['mech'] = [n for n, _ in POSE_FRAMES]
    if args[0] == 'frames':
        import avatar_frames as AF
        sys.argv = ['avatar_frames.py'] + args[1:]; AF.main()
    else:
        sys.argv = ['avatar_gen.py'] + args; AG.main()

def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'avatar': return avatar_step(sys.argv[2:])   # mech_art.py avatar wpn --only gun_mech | avatar set --only festival/gun_mech | avatar frames gun_mech [--set festival]
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); a = ap.parse_args()
    if a.phase == 'lineup':
        refs = [os.path.join(MAIN, 'src', 'summon', '_refs_all.png'), os.path.join(SRC, '_rx78_ref_big.png')]
        print(gen(os.path.join(SRC, '_lineup.png'), lineup_prompt(), '3840x2160', refs, force=a.force), flush=True)
    elif a.phase == 'crop': crop_lineup()
    elif a.phase == 'pose': print(pose_sheet(a.force), flush=True)
    elif a.phase == 'icons': icons_gen(a.only, a.force)
    elif a.phase == 'iconcut': icons_cut(a.only)
    elif a.phase == 'job': job_art(a.force)
    elif a.phase == 'jobprep': job_prep()
    elif a.phase == 'sheets':
        for k in M:
            if any(k.startswith(o) for o in a.only.split(',')): print(gen(os.path.join(SRC, 'sheets', f'{k}.png'), sheet_prompt(k), '2048x2048', [os.path.join(SRC, f'{k}_ref.png')], force=a.force), flush=True)
    elif a.phase == 'cut':
        for k in M:
            if k.startswith(a.only): cut(k)
    elif a.phase == 'strip':
        for k in M:
            if k.startswith(a.only) and os.path.isdir(os.path.join(HERE, 'final', 'spr', 'mech_' + k)): strip(k)
    else: raise SystemExit('phase: lineup | crop | sheets | cut | strip')

if __name__ == '__main__':
    main()
