#!/usr/bin/env python3
"""逐帧动作表：以角色立绘为参考，一张图画同一角色的 8 个动作（4 列 × 2 行），保证同一张表内比例 / 画风一致。
参考图上传一次后缓存 URL（上传接口限流 5 次/分钟），生成并发进行。已存在的输出跳过。
  sheets.py [--only 名字前缀] [-j 8]
输出 art/src/sheets/<角色>_<表>.png
"""
import os, sys, json, time, argparse, importlib.util, base64, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('gi', os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py'))
gi = importlib.util.module_from_spec(spec); spec.loader.exec_module(gi)
CACHE = os.path.join(ROOT, '.upload_cache.json')

# ---- 每个角色的动作（第 1 个一律是站立，用来统一各张表的比例） ----
IDLE = 'standing idle in a relaxed ready stance'
PLAYER = {
    'sword': {
        'hold': 'holding the katana',
        'A': [IDLE + ', katana held low in front', 'walking, right leg stepping forward', 'walking, left leg stepping forward', 'running fast leaning forward, katana trailing behind, right leg forward',
              'running fast leaning forward, katana trailing behind, left leg forward', 'jumping in mid-air with knees tucked up, katana raised', 'crouching low on one knee (landing / getting up)', 'hurt, flinching backward with a pained face'],
        'B': [IDLE + ', katana held low in front', 'winding up an attack with the katana raised high above and behind the head', 'finishing a powerful downward slash, katana swung low in front, body leaning forward',
              'finishing a rising upward slash, katana swung high above, body stretched upward', 'finishing a horizontal slash, katana extended forward at waist height, body twisted',
              'lunging forward with a straight stab, katana thrust straight ahead', 'slashing downward in mid-air, knees bent, katana swinging down in front', 'lying knocked down flat on the back on the ground'],
        'C': [IDLE + ', katana held low in front', 'crouched in a quick-draw stance, katana in the scabbard at the waist and hand gripping the hilt, body low',
              'just finished a lightning-fast quick-draw slash, low wide lunge, katana extended far forward', 'mid spinning slash, body twisted with the katana swinging around behind',
              'rapidly stabbing forward again and again, katana pulled back ready to thrust', 'charging forward in a sprinting dash attack, katana held forward',
              'standing with the katana raised vertically in front of the face, focusing power', 'leaping upward in a rising dragon uppercut slash, katana pointing to the sky'],
    },
    'gun': {
        'hold': 'holding the silver revolver',
        'A': [IDLE + ', revolver held down at her side', 'walking, right leg stepping forward', 'walking, left leg stepping forward', 'running fast leaning forward, right leg forward',
              'running fast leaning forward, left leg forward', 'jumping in mid-air with knees tucked up', 'crouching low on one knee (landing / getting up)', 'hurt, flinching backward with a pained face'],
        'B': [IDLE + ', revolver held down at her side', 'aiming and firing the revolver straight forward with the arm fully extended', 'aiming and firing the revolver diagonally upward',
              'in mid-air firing the revolver diagonally downward', 'high kick, one leg kicking straight up high', 'spinning side kick, one leg extended straight forward, body leaning back',
              'sliding feet-first along the ground in a low slide kick', 'lying knocked down flat on the back on the ground'],
        'C': [IDLE + ', revolver held down at her side', 'winding up to throw a grenade, arm pulled far back', 'just threw a grenade, arm extended forward',
              'firing a huge gatling gun held at the hip with both hands', 'twirling the revolver with a confident wink (power-up pose)', 'aiming carefully with both hands like a sniper',
              'dashing forward', 'spinning the revolver on a finger and striking a cool pose'],
    },
    'mage': {
        'hold': 'holding the crystal staff',
        'A': [IDLE + ', staff held upright beside her', 'walking, right leg stepping forward', 'walking, left leg stepping forward', 'running fast leaning forward, right leg forward',
              'running fast leaning forward, left leg forward', 'jumping in mid-air with knees tucked up', 'crouching low on one knee (landing / getting up)', 'hurt, flinching backward with a pained face'],
        'B': [IDLE + ', staff held upright beside her', 'winding up a staff swing, staff raised behind her', 'finishing a staff swing, staff swung forward low', 'casting a spell with the staff pointed straight forward, crystal glowing',
              'casting a spell with the staff raised high overhead, crystal glowing', 'casting a spell by slamming the staff down to the ground', 'channeling magic with both hands holding the staff forward, glowing',
              'lying knocked down flat on the back on the ground'],
        'C': [IDLE + ', staff held upright beside her', 'in mid-air casting downward with the staff pointed diagonally down', 'dashing forward swinging the staff', 'arms spread wide releasing a huge burst of magic',
              'cheerful power-up pose with sparkles', 'casting a spell with one palm forward and the staff held back', 'spinning around with the staff', 'kneeling and praying with the staff'],
    },
}
MON = {   # 怪物：一张表 8 个动作
    'goblin': 'swinging the spiked club', 'goblinCaptain': 'swinging the short sword', 'goblinChief': 'smashing with both big fists', 'goblinShaman': 'swinging the curved scimitar',
    'flameMage': 'swinging the fire staff', 'cat': 'clawing', 'catKing': 'clawing', 'tau': 'swinging the battle axe', 'tauArmored': 'swinging the battle axe', 'tauKing': 'swinging the golden axe',
    'zombie': 'biting and grabbing', 'boneLord': 'clawing with skeletal hands',
}
def mon_poses(n, atk):
    cast = {'goblinShaman': 'raising a hand crackling with lightning to cast a spell', 'flameMage': 'raising the fire staff high to cast a spell', 'boneLord': 'raising both hands to cast a frost spell',
            'catKing': 'rearing up and hissing with claws spread', 'goblinChief': 'roaring with both arms raised', 'tau': 'roaring with both arms raised', 'tauArmored': 'roaring with both arms raised',
            'tauKing': 'roaring with both arms raised', 'cat': 'rearing up and hissing', 'zombie': 'moaning with both arms raised forward', 'goblin': 'raising one arm to throw a rock', 'goblinCaptain': 'raising the sword to command'}[n]
    low = {'cat': 'crouching low ready to pounce', 'catKing': 'crouching low ready to pounce', 'tau': 'lowering the head and horns to charge', 'tauArmored': 'lowering the head and horns to charge',
           'tauKing': 'lowering the head and horns to charge'}.get(n, 'crouching low')
    return [IDLE, 'walking, one leg stepping forward', f'winding up an attack, {atk}, weapon or arms raised high behind', f'finishing the attack, {atk}, weapon or arms swung low in front, leaning forward',
            cast, low, 'hurt, flinching backward', 'lying knocked down flat on the back on the ground']

def jobs():
    L = []
    for c, d in PLAYER.items():
        for sh in ('A', 'B', 'C'):
            L.append((f'{c}_{sh}', f'src/{c}_ref.png', d[sh], d['hold']))
    for m, atk in MON.items():
        L.append((f'{m}_M', f'src/{m}_ref.png', mon_poses(m, atk), None))
    return L

def prompt(poses, hold=None):
    items = '; '.join(f'({i + 1}) {p}' for i, p in enumerate(poses))
    keep = f'The character is {hold} in the front hand in EVERY pose (never sheathed, never dropped) unless the pose says otherwise. ' if hold else ''
    return ('Using this exact chibi character (same design, same colors, same proportions and the same cute art style with thick outlines), draw a 2D game character animation pose sheet: '
            f'{len(poses)} full-body poses of this SAME character at exactly the SAME scale, every pose in strict side view FACING RIGHT, arranged in a grid of 4 columns and 2 rows, '
            'with wide empty white gaps so that no pose touches or overlaps another, the feet of the standing poses of each row on the same baseline. '
            f'{keep}Poses in reading order (left to right, top to bottom): {items}. Plain pure white background, no ground, no shadows, no text, no numbers, no effects outside the character.')

def upload(base, key, path):
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    k = f'{path}|{os.path.getmtime(path)}'
    if k in cache: return cache[k]
    for i in range(8):
        try:
            url = gi.upload_image(base, key, path, 300); break
        except SystemExit as e:
            if '429' in str(e): time.sleep(65); continue
            raise
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    cache[k] = url; json.dump(cache, open(CACHE, 'w'), indent=1)
    return url

def run(job, base, key):
    name, ref, poses, hold = job
    out = os.path.join(ROOT, 'src', 'sheets', f'{name}.png')
    if os.path.exists(out): return f'skip {name}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    url = upload(base, key, os.path.join(ROOT, ref))
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': prompt(poses, hold), 'n': 1, 'size': '2048x2048', 'quality': 'high', 'response_format': 'b64_json', 'image': [url]}
    t = time.time()
    for i in range(4):
        try:
            resp = gi.post_json(f'{base}/images/generations', key, payload, 900); gi.save_images(resp, out, False, False)
            return f'ok   {name}  {time.time() - t:.0f}s'
        except SystemExit as e:
            err = str(e); time.sleep(65 if '429' in err else 8)
    return f'FAIL {name}: {err[:200]}'

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--only', default=''); ap.add_argument('-j', type=int, default=8); a = ap.parse_args()
    base, key, _ = gi.load_cfg()
    L = [j for j in jobs() if j[0].startswith(a.only)]
    # 先串行上传所有参考图（受限流），再并发生成
    for r in sorted({j[1] for j in L}): upload(base, key, os.path.join(ROOT, r))
    print(f'{len(L)} sheets, refs uploaded', flush=True)
    with ThreadPoolExecutor(a.j) as ex:
        for f in as_completed([ex.submit(run, j, base, key) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
