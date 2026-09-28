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
    'g1': dict(h=34, fly=True, name='G-1 Corona',
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

def strip(k):
    """游戏内比例连拍：神枪手站姿 + 机器人全部 9 帧（summon_strip.py 同一套），输出 art/src/mech/_mech_<id>_strip.png"""
    import summon_strip as SS
    SS.OUT = SRC
    SS.strip('mech_' + k, 'town', vs=('gun',), seq=NAMES[k])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true'); a = ap.parse_args()
    if a.phase == 'lineup':
        refs = [os.path.join(MAIN, 'src', 'summon', '_refs_all.png'), os.path.join(SRC, '_rx78_ref_big.png')]
        print(gen(os.path.join(SRC, '_lineup.png'), lineup_prompt(), '3840x2160', refs, force=a.force), flush=True)
    elif a.phase == 'crop': crop_lineup()
    elif a.phase == 'sheets':
        for k in M:
            if k.startswith(a.only): print(gen(os.path.join(SRC, 'sheets', f'{k}.png'), sheet_prompt(k), '2048x2048', [os.path.join(SRC, f'{k}_ref.png')], force=a.force), flush=True)
    elif a.phase == 'cut':
        for k in M:
            if k.startswith(a.only): cut(k)
    elif a.phase == 'strip':
        for k in M:
            if k.startswith(a.only) and os.path.isdir(os.path.join(HERE, 'final', 'spr', 'mech_' + k)): strip(k)
    else: raise SystemExit('phase: lineup | crop | sheets | cut | strip')

if __name__ == '__main__':
    main()
