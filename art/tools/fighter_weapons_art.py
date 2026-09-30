#!/usr/bin/env python3
"""格斗家（男）拳上武器（B2）：5 类 × 普通 / 稀有 / 神器 / 传说 + 6 款武器装扮，一张图画一整组，切成一把一张交给 avatar_weapons.py
  fighter_weapons_art.py gen <表,...|all> [-j 2] [--force]   生图 → 主仓库 art/src/avatar/weapons2/fighter/<表>.png
      表：fam_<类型>（4 行：普通 / 稀有 / 神器 / 传说）、skin_<装扮>（5 行：手套 / 拳套 / 爪 / 东方棍 / 臂铠）
  fighter_weapons_art.py cut [表,...]      切成一把一张 → art/src/avatar/weapons2/<key>.png（key 同 avatar_weapons：<类型>、<类型>_r2..r4、<装扮>_<类型>）
  fighter_weapons_art.py review            原表拼一张审图 → art/work/fighter_b2/weapons_sheets.jpg
  fighter_weapons_art.py icons             物品图标 item_w_<类型> / item_sand_<类型> / w_fighter（从切好的武器图做，不生图；先跑 avatar_weapons.py）
之后：python3 art/tools/avatar_weapons.py knuckle boxing claw tonfa gauntlet <装扮>_ ...（握点 / 长度 / 握法在 avatar_weapons.py 的 SIZE / HAND / KIND / GRIP_FRAC）
画法：拳头武器按“戴在看不见的握紧的拳头上”画（腕口在左、指节朝右）；游戏里手套 / 拳套 / 爪 / 臂铠盖住拳头（avatar.js cover），东方棍握在拳里（盖回握拳像素）。
"""
import os, sys, argparse
import numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import avatar_gen as G
from prep import remove_bg, components

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(G.OUT, 'weapons2')
SD = os.path.join(V2, 'fighter')
WORK = os.path.join(HERE, 'work', 'fighter_b2')
STYLE_REF = os.path.join(V2, 'style_ref.png')
TYPES = ['knuckle', 'boxing', 'claw', 'tonfa', 'gauntlet']
WORN = ('shown as if worn on an invisible clenched right fist, seen in strict side view: the knuckles / front of the fist point to the RIGHT and the wrist opening is at the LEFT; '
        'it keeps the rounded shape of a tightly clenched fist, the hand inside is NOT drawn (the wrist opening is dark inside)')
FORM = {   # 类型的剪影（每一行都写）
    'knuckle': f'a martial-arts fighting GLOVE (knuckle glove) {WORN}; compact, about as long as it is tall',
    'boxing': f'a big round padded BOXING GLOVE {WORN}; the padded fist is big and bulbous, a short cuff at the left',
    'claw': (f'a CLAW weapon: a fighting glove {WORN}, with THREE long straight sharp blades sticking straight out forward from the knuckles to the RIGHT, parallel to each other, '
             'the blades about as long as the glove itself, straight with sharp points, NO hooks, no curls'),
    'tonfa': ('a TONFA (side-handle baton) lying perfectly horizontal in strict side view: a long straight thick baton whose long end extends to the LEFT and whose short rounded end sticks out a little to the RIGHT; '
              'a short grip handle sticks straight DOWN from the baton at about three quarters of the way to the right'),
    'gauntlet': ('a heavy ARMORED GAUNTLET (arm armor) seen in strict side view as if worn on an invisible right arm: a big clenched armored fist at the RIGHT end (knuckles pointing right) '
                 'and a long plated vambrace covering the whole forearm that extends to the LEFT, ending in an elbow guard at the left end; the whole piece is about twice as long as it is tall'),
}
BASE = {   # 普通 / 高级：朴素但好看
    'knuckle': 'black-and-tan leather with a padded knuckle guard, a riveted steel plate over the knuckles and a wrapped cream cloth wrist strap',
    'boxing': 'glossy bright red leather with a white laced cuff and a white seam line',
    'claw': 'a dark brown leather glove with a steel wrist guard and three polished steel blades',
    'tonfa': 'polished dark hardwood with brass end caps, a brass band and a leather-wrapped grip handle',
    'gauntlet': 'dark steel overlapping plates with rivets, a brown leather strap and a big clenched steel fist',
}
TIER = {   # 同一家族，一级比一级华丽（不能只换颜色）；和 weapon_gen.TIER 同一套说法
    1: 'COMMON grade: the plain basic design',
    2: 'RARE grade (purple): the same item upgraded with ONE added feature: an engraved silver trim band and one faceted purple amethyst gem; violet accents; the same size and outline plus that small addition',
    3: ('ARTIFACT grade (pink): a clearly more ornate version: a BIGGER silhouette with side ornaments sticking out (fins, curls or small spikes), engraved silver with rose-pink enamel '
        'and a large faceted pink crystal'),
    4: ('LEGENDARY grade (orange-gold): the most magnificent version: the largest, with a pair of small golden wings or a crest on it, gold and bright orange with a big faceted amber gem, '
        'flowing gold filigree and glowing orange rune lines painted on it'),
}
SKIN = {   # 武器装扮（avatar_gen.WEAPON_SKINS 同名主题）：5 行设计
    'spring': ('red and gold Chinese New Year style: gold dragon-head ornaments, gold dragon-scale patterns and a small red tassel', {
        'knuckle': 'red lacquered leather with a gold dragon head on the back of the hand and gold dragon scales on the knuckles, a red tassel at the cuff',
        'boxing': 'a red boxing glove with gold dragon-scale patterns, a gold dragon on the cuff and a red tassel',
        'claw': 'a red glove with three straight gold blades shaped like dragon claws, a gold dragon-head wrist guard and a red tassel',
        'tonfa': 'a red-lacquered tonfa with gold dragon caps on both ends, gold dragon-scale bands and a red tassel on the handle',
        'gauntlet': 'a red-and-gold armored gauntlet whose fist is a gold dragon claw, dragon-scale plates and a red tassel at the elbow'}),
    'summer': ('goofy summer beach style in sky blue, white and watermelon red', {
        'knuckle': 'a sky-blue-and-white striped swim glove with a little yellow rubber duck on the back of the hand',
        'boxing': 'a big round boxing glove shaped like a watermelon: green striped rind, a red flesh cuff with black seeds',
        'claw': 'a sky-blue glove whose three blades are long pastel ice popsicles (blue, pink and yellow)',
        'tonfa': 'a tonfa made of a long sky-blue freeze-pop ice tube with a white plastic handle',
        'gauntlet': 'a gauntlet made of a big cartoon red crab claw as the fist and a white-and-pink seashell vambrace'}),
    'holywing': ('holy white, gold and sky-blue sapphire style with small white angel feather wings', {
        'knuckle': 'a white-and-gold glove with a small pair of white angel wings on the wrist and a sapphire on the knuckles',
        'boxing': 'a white boxing glove with gold trim, a pair of small white angel wings on the cuff and a sapphire',
        'claw': 'a white-and-gold glove with three straight gleaming silver-white blades with gold edges, small white wings on the wrist and a sapphire',
        'tonfa': 'a white tonfa with gold bands and ornate gold caps with small white wings and a sapphire',
        'gauntlet': 'a gleaming white-and-gold armored gauntlet with a pair of white angel wings on the vambrace and a big sapphire on the fist'}),
    'flamedragon': ('crimson dragon scales, black and dark gold with glowing molten orange lava cracks (western dragon: horns, wings, claws)', {
        'knuckle': 'a black glove covered in crimson dragon scales with glowing orange cracks and small black horn spikes on the knuckles',
        'boxing': 'a crimson dragon-scale boxing glove with black horn spikes and glowing orange lava cracks',
        'claw': 'a black dragon-scale glove with three straight crimson dragon-claw blades with glowing orange edges',
        'tonfa': 'a black tonfa wrapped in crimson dragon scales with a horned dragon-head cap and glowing orange cracks',
        'gauntlet': 'a black-and-crimson dragon-scale armored gauntlet whose fist is a black dragon claw, with a small dragon wing on the vambrace and glowing orange cracks'}),
    'academy': ('royal-blue starry night-sky style with bright silver trim, gold stars and a crescent moon (school academy theme)', {
        'knuckle': 'a royal-blue glove painted like a starry night sky with silver trim and a gold star emblem on the back of the hand',
        'boxing': 'a royal-blue starry night-sky boxing glove with a silver crescent moon on the cuff and gold stars',
        'claw': 'a navy glove with three straight silver blades shaped like long star rays, a gold star on the wrist',
        'tonfa': 'a navy tonfa painted like a starry sky with silver star-shaped caps and small gold stars',
        'gauntlet': 'a royal-blue and silver armored gauntlet painted like a starry galaxy with a silver crescent moon and gold stars'}),
    'gothic': ('gothic style: black iron with bright polished silver filigree, crimson roses, thorny vines and small bat wings', {
        'knuckle': 'a black leather glove with bright silver filigree, silver thorny vines on the knuckles and a small crimson rose on the wrist',
        'boxing': 'a black boxing glove with silver filigree, a crimson rose on the cuff and small black bat wings',
        'claw': 'a black glove with three straight bright silver blades etched with thorny vines, a crimson rose on the wrist',
        'tonfa': 'a black tonfa wrapped in silver thorny vines with ornate silver gothic caps and a crimson rose',
        'gauntlet': 'a black iron armored gauntlet with bright silver filigree, small bat wings on the vambrace and a crimson rose on the fist'}),
}
NAMES = {'knuckle': 'fighting glove', 'boxing': 'boxing glove', 'claw': 'claw', 'tonfa': 'tonfa', 'gauntlet': 'armored gauntlet'}
RENDER = ('Rendering: thick clean dark outline around the whole silhouette and the main parts, crisp cel shading with one light and one dark tone plus sharp white highlights, '
          'rich materials (polished metal with bright reflections, faceted gems with glints, engraved gold or silver filigree, wrapped leather); any glowing runes or crystal light '
          'is painted INSIDE the item as bright flat shapes. Big bold readable shapes that stay recognizable when shown small. '
          'Match the line weight, colors and cel shading of the chibi characters in the first image (they are only a style reference: do not copy their weapons). '
          'No hands, no arms, no character, no text, no numbers, no labels, no frame, no cast shadow, no glow halo or aura outside the silhouettes, no sparks, no particles, no motion lines. '
          'Do not use pure neon green (#00FF00) or pure magenta (#FF00FF) anywhere. Plain pure white background.')

def head(n):
    return ('Premium 2D game weapon art sheet for a cute chibi (Q-style) action RPG in the style of Dungeon Fighter Online weapon avatars. '
            f'Draw exactly {n} separate items stacked vertically in {n} rows (ONE item per row, top to bottom, each item centered in its row), with wide empty white gaps between the rows '
            'so that no item touches or overlaps another; all items drawn at about the same size, each spanning about 45% of the image width. ')

def sheets():
    """表名 → (提示词, 参考图, [key...]（按行）)"""
    out = {}
    for t in TYPES:
        rows = '; '.join(f'row {r}: {TIER[r]}' for r in (1, 2, 3, 4))
        p = head(4) + (f'All four are the same weapon family, {FORM[t]}. Basic design: {BASE[t]}. From top to bottom the grade rises: {rows}. '
                       'Every row keeps the same weapon type, orientation and overall proportions; higher grades add ornaments and get slightly bigger. ') + RENDER
        out[f'fam_{t}'] = (p, [STYLE_REF], [t, f'{t}_r2', f'{t}_r3', f'{t}_r4'])
    for sk, (theme, per) in SKIN.items():
        rows = '; '.join(f'row {i + 1}: {FORM[t]}. Design: {per[t]}' for i, t in enumerate(TYPES))
        ref = os.path.join(V2, f'{sk}_shortsword.png')
        p = head(5) + (f'All five belong to one matching weapon-avatar costume set: {theme}. The five items are five different fist-weapon types, each keeping the silhouette of its type: {rows}. '
                       + ('The second image is another weapon of the same costume set: match its theme, colors and ornaments. ' if os.path.exists(ref) else '')) + RENDER
        out[f'skin_{sk}'] = (p, [STYLE_REF] + ([ref] if os.path.exists(ref) else []), [f'{sk}_{t}' for t in TYPES])
    return out

def gen(name, force):
    p, refs, _ = sheets()[name]; out = os.path.join(SD, f'{name}.png')
    if os.path.exists(out) and not force: return f'skip {name}'
    os.makedirs(SD, exist_ok=True)
    base, key, _ = G.gi.load_cfg()
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': p, 'n': 1, 'size': '1024x1536', 'quality': 'high', 'response_format': 'b64_json',
               'image': ['local:' + os.path.abspath(r) for r in refs]}
    err = ''
    for i in range(3):
        try:
            G.gi.save_images(G.gi.post_json(f'{base}/images/generations', key, payload, 900), out, False, False); return f'ok   {name}'
        except (SystemExit, OSError) as e:
            err = str(e)
            if 'HTTP 400' in err: break
    return f'FAIL {name}: {err[:200]}'

def cut(names):
    """一行一把：去白底 → 连通块按行分组（小碎块并进同一行最近的那把）→ 每把贴到白底画布上存成 weapons2/<key>.png"""
    S = sheets()
    for name in names:
        src = os.path.join(SD, f'{name}.png')
        if not os.path.exists(src): print('没有原图', src); continue
        keys = S[name][2]; a = np.array(remove_bg(Image.open(src)))
        lab, comps = components(a[..., 3], min_cells=6)
        boxes = []
        for c, n in comps:
            ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'n': n})
        boxes.sort(key=lambda b: -b['n']); big, small = boxes[:len(keys)], boxes[len(keys):]
        if len(big) < len(keys): print(f'{name}: 只找到 {len(big)} 把 <-- CHECK'); continue
        for s in small:
            cy = (s['y0'] + s['y1']) / 2; b = min(big, key=lambda b: abs(cy - (b['y0'] + b['y1']) / 2))
            if b['y0'] - 20 <= cy <= b['y1'] + 20 and s['n'] < b['n'] * 0.2:
                b['ids'].append(s['ids'][0]); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1']); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1'])
        big.sort(key=lambda b: b['y0'])
        for key, b in zip(keys, big):
            sub = a[b['y0']:b['y1'], b['x0']:b['x1']].copy(); L = lab[b['y0']:b['y1'], b['x0']:b['x1']]
            sub[..., 3] = np.where(np.isin(L, b['ids']), sub[..., 3], 0)
            im = Image.fromarray(sub, 'RGBA'); cv = Image.new('RGB', (im.width + 80, im.height + 80), 'white'); cv.paste(im, (40, 40), im)
            cv.save(os.path.join(V2, f'{key}.png')); print(f'  {key:20s} {im.width}x{im.height}')

def icons():
    """物品图标（不生图，从切好的武器图做，和现有图标同一种摆法）：item_w_<类型>（普通外观斜放，128）、item_sand_<类型>（流沙武器 = 神器外观 r3 斜放 + 淡紫描光）、
    w_fighter（职业武器图标：蓝色圆角底板 + 手套，104，同 w_sword）"""
    from PIL import ImageFilter, ImageDraw
    fin = os.path.join(HERE, 'final'); outd = os.path.join(fin, 'icon')
    def tilt(key, size, ang):
        im = Image.open(os.path.join(fin, 'weapon', f'{key}.webp')).convert('RGBA').rotate(ang, resample=Image.BICUBIC, expand=True); im = im.crop(im.getbbox())
        k = size / max(im.size); return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    def put(im, n, glow=None):
        cv = Image.new('RGBA', (n, n)); cv.alpha_composite(im, ((n - im.width) // 2, (n - im.height) // 2))
        if glow:
            a = cv.split()[3].filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.5)); g = Image.new('RGBA', (n, n), glow + (0,)); g.putalpha(a); g.alpha_composite(cv); cv = g
        return cv
    for t in TYPES:
        ang = 30 if t != 'tonfa' else 38
        put(tilt(t, 112, ang), 128).save(os.path.join(outd, f'item_w_{t}.webp'), 'WEBP', quality=90, method=6)
        put(tilt(f'{t}_r3', 108, ang), 128, (230, 140, 255)).save(os.path.join(outd, f'item_sand_{t}.webp'), 'WEBP', quality=90, method=6)
    n = 104; tile = Image.new('RGBA', (n, n)); d = ImageDraw.Draw(tile)
    d.rounded_rectangle([2, 2, n - 3, n - 3], 16, fill=(30, 60, 110, 255))
    for i in range(40):
        c = (int(40 + i * 1.4), int(110 + i * 2.2), int(210 + i * 1.0), 255); d.rounded_rectangle([6 + i // 8, 6 + i // 8, n - 7 - i // 8, n - 7 - i // 8], 12, outline=c, width=2)
    d.rounded_rectangle([7, 7, n - 8, n - 8], 12, fill=(60, 140, 230, 255)); d.rounded_rectangle([2, 2, n - 3, n - 3], 16, outline=(20, 30, 50, 255), width=4)
    tile.alpha_composite(put(tilt('knuckle', 80, 30), n)); tile.save(os.path.join(outd, 'w_fighter.webp'), 'WEBP', quality=90, method=6)
    print('icons ->', outd)

def review():
    os.makedirs(WORK, exist_ok=True); ims = []
    for n in sheets():
        p = os.path.join(SD, f'{n}.png')
        if os.path.exists(p): im = Image.open(p).convert('RGB'); ims.append(im.resize((round(im.width * 520 / im.height), 520)))
    if not ims: return
    cv = Image.new('RGB', (sum(i.width + 10 for i in ims), 520), 'white'); x = 0
    for i in ims: cv.paste(i, (x, 0)); x += i.width + 10
    cv.save(os.path.join(WORK, 'weapons_sheets.jpg'), quality=86); print(os.path.join(WORK, 'weapons_sheets.jpg'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('names', nargs='?', default=''); ap.add_argument('-j', type=int, default=2); ap.add_argument('--force', action='store_true')
    a = ap.parse_args(); S = sheets(); names = [n for n in a.names.split(',') if n] if a.names and a.names != 'all' else list(S)
    for n in names:
        if n not in S: sys.exit('未知表 ' + n)
    if a.cmd == 'cut': return cut(names)
    if a.cmd == 'review': return review()
    if a.cmd == 'icons': return icons()
    if a.cmd == 'show':
        for n in names: print(n, S[n][1], '\n ', S[n][0])
        return
    if a.cmd != 'gen': sys.exit('cmd: gen | cut | review | show')
    with ThreadPoolExecutor(min(3, a.j)) as ex:
        for f in as_completed([ex.submit(gen, n, a.force) for n in names]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
