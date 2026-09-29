#!/usr/bin/env python3
"""商城美术流水线（商城组）：宠物帧、光环、商城物品图标。
AI 原图写到主仓库 art/src/cash/（不进 git），最终 webp 写到本仓库 art/final/{pet,aura,cash}/。

  cash_art.py pets  [--only id]      宠物 4 帧表（一行 4 帧：待机、眨眼、移动 A、移动 B）→ src/cash/pets/<id>.png
  cash_art.py auras [--only id]      光环（俯视魔法阵，黑底，按亮度转透明）→ src/cash/auras/<id>.png
  cash_art.py icons [--only 表名]    图标表（白底）→ src/cash/icons/<表>.png
  cash_art.py cut                    全部切图 → art/final/pet/<id>_<0..3>.webp、art/final/aura/<id>.webp、art/final/cash/<key>.webp
                                     预览：src/cash/preview_*.png
生图并发固定 2（商城 / 装备 / 外观三组合计不超过 4）；遇到 429 退避 65 秒。已存在的输出自动跳过（要重出就先把原图改名成 .bak）。
"""
import os, sys, time, argparse, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw
from prep import remove_bg, components
from jobs import CHIBI

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # 本仓库 art/
MAIN = '/Users/luzhipeng/projects/dawnbreak/art'                              # 主仓库 art/（原图共享目录）
SRC = os.path.join(MAIN, 'src', 'cash')
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
PAR = 2

# ---- 宠物：fly = 飞行宠物（帧里画成悬空，运行时再上下浮动） ----
PETS = {
    'lion': dict(fly=0, desc='a tiny cute Chinese lion-dance cub (a baby festival lion): a round red body with golden swirl patterns, a big fluffy golden mane, a single tiny golden horn, big round sparkly eyes with long lashes, a wide happy smile, stubby little legs with golden paws, a short fluffy golden tail'),
    'seal': dict(fly=0, desc='a tiny cute chubby baby seal: soft white-grey fur, a round body, big shiny black eyes, little whiskers, small flippers, holding a small sky-blue surfboard with a white stripe under one front flipper'),
    'owl': dict(fly=1, desc='a tiny cute round brown baby owl: fluffy brown and cream feathers, huge round amber eyes behind small round glasses, a tiny black graduation mortarboard cap with a golden tassel on its head, small brown wings, tiny orange feet'),
    'fox': dict(fly=0, desc='a tiny cute magical fox cub: soft lavender and white fur, big sparkly violet eyes, a huge fluffy tail with rainbow gradient tip and tiny glowing star patterns, a small star-shaped charm on its forehead'),
    'panda': dict(fly=0, desc='a tiny cute chubby baby panda: black and white fur, round black ears, big shiny eyes inside black eye patches, holding a small green bamboo sprout in its paws, stubby legs'),
    'pegasus': dict(fly=1, desc='a tiny cute baby pegasus pony: white body, a flowing golden mane and tail, a pair of large golden feathered wings, golden hooves, big sparkly blue eyes, a tiny golden crown on its head'),
}
PET_FRAMES = {
    0: ['standing idle, calm and happy', 'standing idle with eyes closed (blinking), body very slightly squashed down', 'walking forward, step A: front leg forward and back leg back, a small hop', 'walking forward, step B: legs crossed under the body, bouncing up'],
    1: ['hovering in the air, wings raised up', 'hovering in the air, wings lowered down, eyes closed (blinking)', 'flying forward, wings raised high, body tilted forward', 'flying forward, wings swept down, body tilted forward'],
}
def pet_prompt(pid):
    d = PETS[pid]
    frames = PET_FRAMES[d['fly']]
    return (f'A sprite sheet of 4 animation frames of the SAME pet character for a 2D side-scrolling action RPG, arranged in ONE horizontal row, evenly spaced with generous white gaps, no frame touching another. '
            f'The pet: {d["desc"]}. Every frame shows the whole pet in strict side view facing RIGHT, the same size, same design and same colors. '
            'In order from left to right: ' + '; '.join(f'({i + 1}) {t}' for i, t in enumerate(frames)) + '. '
            f'Art style: {CHIBI}. Plain pure white background, no ground, no shadow, no text, no labels.')

# ---- 光环：俯视的圆形光效，纯黑底（运行时压扁画在脚下） ----
AURAS = {
    'spring': 'red and gold auspicious Chinese clouds (xiangyun) swirling around in a circular ring, with golden sparkles and small red lantern-like glows',
    'summer': 'a circular ring of splashing aqua ocean waves, white sea foam and glittering bubbles',
    'academy': 'a glowing violet-blue magic circle: two concentric rings of runes, small star symbols and a six-pointed star pattern in the middle',
    'box': 'a circular ring of rainbow-colored star trails, orbiting little stars and sparkles in pink, purple, cyan and gold',
    'supreme': 'a radiant golden holy halo ring on the ground: ornate golden runes, white angel feathers around the ring and soft light rays',
}
def aura_prompt(aid):
    return (f'A glowing magical aura effect seen from DIRECTLY ABOVE (top-down view), perfectly round and centered, filling most of the image: {AURAS[aid]}. '
            'Bright luminous colors glowing on a PURE BLACK background, the center of the circle is mostly empty and dark, soft glow, cute fantasy game effect style, no characters, no text.')

# ---- 图标表：每项 (物品 key, 描述)；4 列 ----
ICON_STYLE = ('cute cartoon mobile RPG item icon style matching a chibi fantasy game, bold clean dark outlines, bright saturated colors, soft glossy shading; '
              'each icon is a single isolated object with NO background tile, NO frame and NO border')
ICONS = {
    'av_spring': [('av_hair_spring', 'a pair of red fluffy pompom hair ornaments with a golden tasseled hairpin'), ('av_hat_spring', 'a small cute Chinese lion-dance head cap: red with golden eyebrows, big round eyes and white fluffy trim'),
                  ('av_face_spring', 'round golden-rimmed sunglasses with red lenses'), ('av_chest_spring', 'a golden Chinese longevity lock pendant on a red cord'),
                  ('av_top_spring', 'a red Chinese Tang-style jacket with golden frog buttons, golden cloud trim, a koi embroidery and a white fluffy collar'), ('av_bottom_spring', 'a red and gold Chinese-style pleated skirt with cloud patterns'),
                  ('av_belt_spring', 'a wide golden sash belt with a red Chinese knot tassel'), ('av_shoes_spring', 'a pair of red embroidered Chinese cloth shoes with golden patterns')],
    'av_summer': [('av_hair_summer', 'a big pink hibiscus flower hair clip'), ('av_hat_summer', 'a wide-brim straw sun hat with a sky-blue ribbon'),
                  ('av_face_summer', 'pink heart-shaped sunglasses'), ('av_chest_summer', 'a seashell necklace on a cord'),
                  ('av_top_summer', 'a blue-and-white Hawaiian shirt with hibiscus flower prints'), ('av_bottom_summer', 'sky-blue beach shorts with little palm tree prints'),
                  ('av_belt_summer', 'a colorful braided rope belt with a small seashell charm'), ('av_shoes_summer', 'a pair of brown beach sandals')],
    'av_academy': [('av_hair_academy', 'a big red plaid hair bow'), ('av_hat_academy', 'a navy blue beret with a golden school badge pin'),
                   ('av_face_academy', 'black square-frame glasses'), ('av_chest_academy', 'a red bow tie'),
                   ('av_top_academy', 'a navy blue school blazer with golden buttons, an emblem on the chest and a white shirt collar'), ('av_bottom_academy', 'a red and black plaid pleated skirt'),
                   ('av_belt_academy', 'a thin brown leather belt with a golden buckle'), ('av_shoes_academy', 'a pair of brown leather loafers')],
    'av_sky1': [('av_hair_sky1', 'a pair of small white angel-feather hair ornaments with golden clips'), ('av_hat_sky1', 'a floating golden halo crown with two small golden wings'),
                ('av_face_sky1', 'a delicate golden masquerade eye mask with small white feathers'), ('av_chest_sky1', 'a golden cross brooch with a sapphire'),
                ('av_top_sky1', 'a white and gold knight long coat with sky-blue lining and small white angel wings on the back'), ('av_bottom_sky1', 'a white and sky-blue skirt with white feather trim'),
                ('av_belt_sky1', 'a wide golden belt with a sapphire buckle'), ('av_shoes_sky1', 'a pair of white and gold knight boots with small wings')],
    'av_sky2': [('av_hair_sky2', 'a red flame-shaped hair ornament'), ('av_hat_sky2', 'a pair of curved black and red dragon horns'),
                ('av_face_sky2', 'a crimson dragon-eye masquerade mask'), ('av_chest_sky2', 'a dragon claw pendant holding a ruby'),
                ('av_top_sky2', 'a black dragon-scale long coat with red lining, golden dragon embroidery and small black-red dragon wings'), ('av_bottom_sky2', 'a black and red dragon-scale skirt with a flame-shaped hem'),
                ('av_belt_sky2', 'a red sash belt with a golden dragon-head buckle'), ('av_shoes_sky2', 'a pair of black and gold dragon-scale battle boots')],
    'misc': [('av_weapon_spring', 'a red and gold katana with a golden dragon coiled around the hilt and red tassels'), ('av_weapon_summer', 'a funny sky-blue popsicle-shaped sword with a watermelon slice as the guard'),
             ('petR_1', 'a red flame-shaped heart gem charm'), ('petR_2', 'a glowing crimson dragon heart gem held by golden dragon claws'),
             ('petB_1', 'a light blue feather charm'), ('petB_2', 'a radiant sky-blue angel feather with golden sparkles'),
             ('petG_1', 'a jade green leaf charm'), ('petG_2', 'a glowing golden-green world tree leaf with sparkles'),
             ('title_spring', 'a golden medal badge with a red koi fish emblem and red ribbons'), ('title_summer', 'a golden medal badge with a sun and ocean wave emblem and blue ribbons'),
             ('title_academy', 'a golden medal badge with an open book and a star emblem and navy ribbons'), ('title_box', 'a purple medal badge with a small magic treasure box emblem'),
             ('title_supreme', 'a magnificent golden winged crown badge with a radiant sunrise emblem and rainbow gems'), ('cera', 'a shiny pink-magenta diamond-shaped coin'),
             ('shard_box', 'a glowing purple crystal shard'), ('coin_gift', 'a golden commemorative coin with a red gift-bow emblem')],
    'orbs': [('orb_spring', 'a glowing red orb with a tiny golden koi fish inside'), ('orb_summer', 'a glowing aqua orb with a tiny sun inside'),
             ('orb_academy', 'a glowing navy blue orb with a golden star inside'), ('orb_title1', 'a glowing orange orb with a fist symbol inside'),
             ('orb_title2', 'a glowing yellow orb with a sharp four-pointed star inside'), ('orb_title_supreme', 'a radiant golden orb with a crown inside and rainbow sparkles around it'),
             ('orb_weapon1', 'a glowing silver-red orb with a sword inside'), ('orb_weapon2', 'a glowing orb with four swirling colors: red fire, blue ice, white light and purple dark'),
             ('orb_armor1', 'a glowing green orb with a shield inside'), ('orb_acc1', 'a glowing teal orb with a ring inside'),
             ('orb_av1', 'a glowing light-blue orb with a small wing inside'), ('orb_av2', 'a glowing pink orb with a ribbon bow inside'),
             ('orb_pet1', 'a glowing lavender orb with a paw print inside'), ('orb_pet_supreme', 'a radiant golden orb with a winged paw print inside'),
             ('tk_lotto', 'a golden lottery ticket with a sunrise emblem'), ('tk_avopt', 'a light blue ticket with a clothes hanger and circular arrows emblem')],
    'tickets_lv': [('tk_maxlv', "a radiant gold-and-purple level-up ticket with a big bold golden upward arrow and the bold text 'Lv.60'")],
    'tickets': [('tk_enh7', "a blue enhancement ticket with a sword emblem and a big bold '+7'"), ('tk_enh10', "a golden enhancement ticket with a sword emblem and a big bold '+10'"),
                ('tk_amp7', "a red amplification ticket with a glowing red crystal and a big bold '+7'"), ('tk_amp10', "a crimson and gold amplification ticket with a glowing red crystal and a big bold '+10'"),
                ('tk_avatar', 'a pink ticket with a cute dress emblem'), ('tk_sky', 'a radiant sky-blue and gold ticket with an angel wings emblem'),
                ('synth_basic', 'a cute magic fusion device: a round glass orb with a pink swirl inside on a bronze stand'), ('synth_gold', 'a golden magic fusion device: a round glass orb with a golden swirl on an ornate golden stand, sparkles'),
                ('synth_dream', 'a rainbow crystal magic fusion device with stars and a rainbow swirl'), ('cera_s', 'a small red envelope (hongbao) with a pink diamond coin'),
                ('cera_m', 'a red envelope with gold trim and a few pink diamond coins'), ('cera_l', 'a big fat red envelope overflowing with pink diamond coins'),
                ('box_magic', 'a mysterious purple magic treasure box with golden trim and a glowing golden question mark'), ('box_magic2', 'a shining golden magic treasure box with a glowing question mark and sparkles'),
                ('box_equip', 'a steel treasure chest with a sword and shield emblem'), ('box_epic', 'an ornate golden chest glowing with orange light and epic sparkles')],
    'boxes': [('box_orb', 'a small open jewel box full of colorful glowing orbs'), ('egg_pet', 'a big cute pet egg with pastel spots, slightly cracked'),
              ('box_petgear', 'a gift box with a paw print ribbon'), ('box_petgear2', 'a glowing pink-purple gift box with a paw print ribbon'),
              ('sel_petgear2', 'a golden gift box with three gems on top: red, blue and green'), ('box_supply', 'a wooden supply crate with potion bottles'),
              ('box_gold', 'a small treasure chest overflowing with gold coins'), ('box_avatar', 'a pink gift box with a clothes hanger ribbon'),
              ('box_mystery', 'a dark blue gift box covered with glowing stars and a big question mark'), ('pkg_spring', 'a festive red and gold New Year gift pack with a koi fish and red lanterns'),
              ('pkg_summer', 'a festive sky-blue summer gift pack with a hibiscus flower and a sun'), ('pkg_academy', 'a navy blue academy gift pack with a golden star crest and a book'),
              ('pkg_newbie', 'a green starter gift pack with a leaf ribbon'), ('pkg_lv', 'a purple level-up gift pack with a golden up-arrow emblem'),
              ('pkg_ltd', 'an orange limited-time gift pack with a clock emblem')],
}
def icon_prompt(items):
    n, cols = len(items), 4
    rows = (n + cols - 1) // cols
    return (f'A sprite sheet of {n} separate game item icons arranged in a grid of {cols} columns and {rows} rows on a plain pure white background, '
            f'evenly spaced with generous white gaps between icons, no icon touching another, all icons about the same size, {ICON_STYLE}. '
            'In reading order (left to right, top to bottom): ' + '; '.join(f'({i + 1}) {t}' for i, (_, t) in enumerate(items)) + '. No labels, no numbers except when written on a ticket.')

def gen(out, prompt, size, model=None):
    """调用 gpt-image 技能脚本；429 退避 65 秒，其他错误短暂重试。"""
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cmd = ['python3', GI, 'gen', prompt, '-o', out, '-s', size, '-q', 'high']
    if model: cmd += ['-m', model]
    t = time.time(); err = ''
    for attempt in range(6):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out): return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        err = (r.stderr + r.stdout)[-300:]
        time.sleep(65 if '429' in err else 8 + attempt * 6)
    return f'FAIL {os.path.basename(out)}: {err}'

def jobs(phase, only):
    L = []
    if phase == 'pets':
        for p in PETS:
            if not only or p in only: L.append((os.path.join(SRC, 'pets', f'{p}.png'), pet_prompt(p), '2048x1152', 'gpt-image-2.5-sunburst'))
    if phase == 'auras':
        for a in AURAS:
            if not only or a in only: L.append((os.path.join(SRC, 'auras', f'{a}.png'), aura_prompt(a), '1024x1024', None))
    if phase == 'icons':
        for s, items in ICONS.items():
            if not only or s in only:
                rows = (len(items) + 3) // 4
                L.append((os.path.join(SRC, 'icons', f'{s}.png'), icon_prompt(items), '2048x1152' if rows <= 2 else '2048x2048', None))
    return L

# ---------------- 切图 ----------------
def blobs(im, min_px=60):
    """去背后的连通块（按行、再按列排序），返回 [(y0,y1,x0,x1,label)] 与标签图。"""
    arr = np.array(im); lab, comps = components(arr[..., 3], min_cells=40)
    boxes = []
    for n, cells in comps:
        ys, xs = np.where(lab == n)
        if (ys.max() - ys.min()) > min_px or (xs.max() - xs.min()) > min_px: boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, n))
    return arr, lab, boxes

def order_grid(boxes):
    boxes = sorted(boxes, key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[2])]

def merge_small(arr, lab, boxes, keep):
    """大块之外的碎块（火花、流苏等）并到最近的大块里。"""
    big = sorted(boxes, key=lambda b: -(b[1] - b[0]) * (b[3] - b[2]))[:keep]
    out = []
    for b in big:
        y0, y1, x0, x1, n = b; ids = [n]
        for s in boxes:
            if s in big: continue
            cy, cx = (s[0] + s[1]) / 2, (s[2] + s[3]) / 2
            if y0 - 40 <= cy <= y1 + 40 and x0 - 40 <= cx <= x1 + 40: ids.append(s[4]); y0, y1, x0, x1 = min(y0, s[0]), max(y1, s[1]), min(x0, s[2]), max(x1, s[3])
        out.append((y0, y1, x0, x1, ids))
    return out

def crop_ids(arr, lab, b):
    y0, y1, x0, x1, ids = b
    c = arr[y0:y1, x0:x1].copy(); m = np.isin(lab[y0:y1, x0:x1], ids); c[..., 3] = np.where(m, c[..., 3], 0)
    return Image.fromarray(c, 'RGBA')

def square(ic, size=128, fill=0.8):
    s = max(ic.size); k = size * fill / s
    ic = ic.resize((max(1, round(ic.width * k)), max(1, round(ic.height * k))), Image.LANCZOS)
    sq = Image.new('RGBA', (size, size), (0, 0, 0, 0)); sq.paste(ic, ((size - ic.width) // 2, (size - ic.height) // 2), ic)
    return sq

def save_webp(im, path, q=86):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path, 'WEBP', quality=q, method=6)

def cut_icons(prev):
    """按网格分格：每个连通块按中心点落进哪一格归到那一格（一对翅膀、一对龙角这种两块的物品也能完整切出）。"""
    out = os.path.join(HERE, 'final', 'cash')
    for s, items in ICONS.items():
        p = os.path.join(SRC, 'icons', f'{s}.png')
        if not os.path.exists(p): print('缺少', s); continue
        im = remove_bg(Image.open(p)); arr, lab, boxes = blobs(im, 12)
        H, W = arr.shape[:2]; cols = min(4, len(items)); rows = (len(items) + cols - 1) // cols   # 不满 4 个的小表按实际个数分列
        cells = {}
        for b in boxes:
            cy, cx = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2
            k = min(rows - 1, int(cy / (H / rows))) * cols + min(cols - 1, int(cx / (W / cols)))
            c = cells.setdefault(k, [1e9, -1, 1e9, -1, []]); c[0] = min(c[0], b[0]); c[1] = max(c[1], b[1]); c[2] = min(c[2], b[2]); c[3] = max(c[3], b[3]); c[4].append(b[4])
        print(s, '格子', len(cells), '期望', len(items))
        if sorted(cells) != list(range(len(items))): print('  !! 格子对不上，跳过', s, sorted(cells)); continue
        for i, (key, _) in enumerate(items):
            ic = square(crop_ids(arr, lab, tuple(cells[i])), 128, 0.72)   # 背包格子里按旧图标规则放大 1.24 倍，这里留边
            save_webp(ic, os.path.join(out, f'{key}.webp')); prev.append((key, ic))

def cut_pets(prev):
    for pid, d in PETS.items():
        p = os.path.join(SRC, 'pets', f'{pid}.png')
        if not os.path.exists(p): print('缺少宠物', pid); continue
        im = remove_bg(Image.open(p)); arr, lab, boxes = blobs(im, 100)
        merged = merge_small(arr, lab, boxes, 4)
        merged = sorted(merged, key=lambda b: b[2])
        if len(merged) != 4: print('  !! 宠物帧数不对', pid, len(merged)); continue
        frames = [crop_ids(arr, lab, b) for b in merged]
        H = max(f.height for f in frames); W = max(f.width for f in frames)
        k = 170 / H   # 统一缩放：最高的一帧 170 像素
        for i, f in enumerate(frames):
            f = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            cv = Image.new('RGBA', (round(W * k) + 4, 174), (0, 0, 0, 0)); cv.paste(f, ((cv.width - f.width) // 2, cv.height - f.height - 2), f)   # 底对齐（脚在同一条线上）
            save_webp(cv, os.path.join(HERE, 'final', 'pet', f'{pid}_{i}.webp'), 90); prev.append((f'{pid}_{i}', cv))
        key = 'pet_' + pid
        ic = square(frames[0], 128, 0.74); save_webp(ic, os.path.join(HERE, 'final', 'cash', f'{key}.webp'))

def cut_auras(prev):
    for aid in AURAS:
        p = os.path.join(SRC, 'auras', f'{aid}.png')
        if not os.path.exists(p): print('缺少光环', aid); continue
        a = np.array(Image.open(p).convert('RGB')).astype(np.float32)
        # 黑底 → 透明：亮度当 alpha，颜色除以 alpha（去掉黑色）；暗部压一下，避免整张发灰
        lum = a.max(-1); alpha = np.clip((lum - 18) / 200.0, 0, 1) ** 1.1
        rgb = np.clip(a / np.maximum(lum[..., None], 1) * 255, 0, 255)
        im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA').resize((384, 384), Image.LANCZOS)
        save_webp(im, os.path.join(HERE, 'final', 'aura', f'{aid}.webp'), 88); prev.append((f'aura_{aid}', im))
        key = f'aura_{aid}'
        bg = Image.new('RGBA', (384, 384), (0, 0, 0, 0)); ic = square(im, 128, 0.92)
        save_webp(ic, os.path.join(HERE, 'final', 'cash', f'{key}.webp'))

def preview(prev, name):
    if not prev: return
    cols = 10; s = 136
    rows = (len(prev) + cols - 1) // cols
    cv = Image.new('RGB', (cols * s, rows * (s + 16)), (46, 42, 54)); d = ImageDraw.Draw(cv)
    for i, (k, im) in enumerate(prev):
        x, y = i % cols * s, i // cols * (s + 16)
        t = im.copy(); t.thumbnail((128, 128)); cv.paste(t, (x + 4, y + 4), t); d.text((x + 4, y + s - 2), k[:20], fill=(230, 220, 190))
    cv.save(os.path.join(SRC, f'preview_{name}.png'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default='')
    a = ap.parse_args(); only = [x for x in a.only.split(',') if x]
    if a.phase == 'cut':
        for name, fn in (('icons', cut_icons), ('pets', cut_pets), ('auras', cut_auras)):
            if only and name not in only: continue
            prev = []; fn(prev); preview(prev, name)
        return
    L = jobs(a.phase, only)
    print(f'{len(L)} 个生图任务，并发 {PAR}', flush=True)
    with ThreadPoolExecutor(PAR) as ex:
        fs = [ex.submit(gen, *j) for j in L]
        for f in as_completed(fs): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
