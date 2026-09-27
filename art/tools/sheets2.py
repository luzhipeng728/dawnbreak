#!/usr/bin/env python3
"""第二版动作表：3×3 格，第 1 格是标准站姿（统一比例用），其余 8 格是连续的动画帧。
走 / 跑是完整的 8 帧循环（逐帧写明哪条腿在前），攻击、跳跃、受击、技能都拆成多帧。
  sheets2.py [--only 前缀] [-j 8]      输出 art/src/sheets2/<角色>_<表>.png，已存在的跳过
"""
import os, sys, json, time, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
from sheets import gi, upload, ROOT

NEAR = 'near leg (the leg closer to the viewer)'; FAR = 'far leg (the leg farther from the viewer)'
WALK = [f'walk contact: {NEAR} stepping forward with the heel touching the ground, {FAR} stretched behind on its toes, arms swinging opposite to the legs',
        f'walk down: weight landing on the {NEAR} in front with the knee slightly bent, body at its lowest, {FAR} bending behind',
        f'walk passing: {NEAR} straight under the body carrying the weight, {FAR} lifted with the knee bent passing forward beside it',
        f'walk up: body at its highest on the {NEAR}, {FAR} swinging forward in front',
        f'walk contact MIRRORED: now the {FAR} steps forward with the heel touching the ground and the {NEAR} is stretched behind on its toes',
        f'walk down: weight landing on the {FAR} in front, body at its lowest, {NEAR} bending behind',
        f'walk passing: {FAR} straight under the body, {NEAR} lifted with the knee bent passing forward',
        f'walk up: body at its highest on the {FAR}, {NEAR} swinging forward in front']
RUN = [f'run contact: {NEAR} landing forward under the body, {FAR} pushing off behind, body leaning forward, arms pumping',
       f'run push: {NEAR} extended straight behind pushing off the ground, {FAR} knee driven high forward, strong forward lean',
       'run flight: BOTH feet off the ground in mid-stride, legs spread front and back, body leaning forward',
       f'run reach: {FAR} reaching forward to land, {NEAR} folding up behind',
       f'run contact MIRRORED: {FAR} landing forward under the body, {NEAR} pushing off behind, arms pumping the other way',
       f'run push: {FAR} extended straight behind pushing off, {NEAR} knee driven high forward',
       'run flight: BOTH feet off the ground, legs spread the other way, leaning forward',
       f'run reach: {NEAR} reaching forward to land, {FAR} folding up behind']
JUMP = ['jump take-off: crouched low with bent knees ready to spring up', 'jumping up: body stretched rising into the air, legs trailing below',
        'jump apex: floating at the top with knees tucked up', 'falling: legs reaching down, arms up for balance', 'landing: knees bent absorbing the impact, slightly crouched']
REACT = ['hurt: flinching backward, eyes shut in pain', 'hurt harder: knocked back with the upper body bent backward',
         'knocked into the air: body horizontal tumbling backward mid-air, arms and legs flailing', 'lying knocked down flat on the back on the ground',
         'getting up from the ground: on one knee pushing up with a hand', 'dodge roll: curled up into a tight ball rolling forward']

PLAYERS = {
    'sword': {'hold': 'holding the katana', 'sheets': {
        'walk': WALK, 'run': [r + ', katana trailing behind' for r in RUN],
        'jump': JUMP + ['mid-air slash wind-up: katana raised high behind the head while airborne', 'mid-air slash: katana swinging down in front while airborne', 'mid-air slash follow-through: katana low, airborne'],
        'combo': ['slash 1 wind-up: katana drawn back high over the shoulder', 'slash 1 strike: katana swinging horizontally forward, blur of motion', 'slash 1 follow-through: katana extended forward and low, body twisted',
                  'slash 2 wind-up: katana held low behind at the hip', 'slash 2 strike: katana swinging upward in a rising arc', 'slash 2 follow-through: katana high above the head',
                  'slash 3 wind-up: leaping forward with the katana raised high overhead with both hands', 'slash 3 strike: powerful downward smash, katana swung all the way down to the ground in front'],
        'react': REACT + ['dash attack start: lunging forward low with the katana held forward', 'dash attack: long lunge with the katana thrust straight forward'],
        'skillA': ['rising slash wind-up: crouched low with the katana held down and back', 'rising slash: leaping slightly while swinging the katana straight upward', 'rising slash follow-through: katana pointing to the sky',
                   'spin slash wind-up: body twisted away with the katana behind', 'spin slash: spinning around with the katana sweeping in a full circle', 'quick-draw ready: crouched low, katana in the scabbard at the waist, hand gripping the hilt',
                   'quick-draw finished: very low wide lunge far forward, katana extended after a lightning-fast slash', 'rapid stab: katana thrust straight forward at full extension'],
        'skillB': ['rapid stab retract: katana pulled back ready to thrust again', 'leaping high with the katana raised overhead for a ground smash', 'ground smash impact: landing and slamming the katana into the ground',
                   'crouching low before leaping upward', 'leaping upward in a rising dragon slash, katana pointing to the sky', 'focusing power: katana held vertically in front of the face, aura rising',
                   'ultimate stance: legs wide, hand on the hilt, glowing with power', 'ultimate finish: standing tall after the slash, katana held out to the side, scarf flowing']}},
    'gun': {'hold': 'holding the silver revolver', 'sheets': {
        'walk': WALK, 'run': RUN,
        'jump': JUMP + ['mid-air aiming the revolver diagonally downward', 'mid-air firing the revolver diagonally downward with a recoil kick', 'mid-air recovering from the shot'],
        'combo': ['aiming the revolver straight forward with the arm fully extended', 'firing the revolver straight forward with the arm kicked up by the recoil', 'aiming the revolver diagonally upward',
                  'firing the revolver diagonally upward with recoil', 'chambering a kick: knee raised high', 'high kick: one leg kicking straight up high',
                  'spinning kick wind-up: body turned away', 'spinning side kick: one leg extended straight forward, body leaning back'],
        'react': REACT + ['dropping low into a slide', 'sliding feet-first along the ground in a low slide kick'],
        'skillA': ['winding up to throw a grenade, arm pulled far back', 'just threw a grenade, arm extended forward', 'firing a huge gatling gun held at the hip with both hands',
                   'gatling gun recoil: leaning back while the gatling gun blazes', 'aiming carefully with both hands like a sniper, one eye closed', 'twirling the revolver on a finger with a confident wink',
                   'firing the revolver rapidly forward, gun smoking', 'firing the revolver rapidly diagonally upward'],
        'skillB': ['throwing two revolvers spinning forward like boomerangs', 'catching the returning revolvers', 'ultimate: striking a cool pose with the revolver raised beside the face',
                   'ultimate: firing wildly in all directions', 'dashing forward low', 'reloading the revolver', 'taunting with a playful grin', 'victory pose with the revolver pointed up']}},
    'mage': {'hold': 'holding the crystal staff', 'sheets': {
        'walk': WALK, 'run': RUN,
        'jump': JUMP + ['mid-air raising the staff to cast downward', 'mid-air pointing the staff diagonally down releasing magic', 'mid-air recovering after the cast'],
        'combo': ['staff swing 1 wind-up: staff raised behind her', 'staff swing 1: staff swung forward horizontally', 'staff swing 1 follow-through: staff low in front',
                  'staff swing 2 wind-up: staff held low behind', 'staff swing 2: staff swung upward', 'staff swing 2 follow-through: staff high above',
                  'charging a spell with the staff held forward, crystal glowing', 'releasing a spell forward, staff thrust forward, crystal flashing'],
        'react': REACT + ['dashing forward swinging the staff low', 'dash attack: staff swept forward'],
        'skillA': ['raising the staff overhead, starting to cast', 'staff raised high overhead, crystal blazing with magic', 'raising the staff to slam it down',
                   'slamming the staff down to the ground, magic erupting', 'channeling magic with both hands holding the staff forward', 'channeling harder, hair and skirt blown by magic wind',
                   'arms spread wide releasing a huge burst of magic', 'casting with one palm forward and the staff held back'],
        'skillB': ['spinning around with the staff', 'kneeling and praying with the staff', 'cheerful power-up pose with sparkles', 'calling down a meteor with both arms raised to the sky',
                   'summoning a tornado with a sweeping staff motion', 'pulling with a clenched hand as if gripping a black hole', 'ultimate: floating slightly with the staff raised, elemental orbs around her', 'victory pose with a wink']}},
}
MON_ATK = {'goblin': 'the spiked club', 'goblinCaptain': 'the short sword', 'goblinChief': 'both big fists', 'goblinShaman': 'the curved scimitar', 'flameMage': 'the fire staff',
           'cat': 'the claws', 'catKing': 'the claws', 'tau': 'the battle axe', 'tauArmored': 'the battle axe', 'tauKing': 'the golden axe', 'zombie': 'the claws and teeth', 'boneLord': 'the skeletal claws'}
MON_CAST = {'goblinShaman': 'raising a hand crackling with lightning', 'flameMage': 'raising the fire staff to cast a fire spell', 'boneLord': 'raising both hands casting a frost spell',
            'catKing': 'rearing up and hissing with claws spread', 'cat': 'rearing up and hissing', 'zombie': 'moaning with both arms raised forward', 'goblin': 'raising an arm to throw a rock',
            'goblinCaptain': 'raising the sword to command', 'goblinChief': 'roaring with both arms raised', 'tau': 'roaring with both arms raised', 'tauArmored': 'roaring with both arms raised', 'tauKing': 'roaring with both arms raised'}
MON_LOW = {'cat': 'pouncing', 'catKing': 'pouncing', 'tau': 'charging head-down with the horns forward', 'tauArmored': 'charging head-down with the horns forward', 'tauKing': 'charging head-down with the horns forward'}
def mon_sheets(n):
    atk, cast, low = MON_ATK[n], MON_CAST[n], MON_LOW.get(n, 'lunging')
    return {
        'walk': WALK, 'run': RUN,
        'act': [f'attack wind-up start: pulling back {atk}', f'attack wind-up peak: {atk} raised high, body coiled', f'attack strike: swinging {atk} down and forward with force',
                f'attack follow-through: {atk} low in front, leaning forward', 'hurt: flinching backward', 'hurt harder: knocked back, upper body bent backward',
                'knocked into the air: body horizontal tumbling backward mid-air', 'lying knocked down flat on the back on the ground'],
        'more': [f'{cast}, beginning', f'{cast}, at full power', f'crouching low, preparing for {low}', f'{low} forward, body stretched low',
                 'getting up from the ground on one knee', 'leaping in the air', 'standing idle, breathing in with the chest up', 'laughing and taunting'],
    }

def prompt(frames, hold):
    items = '; '.join(f'({i + 2}) {p}' for i, p in enumerate(frames))
    keep = f'The character is {hold} in the front hand in EVERY frame unless the frame says otherwise. ' if hold else ''
    return ('Using this exact chibi character (same design, same colors, same proportions and the same cute art style with thick outlines), draw a professional 2D game SPRITE ANIMATION SHEET: '
            '9 full-body frames of this SAME character at exactly the SAME scale, every frame in strict side view FACING RIGHT, arranged in a grid of 3 columns and 3 rows, '
            'with wide empty white gaps so that no frame touches or overlaps another; the feet of grounded frames in each row sit on the same baseline. '
            f'{keep}Frames in reading order (left to right, top to bottom): (1) standing idle reference pose; {items}. '
            'Consecutive frames must be clearly different poses so the animation reads smoothly. Plain pure white background, no ground, no shadows, no text, no numbers, no motion lines outside the character.')

from poseguide import frame_text
def hand_name(hold):
    if not hold: return 'the near-side hand'
    return 'the hand holding the ' + hold.replace('holding the ', '')

def guide_prompt(kind, hold):
    act = 'walking at a relaxed pace' if kind == 'walk' else 'running fast'
    per = '; '.join(f'({i + 2}) {frame_text(i * 45, kind == "run", hand_name(hold))}' for i in range(8))
    keep = f'The character keeps {hold} in the near-side (BLUE) hand, and that hand moves together with the blue arm. ' if hold else ''
    return ('The FIRST image is the character. The SECOND image is a pose guide: 9 simple mannequin figures in a 3x3 grid. '
            f'Draw a professional 2D game sprite animation sheet of this exact chibi character {act}: redraw the character from the first image 9 times, in exactly the same 3x3 layout as the pose guide, '
            'each copy copying EXACTLY the pose of the mannequin in the same cell: the same body lean, the same angle of every upper arm, forearm, thigh and shin, the same foot placement and the same height above the ground. '
            'In the pose guide the BLUE arm and BLUE leg are the character\'s NEAR side (closer to the viewer, drawn in front of the body) and the RED arm and RED leg are the FAR side (behind the body). '
            'Follow the colors strictly: when the blue leg is forward the red arm is forward and the blue arm is back, and vice versa — the arms always swing opposite to the legs, never the same side forward. '
            f'Frame by frame: (1) standing; {per}. '
            f'{keep}Keep the character\'s own design, colors, clothing, proportions and cute art style with thick outlines exactly as in the first image; do NOT draw the mannequin colors on the character. '
            'Every figure faces RIGHT in strict side view, all at the same scale, with wide white gaps between cells. Plain pure white background, no ground, no shadows, no text, no numbers.')

def jobs():
    L = []
    for c, d in PLAYERS.items():
        for sh, fr in d['sheets'].items(): L.append((f'{c}_{sh}', f'src/{c}_ref.png', fr, d['hold']))
    MON_HOLD = {'goblin': 'holding the spiked club', 'goblinCaptain': 'holding the short sword', 'goblinShaman': 'holding the curved scimitar', 'flameMage': 'holding the fire staff',
                'tau': 'holding the battle axe', 'tauArmored': 'holding the battle axe', 'tauKing': 'holding the golden axe'}
    for m in MON_ATK:
        for sh, fr in mon_sheets(m).items(): L.append((f'{m}_{sh}', f'src/{m}_ref.png', fr, MON_HOLD.get(m) if sh in ('walk', 'run') else None))
    return L

def run(job, base, key):
    name, ref, frames, hold = job
    out = os.path.join(ROOT, 'src', 'sheets2', f'{name}.png')
    if os.path.exists(out): return f'skip {name}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    url = upload(base, key, os.path.join(ROOT, ref))
    kind = name.rsplit('_', 1)[1]
    if kind in ('walk', 'run'):   # 走 / 跑：加姿势参考图，保证手脚反向摆动
        gurl = upload(base, key, os.path.join(ROOT, 'src', f'guide_{kind}.png'))
        payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': guide_prompt(kind, hold), 'n': 1, 'size': '2048x2048', 'quality': 'high', 'response_format': 'b64_json', 'image': [url, gurl]}
    else:
        payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': prompt(frames, hold), 'n': 1, 'size': '2048x2048', 'quality': 'high', 'response_format': 'b64_json', 'image': [url]}
    t = time.time(); err = ''
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
    for r in sorted({j[1] for j in L} | {'src/guide_walk.png', 'src/guide_run.png'}): upload(base, key, os.path.join(ROOT, r))
    print(f'{len(L)} sheets', flush=True)
    with ThreadPoolExecutor(a.j) as ex:
        for f in as_completed([ex.submit(run, j, base, key) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
