#!/usr/bin/env python3
"""外观与换装：生图（原图写到主仓库 art/src/avatar/，该目录不进 git）。
  avatar_gen.py wpn     [--only 前缀]   现有动作表 → 把武器换成纯绿 #00FF00 占位棍（姿势不变）→ art/src/avatar/sheets/<职业>_<表>.png
  avatar_gen.py ref     [--only 前缀]   时装参考立绘（占位棍版角色立绘 + 换上时装）→ art/src/avatar/refs/<职业>@<套装>.png
  avatar_gen.py set     [--only 前缀]   占位动作表 + 时装参考立绘 → 穿时装的动作表 → art/src/avatar/sets/<套装>/<职业>_<表>.png
  avatar_gen.py weapons [--only 前缀]   武器图表（横向、握柄在左）→ art/src/avatar/weapons/<表>.png
  --force 重新生成已存在的输出；-j 并发（团队约定：最多 2）
动作表来源：战斗组的 art/src/sheets2/*.png 与 art/src/combat/sheets/*.png（只读）。
遇到 429 退避 65 秒以上；上传走 sheets.upload 的缓存（全队上传限 5 次/分钟）。
"""
import os, sys, time, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import sheets as SH
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')   # 主仓库的 art（原图都在这里）
SRC = os.path.join(MAIN, 'src')
OUT = os.path.join(SRC, 'avatar')
SH.CACHE = os.path.join(OUT, '.upload_cache.json')
gi = SH.gi
GREEN = '#00FF00'

# 各职业原本画在手里的武器（改图时要替换掉的东西）
WEAPON_WORD = {'sword': 'katana (the blade, the round golden guard and the wrapped hilt)', 'gun': 'silver revolver', 'mage': 'crystal staff'}
# 不画占位棍的表（技能道具：肩炮、喷火器等保持原样）
NO_WPN = {'gun_launcher'}
# 动作表来源（后面的目录优先）
SHEET_DIRS = [os.path.join(SRC, 'sheets2'), os.path.join(SRC, 'combat', 'sheets')]

def source_sheets():
    L = {}
    for d in SHEET_DIRS:
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png') or f.endswith('_raw.png'): continue
            name = f[:-4]; cls = name.split('_')[0]
            if cls in WEAPON_WORD: L[name] = os.path.join(d, f)
    return L

EXTRA = {'sword': 'IMPORTANT: also erase the round golden sword guard (tsuba) that sat next to the fist, so that nothing gold or round remains next to the fist; only the bare green stick passes through the fist. ',
         'mage': 'IMPORTANT: at the end of the stick where the crystal orb of the staff was, put one small flat pure magenta (#FF00FF) ball (no outline, no shading) instead of the orb; the rest of the stick stays flat pure green. Erase the crystal orb and the wooden staff completely. ',
         'gun': 'IMPORTANT: erase the whole revolver (barrel, cylinder, grip and trigger); nothing silver or metal remains in the hand, only the green stick sticking out of the fist. If a frame shows two revolvers, replace BOTH with green sticks. '}

# 个别表里的技能道具（不是角色的武器），改图时保持原样
NOTES = {'gun_skillA': 'The grenade and the huge gatling gun are NOT the revolver: keep them exactly as they are. ',
         'gun_skillB': 'Revolvers flying in the air (thrown, not held in a hand) stay exactly as they are. ',
         'gun_sk1': 'The heavy gatling gun is NOT the revolver: keep it exactly as it is. ',
         'mage_sk1': 'The jack-o-lantern pumpkin bomb is NOT the staff: keep it exactly as it is. '}

def wpn_prompt(cls, name=''):
    w = WEAPON_WORD[cls]
    grip = {
        'sword': 'The fist grips the stick close to one end, exactly where the katana hilt was: a short stub of the stick (about one fist long) sticks out on the other side of the fist like a sword hilt, and the long part extends straight out along the line where the blade was.',
        'gun': 'The stick replaces the revolver: the fist grips one end of the stick where the revolver grip was, and the stick extends straight out of the fist along the line where the barrel pointed, about as long as the forearm.',
        'mage': 'The fist grips the stick where it held the staff; the stick runs straight through the fist along the line of the staff, keeping the same length on both sides of the fist as the staff had.',
    }[cls]
    return ('This image is a 2D game sprite animation sheet of a chibi character in a 3x3 grid (9 frames). Edit it with ONE change only: '
            f'in EVERY frame, completely remove the {w} and replace it with a plain, perfectly straight, rigid stick held by the same hand at the same position and the same angle. '
            f'The stick is painted in ONE flat pure green color ({GREEN}): no outline, no shading, no highlight, no texture, no guard, no decoration, uniform thickness about as wide as two fingers. '
            f'{grip} The fingers wrap around the stick and are drawn in front of it. '
            f'{EXTRA.get(cls, "")}{NOTES.get(name, "")}'
            'If a frame shows the weapon held in both hands, the stick is held in both hands the same way. If a frame shows no weapon, draw no stick. '
            'Keep EVERYTHING else exactly the same: the character design, every pose, arms, legs, clothing, colors, the position of each frame in the grid, and the plain white background. Do not add anything else.')

def run(job, base, key, force):
    out = job['out']
    if os.path.exists(out) and not force: return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    urls = [SH.upload(base, key, p) for p in job['refs']]
    payload = {'model': job.get('model', 'gpt-image-2.5-sunburst'), 'prompt': job['prompt'], 'n': 1, 'size': job.get('size', '2048x2048'),
               'quality': 'high', 'response_format': 'b64_json'}
    if urls: payload['image'] = urls
    t = time.time(); err = ''
    for i in range(4):
        try:
            resp = gi.post_json(f'{base}/images/generations', key, payload, 900); gi.save_images(resp, out, False, False)
            return f'ok   {os.path.relpath(out, OUT)}  {time.time() - t:.0f}s'
        except SystemExit as e:
            err = str(e)
            if 'HTTP 400' in err: break   # 参数错误：重试也没用
            time.sleep(70 if '429' in err else 10)
    return f'FAIL {os.path.relpath(out, OUT)}: {err[:200]}'

def jobs_wpn(only, tag=''):
    L = []
    for name, path in source_sheets().items():
        if not name.startswith(only) or name in NO_WPN: continue
        cls = name.split('_')[0]
        L.append({'out': os.path.join(OUT, 'sheets' + tag, f'{name}.png'), 'refs': [path], 'prompt': wpn_prompt(cls, name)})
    return L

# ---- 单帧返修：把 3×3 表里的某一格放大后单独改图，再按身体外框对齐贴回原位 ----
def cell_box(i, W=2048, H=2048):
    r, c = divmod(i, 3); return (round(c * W / 3), round(r * H / 3), round((c + 1) * W / 3), round((r + 1) * H / 3))

def body_box(arr):
    """近白以外、纯绿以外的像素外框（x0, y0, x1, y1）"""
    import numpy as np
    rgb = arr[..., :3].astype(int); mn, mx = rgb.min(-1), rgb.max(-1)
    m = ~((mn >= 232) & (mx - mn <= 22)) & ~((rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])) > 90)
    ys, xs = np.where(m)
    if not len(xs): return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def touch(sheet_png, cells, prompt, base, key, src_png=None):
    """src_png：从另一张表（通常是战斗组的原表）取这一格来改，结果贴回 sheet_png（改图把武器弄丢了的格子用）"""
    """sheet_png 就地修改（原图备份成 *_pre<n>.png）"""
    import numpy as np
    from PIL import Image
    sh = Image.open(sheet_png).convert('RGB'); W, H = sh.size
    bk = os.path.join(os.path.dirname(sheet_png), '_pre'); os.makedirs(bk, exist_ok=True); n = 1
    while os.path.exists(os.path.join(bk, os.path.basename(sheet_png)[:-4] + f'_{n}.png')): n += 1
    sh.save(os.path.join(bk, os.path.basename(sheet_png)[:-4] + f'_{n}.png'))   # 返修前的备份
    tmp = os.path.join(OUT, 'touch'); os.makedirs(tmp, exist_ok=True)
    stem = os.path.basename(sheet_png)[:-4]
    def one(i):
        bx = cell_box(i, W, H); cell = (Image.open(src_png).convert('RGB') if src_png else sh).crop(bx); cw, ch = cell.size
        src = os.path.join(tmp, f'{stem}_c{i}.png'); out = os.path.join(tmp, f'{stem}_c{i}_fix.png')
        cell.resize((1024, 1024), Image.LANCZOS).save(src)
        job = {'out': out, 'refs': [src], 'prompt': prompt, 'size': '1024x1024'}
        r = run(job, base, key, True)
        if not r.startswith('ok'): return r
        fix = Image.open(out).convert('RGB').resize((cw, ch), Image.LANCZOS)
        a0, a1 = body_box(np.array(cell)), body_box(np.array(fix))
        k = (a0[3] - a0[1]) / (a1[3] - a1[1])
        fx = fix.resize((max(1, round(cw * k)), max(1, round(ch * k))), Image.LANCZOS)
        # 身体外框底边中点对齐
        dx = round((a0[0] + a0[2]) / 2 - (a1[0] + a1[2]) / 2 * k); dy = round(a0[3] - a1[3] * k)
        canvas = Image.new('RGB', (cw, ch), (255, 255, 255)); canvas.paste(fx, (dx, dy))
        return (i, bx, canvas, f'ok 第 {i} 格 缩放 {k:.3f} 偏移 {dx},{dy}')
    res = []
    with ThreadPoolExecutor(2) as ex:
        for r in ex.map(one, cells): res.append(r)
    for r in res:
        if isinstance(r, str): print(r); continue
        i, bx, canvas, msg = r; sh.paste(canvas, bx[:2]); print(msg)
    sh.save(sheet_png)

RING = ('A chibi game character sprite holding a plain flat pure green (#00FF00) stick. There is a small round golden ring (an old sword guard) on the green stick right next to the glove. '
        'Remove that golden ring completely: the plain green stick simply continues through where the ring was, with the same thickness and the same flat pure green color, '
        'and the clothing behind it is restored. Change NOTHING else: same character, same pose, same stick position, same framing and size, same white background.')

# ---- 武器图：每张表一列 N 把，横放、握柄在左、尖端 / 枪口在右；画风跟角色一致，设计跟物品图标一致 ----
WEAPON_SHEETS = {   # 表名 → [(武器图 key, 图标 key, 描述)]
    'w_sword': [('shortsword', 'w_shortsword', 'a short straight double-edged sword with a small gold crossguard, a blue-wrapped grip and a round gold pommel'),
                ('katana', 'w_katana', 'a slim slightly curved katana with a round gold tsuba guard and a dark navy diamond-wrapped hilt'),
                ('club', 'w_club', 'a spiked iron mace: a wooden handle with leather wrapping and a big spiked iron ball on the right end'),
                ('greatsword', 'w_greatsword', 'a huge two-handed greatsword with a very broad straight steel blade, a heavy iron crossguard and a long leather-wrapped grip'),
                ('lightsaber', 'w_lightsaber', 'a lightsaber: a silver metal hilt with black grip bands on the left and a straight glowing cyan-blue energy blade with a white core')],
    'w_gun': [('revolver', 'w_revolver', 'a silver revolver with a brown wooden grip: muzzle pointing right, the grip hanging down at the left end'),
              ('autopistol', 'w_autopistol', 'a black semi-automatic pistol with a textured grip: muzzle pointing right, the grip hanging down at the left end'),
              ('rifle', 'w_rifle', 'a long musket rifle: a wooden stock on the left, a trigger under the middle, a long steel barrel pointing right'),
              ('handcannon', 'w_handcannon', 'a stubby hand cannon: a wide dark iron barrel with brass rings pointing right and a wooden pistol grip hanging down at the left end'),
              ('bowgun', 'w_bowgun', 'a wooden hand crossbow (bowgun) in side view: a stock with a pistol grip on the left, a loaded bolt pointing right and the dark bow limbs at the right end')],
    'w_mage': [('spear', 'w_spear', 'a long spear: a navy blue shaft with gold bands and a gold butt cap on the left, a pale blue crystal spearhead on the right'),
               ('pole', 'w_pole', 'a long plain wooden fighting staff with steel caps on both ends and a leather grip wrap'),
               ('rod', 'w_rod', 'a short magic wand: a twisted wooden handle with a gold pommel on the left and a shining golden star on the right tip'),
               ('staff', 'w_staff', 'a long mage staff: a twisted golden-brown shaft, a glowing sky-blue crystal orb held by golden prongs on the right end'),
               ('broom', 'w_broom', 'a witch broom: a long wooden handle on the left and a bushy straw brush tied with red cord on the right end')],
    'e_sword': [('ep_shortsword', 'ep_shortsword', 'Eleanor the Shadowless Sword: a short sword with a translucent ice-blue crystal blade and an ornate gold winged crossguard with a blue gem'),
                ('ep_katana', 'ep_katana', 'Moonlight katana: a silver-white curved blade decorated with small crescent moons, a round gold tsuba with a moon, a navy wrapped hilt with a hanging moon charm'),
                ('ep_katana2', 'ep_katana2', 'a katana with a dark crimson-red blade, a gold cross-shaped guard with a red gem and a black-and-red hilt'),
                ('ep_club', 'ep_club', 'Hell Evil Eye: a mace with a dark purple spiked head holding a big glowing orange demon eye, a black-and-gold handle'),
                ('ep_greatsword', 'ep_greatsword', 'Slaughter Blade: a huge jagged blood-red serrated greatsword with a dark gold demonic crossguard and a red gem'),
                ('ep_lightsaber', 'ep_lightsaber', 'a gold ornate lightsaber hilt with red gems and a blazing red-orange energy blade crackling with lightning')],
    'e_gun': [('ep_revolver', 'ep_revolver', 'an ornate golden revolver with engraved patterns and a red gem on the grip: muzzle pointing right, the grip hanging down at the left end'),
              ('ep_autopistol', 'ep_autopistol', 'a sleek pistol glowing with firefly-green-gold light trails, silver and gold body: muzzle pointing right, the grip hanging down at the left end'),
              ('ep_rifle', 'ep_rifle', 'a long ornate sniper rifle with a gold scope shaped like an eye, dark wood and gold trim: stock on the left, barrel pointing right'),
              ('ep_handcannon', 'ep_handcannon', 'Sun Devourer: a black-and-gold hand cannon engraved with flames and a sun emblem, a small flame at the muzzle on the right, the grip hanging down at the left end'),
              ('ep_bowgun', 'ep_bowgun', 'Silver Moon Wing: a white-and-gold crossbow whose bow limbs are small white angel wings, a blue gem, a loaded bolt pointing right, the stock on the left')],
    'e_mage': [('ep_spear', 'ep_spear', 'Dragonkin Spear: a long spear with a red-gold dragon-shaped spearhead on the right and a dark red shaft with gold dragon-scale bands'),
               ('ep_pole', 'ep_pole', 'Sky Dome Pole: a long white-gold staff carved from sacred wood with floating cloud ornaments on both ends'),
               ('ep_rod', 'ep_rod', 'Sage Astra: a short golden wand with a big shining golden star with small leaves on the right tip and a red gem'),
               ('ep_staff', 'ep_staff', 'Starry Sea Staff: a long navy staff with gold rings and a glowing galaxy orb circled by gold rings and little stars on the right end'),
               ('ep_broom', 'ep_broom', 'Night Witch Broom: a dark purple broom with a curved handle on the left ending in a hanging gold crescent-moon charm, and a purple feather-like brush on the right end')],
    # 用户确认样例时要求“巨剑再加厚”：单独一张表重画巨剑（和史诗巨剑），切图时覆盖前面表里的同名武器
    'w_heavy': [('greatsword', 'w_greatsword', 'a massive heavy two-handed greatsword: an extremely broad and thick straight steel blade (the blade is about as wide as a third of its length, like a huge slab of iron), '
                 'a heavy iron crossguard, a long leather-wrapped grip and a round iron pommel; it looks very heavy'),
                ('ep_greatsword', 'ep_greatsword', 'Slaughter Blade, a massive heavy greatsword: an extremely broad and thick jagged blood-red serrated blade (about as wide as a third of its length), '
                 'a dark gold demonic crossguard with a red gem, a long dark-red wrapped grip; it looks very heavy')],
}

def weapon_ref(name, items):
    """把对应的物品图标拼成一张参考条（设计照图标来）"""
    from PIL import Image
    out = os.path.join(OUT, 'weapons', f'ref_{name}.png')
    icon = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'final', 'icon')
    M = Image.new('RGB', (256 * len(items), 256), (255, 255, 255))
    for i, (_, ik, _) in enumerate(items):
        im = Image.open(os.path.join(icon, f'item_{ik}.webp')).convert('RGBA').resize((256, 256), Image.LANCZOS); M.paste(im, (i * 256, 0), im)
    os.makedirs(os.path.dirname(out), exist_ok=True); M.save(out); return out

def weapon_prompt(items):
    rows = '; '.join(f'row {i + 1}: {d} (design like icon {i + 1} of the second image)' for i, (_, _, d) in enumerate(items))
    return ('2D game weapon sprite sheet for a cute chibi action RPG. Draw exactly ' + str(len(items)) + ' weapons stacked in one column, one weapon per row, '
            'each weapon lying perfectly HORIZONTAL in strict side view (flat profile, not diagonal, not in perspective), with the handle / grip / stock at the LEFT and the blade tip / muzzle / head pointing to the RIGHT. '
            f'{rows}. '
            'Match the art style of the chibi character in the first image exactly: bold dark outlines, clean cel shading, bright saturated colors, the same line thickness. '
            'Each weapon is centered in its row with wide white gaps between rows; no hands, no characters, no text, no labels, no shadows, no glow halo around the weapons. Plain pure white background.')

# ---- 时装套装：先做一张“穿这套时装”的参考立绘，再把占位动作表整张换装（姿势、占位棍都不变） ----
WHO = {'sword': 'boy swordsman (same face, same spiky silver hair, red eyes)', 'gun': 'girl gunner (same face, same long brown ponytail, blue eyes)',
       'mage': 'girl mage (same face, same long lavender hair, golden eyes)'}
SETS = {
    'festival': {   # 庆典时装：红色节日礼服，白毛边 + 金色星星（和帕丽丝卖的图标一致）
        'sword': 'a red double-breasted festive coat with thick white fluffy fur trim on the collar, cuffs and hem, gold buttons and small gold star ornaments; a red bow tie with a gold-framed ruby gem at the collar; '
                 'a red satin sash belt with a gold square buckle; red knee-length shorts with gold trim and white knee socks; glossy red shoes with gold buckles. The red scarf is removed.',
        'gun': 'a short red festive jacket with white fluffy fur trim on the collar and cuffs, gold buttons and small gold star ornaments; a red bow tie with a gold-framed ruby gem at the collar; '
               'a red satin sash belt with a gold square buckle; a red pleated mini skirt with gold trim and a white frill; white stockings; glossy red Mary-Jane shoes with gold buckles. The blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a red festive dress-coat with white fluffy fur trim on the collar, cuffs and hem, gold buttons and small gold star ornaments; a red bow tie with a gold-framed ruby gem at the collar; '
                'a red satin sash belt with a gold square buckle; a red pleated skirt with gold trim and a white frill; white stockings; glossy red Mary-Jane shoes with gold buckles. The witch hat and the cape are removed (hair uncovered).',
    },
}

def ref_prompt(cls, outfit):
    return (f'Edit this chibi {WHO[cls]} character sheet art: keep exactly the same character, the same face and hair, the same standing pose, the same proportions and the same cute art style with thick outlines, '
            f'but change the clothes to this festive outfit: {outfit} The hands are empty (no weapon). No hat, no glasses, no hair ornament. Plain pure white background.')

def set_prompt(cls, outfit):
    return ('The FIRST image is a 2D game sprite animation sheet (3x3 grid, 9 frames) of a chibi character holding a flat pure green stick. The SECOND image shows the same character in a new outfit. '
            'Redraw the FIRST image exactly: the same 3x3 layout, the same poses, the same positions and sizes of every frame, the same flat pure green (#00FF00) sticks held in exactly the same way '
            f'(the stick stays flat pure green, with no outline or shading), but dress the character in EVERY frame in the outfit of the second image: {outfit} '
            'Keep the face, the hair and the art style. No hat, no glasses, no hair ornament. Plain pure white background, no text.')

def jobs_ref(only):
    L = []
    for sid, per in SETS.items():
        for cls, outfit in per.items():
            name = f'{cls}@{sid}'
            if not name.startswith(only): continue
            L.append({'out': os.path.join(OUT, 'refs', f'{name}.png'), 'refs': [os.path.join(SRC, f'{cls}_ref.png')], 'prompt': ref_prompt(cls, outfit), 'size': '1024x1536'})
    return L

def set_prompt_plain(cls, outfit):
    """没有占位棍的表（枪炮师的重武器等技能道具）：只换衣服"""
    return ('The FIRST image is a 2D game sprite animation sheet (3x3 grid, 9 frames) of a chibi character. The SECOND image shows the same character in a new outfit. '
            'Redraw the FIRST image exactly: the same 3x3 layout, the same poses, the same positions and sizes of every frame, the same props, weapons and effects, '
            f'but dress the character in EVERY frame in the outfit of the second image: {outfit} '
            'Keep the face, the hair and the art style. No hat, no glasses, no hair ornament. Plain pure white background, no text.')

def jobs_set(only):
    """每张动作表都要有时装版（缺帧会在两套衣服之间闪）：有占位表用占位表，没有（技能道具表）用原表"""
    L = []
    sd = os.path.join(OUT, 'sheets')
    for sid, per in SETS.items():
        for name, src in source_sheets().items():
            cls = name.split('_')[0]
            if cls not in per or not f'{sid}/{name}'.startswith(only): continue
            ref = os.path.join(OUT, 'refs', f'{cls}@{sid}.png')
            if not os.path.exists(ref): print('缺时装参考图，先跑 ref：', ref); continue
            ph = os.path.join(sd, f'{name}.png')
            if os.path.exists(ph): L.append({'out': os.path.join(OUT, 'sets', sid, f'{name}.png'), 'refs': [ph, ref], 'prompt': set_prompt(cls, per[cls])})
            elif name in NO_WPN: L.append({'out': os.path.join(OUT, 'sets', sid, f'{name}.png'), 'refs': [src, ref], 'prompt': set_prompt_plain(cls, per[cls])})
            else: print('缺占位表，先跑 wpn：', ph)
    return L

# ---- 头部配件：侧面（朝右）画，一张表一行 3 个：帽子、发饰、眼镜 ----
ACC = {
    'festival': [('hat', 'a small red top hat with a white band, a gold star-shaped emblem with a ruby and two white feathers on the side, seen in strict side view facing right, tilted slightly'),
                 ('hair', 'a red satin ribbon bow with gold trim and a small gold star in the knot, seen from the side, as a hair ornament worn at the back of the head'),
                 ('face', 'a pair of round red-and-gold glasses seen in strict side view (profile) for a character facing right: one round lens rim in front and one thin temple arm going back to the left, with small gold flower rivets')],
}

def jobs_acc(only):
    L = []
    for sid, items in ACC.items():
        if not sid.startswith(only): continue
        rows = '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(items))
        L.append({'out': os.path.join(OUT, 'acc', f'{sid}.png'), 'refs': [os.path.join(OUT, 'refs', f'sword@{sid}.png'), os.path.join(SRC, 'items', 'sheet_avatar.png')],
                  'size': '2048x1152',
                  'prompt': ('2D game costume accessory sprites for a cute chibi action RPG, matching the art style of the character in the first image (bold dark outlines, clean cel shading, bright colors) '
                             f'and the designs of the matching icons in the second image. Draw exactly {len(items)} separate accessories in one row from left to right, each isolated with wide white gaps: {rows}. '
                             'No character, no head, no hands, no text, no shadows. Plain pure white background.')})
    return L

def jobs_weapons(only):
    L = []
    for name, items in WEAPON_SHEETS.items():
        if not name.startswith(only): continue
        cls = {'sword': 'sword', 'gun': 'gun', 'mage': 'mage', 'heavy': 'sword'}[name.split('_')[1]]
        L.append({'out': os.path.join(OUT, 'weapons', f'{name}.png'), 'refs': [os.path.join(SRC, f'{cls}_ref.png'), weapon_ref(name, items)],
                  'prompt': weapon_prompt(items), 'size': '2048x2048'})
    return L

# 单格重做占位棍（从原表取格子）：武器类型 → 提示词
CELL = {k: (f'This is a chibi game character sprite (one frame of an animation) holding a {w.split(" (")[0]}. Replace the {w} completely with a plain, perfectly straight, rigid stick held by the same hand at the same position and the same angle, '
            f'painted in ONE flat pure green color (#00FF00): no outline, no shading, no guard, uniform thickness about as wide as two fingers. {g} The fingers wrap around the stick and are drawn in front of it. {EXTRA.get(k, "")}'
            'Keep EVERYTHING else exactly the same: the same character, pose, framing and size, and the plain white background.')
        for k, w, g in [('sword', WEAPON_WORD['sword'], 'The stick extends straight out of the fist along the line where the blade was.'),
                        ('gun', WEAPON_WORD['gun'], 'The stick sticks straight out of the fist along the line where the barrel pointed, about as long as the forearm.'),
                        ('mage', WEAPON_WORD['mage'], 'The stick runs straight through the fist along the line of the staff, keeping the same length on both sides as the staff had.')]}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('--only', default=''); ap.add_argument('-j', type=int, default=2)
    ap.add_argument('--force', action='store_true'); ap.add_argument('--tag', default='')
    ap.add_argument('--sheet', default=''); ap.add_argument('--cells', default=''); ap.add_argument('--prompt', default=''); ap.add_argument('--from', dest='src', default='')
    a = ap.parse_args()
    base, key, _ = gi.load_cfg()
    if a.cmd == 'touch':   # avatar_gen.py touch --sheet art/src/avatar/sheets/sword_walk.png --cells 0,3,7 [--prompt ring|文字]
        p = RING if a.prompt in ('', 'ring') else CELL.get(a.prompt, a.prompt)
        return touch(a.sheet, [int(x) for x in a.cells.split(',')], p, base, key, a.src or None)
    if a.cmd == 'wpn': L = jobs_wpn(a.only, a.tag)
    elif a.cmd == 'weapons': L = jobs_weapons(a.only)
    elif a.cmd == 'ref': L = jobs_ref(a.only)
    elif a.cmd == 'set': L = jobs_set(a.only)
    elif a.cmd == 'acc': L = jobs_acc(a.only)
    else: sys.exit('未知命令 ' + a.cmd)
    print(f'{len(L)} jobs', flush=True)
    with ThreadPoolExecutor(min(2, a.j)) as ex:
        for f in as_completed([ex.submit(run, j, base, key, a.force) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
