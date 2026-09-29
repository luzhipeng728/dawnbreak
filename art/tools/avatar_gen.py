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
NO_WPN = {'gun_launcher', 'gun_launcher2'}
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

try:   # 鬼剑士新表的双持说明（art/tools/sword_art.py）
    from sword_art import AVATAR_NOTES as _SWN; NOTES.update(_SWN)
except ImportError: pass

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
        except (SystemExit, OSError) as e:   # OSError：读超时 / 连接断开，重试
            err = str(e)
            if 'Invalid image data' in err and i == 0:   # 缓存的上传地址失效了：清掉缓存重新上传一次
                forget_uploads(job['refs']); payload['image'] = [SH.upload(base, key, p) for p in job['refs']]; continue
            if 'HTTP 400' in err: break   # 参数错误：重试也没用
            time.sleep(70 if '429' in err else 10)
    return f'FAIL {os.path.relpath(out, OUT)}: {err[:200]}'

def forget_uploads(paths):
    import json
    if not os.path.exists(SH.CACHE): return
    cache = json.load(open(SH.CACHE))
    for p in paths:
        for k in [k for k in cache if k.startswith(p + '|')]: cache.pop(k)
    json.dump(cache, open(SH.CACHE, 'w'), indent=1)

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

def recell(sid, name, cells, base, key):
    """时装表单格重画：拿占位表（原装姿势 + 绿棍）的这一格 + 时装参考图，重画这一格穿时装的样子，贴回 sets/<套装>/<表>.png。
    不按包围盒缩放（占位表的魔法师戴着巫师帽，包围盒不可比）：生成时图就是按格子等比放大的，缩回格子大小后按脚底对齐。"""
    import numpy as np
    from PIL import Image
    cls = name.split('_')[0]; outfit = SETS[sid][cls]
    sp = os.path.join(OUT, 'sets', sid, f'{name}.png'); ph = os.path.join(OUT, 'sheets', f'{name}.png'); ref = os.path.join(OUT, 'refs', f'{cls}@{sid}.png')
    sh = Image.open(sp).convert('RGB'); P = Image.open(ph).convert('RGB'); W, H = sh.size
    bk = os.path.join(OUT, 'sets', sid, '_pre'); os.makedirs(bk, exist_ok=True); n = 1
    while os.path.exists(os.path.join(bk, f'{name}_{n}.png')): n += 1
    sh.save(os.path.join(bk, f'{name}_{n}.png'))
    tmp = os.path.join(OUT, 'touch'); os.makedirs(tmp, exist_ok=True)
    prompt = ('The FIRST image is one frame of a 2D game sprite of a chibi character holding a flat pure green stick. The SECOND image shows the same character in a new outfit. '
              'Redraw the FIRST image exactly: the same pose, the same position and size of the character in the frame, the same flat pure green (#00FF00) stick held in exactly the same way '
              f'(flat pure green, no outline), but dress the character in the outfit of the second image: {outfit} '
              'Keep the face, the hair and the art style. No hat, no glasses, no hair ornament. Plain pure white background, no text.')
    def one(i):
        bx = cell_box(i, W, H); cell = P.crop(bx); cw, ch = cell.size
        src = os.path.join(tmp, f'{sid}_{name}_c{i}.png'); out = os.path.join(tmp, f'{sid}_{name}_c{i}_re.png')
        cell.resize((1024, 1024), Image.LANCZOS).save(src)
        r = run({'out': out, 'refs': [src, ref], 'prompt': prompt, 'size': '1024x1024'}, base, key, True)
        if not r.startswith('ok'): return r
        fix = Image.open(out).convert('RGB').resize((cw, ch), Image.LANCZOS)
        a0, a1 = body_box(np.array(cell)), body_box(np.array(fix))
        dx, dy = round((a0[0] + a0[2]) / 2 - (a1[0] + a1[2]) / 2), a0[3] - a1[3]   # 脚底对齐、水平居中
        canvas = Image.new('RGB', (cw, ch), (255, 255, 255)); canvas.paste(fix, (dx, dy))
        return (i, bx, canvas, f'ok {sid}/{name} 第 {i} 格 偏移 {dx},{dy}')
    res = []
    with ThreadPoolExecutor(2) as ex:
        for r in ex.map(one, cells): res.append(r)
    for r in res:
        if isinstance(r, str): print(r); continue
        i, bx, canvas, msg = r; sh.paste(canvas, bx[:2]); print(msg)
    sh.save(sp)

def touch(sheet_png, cells, prompt, base, key, src_png=None, keep=False):
    """src_png：从另一张表（通常是战斗组的原表）取这一格来改，结果贴回 sheet_png（改图把武器弄丢了的格子用）
    keep：换姿势重画（例如站姿改成单膝跪地）时不按身体高度缩放，保持模型画出来的大小，只按脚底对齐"""
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
        k = 1.0 if keep else (a0[3] - a0[1]) / (a1[3] - a1[1])
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

# ---- 装备深化组的第二批史诗武器（src/content/items/epics2.js）：设计照各自的物品图标 ----
_E2 = {
    'e2a_sword': [('ep_ss_kanya', 'a short sword with an icy-blue blade crackling with lightning, a dark blue-and-gold ornate guard with blue gems'),
                  ('ep_ss_fate', 'a short sword with a pale golden glowing blade, a gold cross-shaped guard with a round white gem and a brown grip'),
                  ('ep_ss_shura', 'a short sword with a dark crimson blade wreathed in purple flames, a black-and-silver guard with a purple gem'),
                  ('ep_kt_slaughter', 'a slim curved katana with a blood-red blade, a dark red wrapped hilt and a red tassel'),
                  ('ep_kt_andra', 'a slim curved katana with a pale ice-blue glowing blade and a silver-and-white hilt with a white flower-shaped guard'),
                  ('ep_kt_ninedragon', 'a katana with a jade-green glowing blade, a gold dragon-head guard and a green wrapped hilt')],
    'e2b_sword': [('ep_cb_devour', 'a mace with a dark purple spiked head holding a glowing purple eye, wisps of purple smoke, a black-and-gold handle'),
                  ('ep_cb_soulmate', 'a white-and-gold war hammer with a big white stone head and a small yellow thunder sprite sitting on top, gold handle'),
                  ('ep_cb_kirin', 'a mace whose head is a blue-and-gold qilin (kirin) head crackling with lightning, gold handle'),
                  ('ep_cb_heart', 'a dark spiked club with a glowing red heart-shaped crystal in the middle, a black-and-red handle')],
    'e2c_sword': [('ep_gs_earth', 'a huge broad greatsword made of mossy olive-green stone with glowing yellow runes and a bronze hilt'),
                  ('ep_gs_evildragon', 'a huge jagged dark purple-black demonic greatsword with spikes and a glowing red gem'),
                  ('ep_gs_guardian', 'a huge greatsword with a broad silver-blue blade, white angel wings on the guard and a blue gem'),
                  ('ep_ls_sun', 'a lightsaber with a blazing golden-orange energy blade and an ornate gold hilt'),
                  ('ep_ls_millennium', 'a lightsaber with a soft cream-white glowing energy blade and a white-and-gold hilt'),
                  ('ep_ls_elegy', 'a lightsaber with a blood-red energy blade and a black thorny hilt decorated with a red rose')],
    'e2a_gun': [('ep_rv_sunset', 'an orange-and-gold revolver with a brown wooden grip with a star; muzzle pointing right, grip hanging down at the left end'),
                ('ep_rv_bone', 'a white bone revolver decorated with icy blue gems and crystals; muzzle pointing right, grip hanging down at the left end'),
                ('ep_rv_python', 'a gold revolver with a golden python snake coiled around the barrel and green gems; muzzle pointing right, grip hanging down at the left end'),
                ('ep_ap_viper', 'a black-and-green pistol with a green snake-scale pattern and a snake head at the muzzle; muzzle pointing right, grip hanging down at the left end'),
                ('ep_ap_heckler', 'a red-and-orange pistol covered in flame patterns with gold trim; muzzle pointing right, grip hanging down at the left end')],
    'e2b_gun': [('ep_rf_death', 'a long black sniper rifle with a scope and a small white skull emblem; stock on the left, barrel pointing right'),
                ('ep_rf_zombie', 'a long icy-blue rifle covered with frost crystals, silver body; stock on the left, barrel pointing right'),
                ('ep_hc_breaker', 'a stubby orange-and-gold hand cannon with a striped drill-like muzzle; grip hanging down at the left end'),
                ('ep_hc_aqua', 'a blue-and-gold hand cannon shaped like a water vase, a little glowing water pouring from the muzzle; grip hanging down at the left end'),
                ('ep_hc_wing', 'a white-and-gold hand cannon with small white angel wings on its sides; grip hanging down at the left end')],
    'e2c_gun': [('ep_bg_red', 'a red-and-gold hand crossbow with ornate golden limbs and a red dragon motif, a loaded bolt pointing right, stock on the left'),
                ('ep_bg_satan', 'a purple-and-black hand crossbow whose limbs are bat-like demon wings, a loaded purple flaming bolt pointing right, stock on the left')],
    'e2a_mage': [('ep_sp_evil', 'a long spear with a silver spearhead on the right, gold bells and red tassels hanging below the head, a dark shaft'),
                 ('ep_sp_lava', 'a long spear with a molten lava-cracked red-orange spearhead on the right and a dark lava-veined shaft'),
                 ('ep_pl_grian', 'a long plain red-lacquered fighting staff with silver steel caps on both ends and a red cord wrapping'),
                 ('ep_pl_breaker', 'a long dark staff with silver blades on both ends and blue gems'),
                 ('ep_pl_phantom', 'a long spectral cyan translucent staff with a ghostly swirl and a small skull motif at the right end')],
    'e2b_mage': [('ep_rd_cheshire', 'a short purple wand topped on the right with a grinning purple cat head'),
                 ('ep_rd_meow', 'a short pink wand topped on the right with a big pink cat paw with little white wings'),
                 ('ep_st_willy', 'a long golden staff wrapped with scrolls and prayer beads, a glowing gold tip on the right'),
                 ('ep_st_sage', 'a long gold staff with a glowing blue orb held in gold prongs on the right end and small blue crystals'),
                 ('ep_st_moon', 'a long silver-blue staff topped on the right with a silver crescent moon and a glowing blue orb, icy crystals')],
    'e2c_mage': [('ep_br_scribble', 'a giant paintbrush broom with a rainbow-colored brush head on the right and a gold handle with gems'),
                 ('ep_br_lucky', 'a straw broom decorated with four-leaf clovers and a gold lucky charm, gold handle, the straw brush on the right end')],
}
for _n, _its in _E2.items(): WEAPON_SHEETS[_n] = [(k, k, d) for k, d in _its]
ICON_DIRS = [os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'final', 'icon'),
             '/Users/luzhipeng/projects/dawnbreak/.claude/worktrees/agent-af38854d2f08ec079/art/final/icon']   # 装备深化组的新图标还在它的分支里（只读）

# ---- 武器装扮（商城组 av_weapon_<skin>）：一件覆盖三职业 15 种武器类型，图 key = <skin>_<武器类型>；形状照该类型的图标，只换主题 ----
SPRING_W = 'red and gold Chinese New Year style, a gold dragon-head guard / ornament, gold dragon-scale patterns on the blade or body, and a red tassel hanging from it'
WEAPON_SKINS = {
    'spring': {
        'sword': [('shortsword', f'a short straight sword, {SPRING_W}'), ('katana', f'a slim curved katana, {SPRING_W}'), ('club', f'a mace with a round head, {SPRING_W}'),
                  ('greatsword', f'a massive broad heavy greatsword, {SPRING_W}'), ('lightsaber', 'a lightsaber with a red-and-gold dragon-head hilt, a glowing golden-red energy blade and a red tassel')],
        'gun': [('revolver', f'a revolver, {SPRING_W}; muzzle pointing right, grip hanging down at the left end'), ('autopistol', f'a semi-automatic pistol, {SPRING_W}; muzzle pointing right, grip hanging down at the left end'),
                ('rifle', f'a long rifle, {SPRING_W}; stock on the left, barrel pointing right'), ('handcannon', f'a stubby hand cannon whose muzzle is a gold dragon head, red body; grip hanging down at the left end'),
                ('bowgun', f'a hand crossbow, {SPRING_W}; stock on the left, a loaded bolt pointing right')],
        'mage': [('spear', f'a long spear with a gold dragon-shaped spearhead on the right and a red shaft, red tassel'), ('pole', f'a long red-lacquered fighting staff with gold dragon caps on both ends and a red tassel'),
                 ('rod', 'a short wand topped on the right with a small gold dragon coiled around a red pearl, red tassel'), ('staff', 'a long staff topped on the right with a gold dragon coiled around a big glowing red pearl, red tassel'),
                 ('broom', 'a broom with a red-lacquered handle with gold dragon patterns and a golden straw brush on the right end, red tassel')],
    },
    'summer': {   # 搞怪夏日风：天蓝 / 白 / 西瓜红
        'sword': [('shortsword', 'a short sword made of a sky-blue ice popsicle with a wooden popsicle stick as the handle'), ('katana', 'a curved blade made of a long watermelon slice (red flesh, black seeds, green rind edge) with a white handle'),
                  ('club', 'a mace made of a colorful inflatable beach ball on a white handle'), ('greatsword', 'a sky-blue-and-white surfboard used as a huge sword, with a handle at the left end'),
                  ('lightsaber', 'a lightsaber whose blade is a long glowing sky-blue freeze-pop ice tube, white hilt')],
        'gun': [('revolver', 'a transparent colorful toy water pistol shaped like a revolver, water inside; muzzle pointing right, grip hanging down at the left end'),
                ('autopistol', 'a transparent colorful toy water pistol, water inside; muzzle pointing right, grip hanging down at the left end'),
                ('rifle', 'a long transparent colorful super-soaker water gun with a water tank on top; stock on the left, nozzle pointing right'),
                ('handcannon', 'a big stubby transparent colorful water cannon with a wide nozzle; grip hanging down at the left end'),
                ('bowgun', 'a transparent colorful toy crossbow loaded with a water balloon; stock on the left pointing right')],
        'mage': [('spear', 'a long spear made of a closed beach umbrella with a sky-blue-and-white striped canopy as the head on the right'), ('pole', 'a long colorful pinwheel staff: a white stick with a big rainbow pinwheel on the right end'),
                 ('rod', 'a short wand topped on the right with a green coconut with a straw and a little umbrella stuck in it'), ('staff', 'a long staff topped on the right with a big ice cream cone with pink and blue scoops'),
                 ('broom', 'a broom made of a white stick with a big green palm-leaf brush on the right end')],
    },
}
for _sk, _per in WEAPON_SKINS.items():
    for _cls, _items in _per.items():
        WEAPON_SHEETS[f'k_{_sk}_{_cls}'] = [(f'{_sk}_{t}', f'w_{t}', d) for t, d in _items]

# ---- 武器重做（用户：巨剑更夸张、史诗各有各的样子、一眼认出武器类型）：粗大醒目的剪影，同类型的史诗放在同一张表里互相拉开差别 ----
#   x_<类型>_<职业>：史诗重画（覆盖前面表里的同名武器）+ 新增的官方史诗（epics3.js）；t_<类型>_<职业>：普通武器的稀有 / 神器 / 传说外观 <类型>_r2/r3/r4
BOLD = {   # 每种武器类型的剪影要求（写进每一行）
    'shortsword': 'a SHORT SWORD (clearly shorter and stubbier than a longsword) with a broad, distinctively shaped blade and a big ornate crossguard',
    'katana': 'a KATANA: a long, gently curved, single-edged blade that is clearly thick (not a thin line), a LARGE distinctive tsuba guard, a long two-handed hilt with cord wrapping',
    'club': 'a MACE / CLUB with a HUGE heavy head on the right end (the head is about as tall as one third of the whole length) and a sturdy handle',
    'greatsword': 'a GIGANTIC two-handed GREATSWORD: an extremely broad, thick, heavy slab of a blade (the blade is about one third as wide as it is long, far wider than a normal sword), '
                  'a massive crossguard wider than the blade, a long two-handed grip and a heavy pommel',
    'lightsaber': 'a LIGHTSABER: a chunky ornate metal hilt about one quarter of the total length on the left, and a THICK solid energy blade with a distinctive shape and color; '
                  'the energy blade is painted as a flat bright colored shape with a lighter core and a dark outline (NOT a thin line, NO glow around it)',
    'revolver': 'a chunky oversized REVOLVER with a big round cylinder, a thick barrel and a grip hanging down at the left end',
    'autopistol': 'a chunky oversized semi-automatic PISTOL with a thick slide, a distinctive body shape and a grip hanging down at the left end',
    'rifle': 'a long RIFLE with a distinctive chunky body, a stock on the left and a long thick barrel pointing right',
    'handcannon': 'a huge stubby HAND CANNON with a very wide distinctive muzzle, a fat barrel and a pistol grip hanging down at the left end',
    'bowgun': 'a HAND CROSSBOW in side view: big distinctive bow limbs at the right end, a loaded bolt pointing right and a pistol-grip stock on the left',
    'spear': 'a long SPEAR: a long shaft and a BIG, wide, distinctive spearhead on the right end',
    'pole': 'a long fighting STAFF (bo staff) with big distinctive ornamented caps on both ends',
    'rod': 'a short magic WAND with a BIG distinctive ornament on the right tip (the ornament is about as tall as one third of the wand length)',
    'staff': 'a long mage STAFF with a HUGE distinctive head ornament on the right end',
    'broom': 'a witch BROOM: a long handle on the left and a BIG bushy distinctive brush head on the right end',
}
BOLD_EPICS = {   # 类型 → [(key, 设计)]；key 不在 art/final/icon 里有图标的（新史诗）用类型图标当参考
    'greatsword': [
        ('ep_gs_apophis', 'THE SHOWPIECE, the biggest and most menacing sword of all: Apophis the cursed demon sword. A huge broad obsidian-black blade with a hooked, forked tip and big saw-tooth spikes along the back edge, '
                          'deep crimson vein lines running along the blade, a large crimson demon eye set where the blade meets the guard, a bat-wing shaped black-and-dark-gold crossguard, a long dark red grip and a clawed pommel'),
        ('ep_gs_evildragon', 'a jagged purple-black blade shaped like a dragon wing with bone spikes along both edges; the crossguard is a black dragon skull with one red gem eye'),
        ('ep_gs_conqueror', 'Wing of the Conqueror: a bronze-gold blade shaped like a giant folded feathered wing (feather-shaped serrations along the top edge), a crimson-and-gold eagle-head crossguard, a red wrapped grip'),
        ('ep_greatsword', 'Rage of the Mad Dragon: a blood-red blade with big jagged teeth along both edges, the crossguard is a roaring dark-gold dragon head with a red gem'),
        ('ep_gs_earth', 'a slab blade of mossy olive-green stone with carved yellow rune lines and chipped rocky edges, a bronze block-shaped hilt'),
        ('ep_gs_guardian', 'a broad silver-blue shield-like blade with a gold rim, a pair of large white angel wings forming the crossguard, a blue gem')],
    'katana': [
        ('ep_katana', 'Moonlight: a silver-white blade with a row of small crescent moons engraved along it, a big gold round tsuba shaped like a full moon, a navy wrapped hilt with a hanging crescent-moon charm'),
        ('ep_katana2', 'a dark crimson blade, a big gold CROSS-shaped guard with a red gem in the middle, a black-and-red hilt with a gold cross pommel'),
        ('ep_kt_slaughter', 'a blood-red blade with a black saw-toothed back edge, a black square tsuba with red rivets, a dark red hilt and a long red tassel'),
        ('ep_kt_andra', 'a pale ice-blue blade, a big white five-petal flower-shaped tsuba, a silver-and-white hilt with a light blue ribbon'),
        ('ep_kt_ninedragon', 'a deep jade-green blade with a gold dragon coiling along its back edge, a gold dragon-head tsuba, a jade-green wrapped hilt with a gold dragon-claw pommel'),
        ('ep_kt_meteor', 'Meteor Katana: a deep indigo night-sky blade sprinkled with small gold star specks and a bright orange-red cutting edge, a big gold five-pointed-star tsuba, an orange wrapped hilt with a comet-shaped gold pommel')],
    'lightsaber': [
        ('ep_lightsaber', 'a gold ornate hilt with red gems and a thick red-orange energy blade with a zigzag lightning-shaped edge'),
        ('ep_ls_sun', 'a gold sun-disc hilt with rays, and a very wide golden-orange energy blade shaped like a long flame (wavy edges, pointed tip)'),
        ('ep_ls_millennium', 'a white-and-gold hilt with a small halo ring, and a thick cream-white energy blade that widens toward a rounded tip like a long petal'),
        ('ep_ls_elegy', 'a black thorny hilt with a red rose, and a thick blood-red energy blade with a curved scythe-like hooked tip'),
        ('ep_ls_breaker', 'Focused Light Sword: a chunky silver-and-violet mechanical hilt with a lens-like crystal emitter, and a thick violet-blue energy blade made of three parallel prongs converging into one sharp point')],
    'shortsword': [
        ('ep_shortsword', 'Eleanor the Shadowless: a wide translucent ice-blue crystal blade shaped like a long diamond, a big gold winged crossguard with a round blue gem'),
        ('ep_ss_kanya', 'a zigzag lightning-bolt shaped electric-yellow blade with dark blue edges, a dark blue-and-gold guard with a blue gem'),
        ('ep_ss_fate', 'a pale gold blade with dark crack lines like a shattered blade held together by gold bands, a gold cross guard with a big white round gem, a brown grip'),
        ('ep_ss_shura', 'a wide black blade with a jagged crimson edge and a purple demon eye engraved on it, a black-and-silver spiked guard with a purple gem'),
        ('ep_ss_gsd', 'Ultimate Wave Blade: a broad wavy blade (rippling S-wave edges like a kris) in deep teal-blue with bright cyan wave engravings, a round gold guard shaped like concentric ripples, a white wrapped grip')],
    'club': [
        ('ep_club', 'Hell Evil Eye: a dark purple spiked round head holding a big orange demon eye, a black-and-gold handle'),
        ('ep_cb_devour', 'a head shaped like a fanged purple demon mouth biting down, a black-and-gold handle'),
        ('ep_cb_soulmate', 'a big block-shaped white-and-gold war hammer head with a small cute yellow thunder sprite sitting on top, a gold handle'),
        ('ep_cb_kirin', 'a head sculpted as a large blue-and-gold qilin (kirin) head with antlers and a flowing mane, a gold handle'),
        ('ep_cb_heart', 'a black spiked club head with a big bright red heart-shaped crystal in the middle, a black-and-red handle'),
        ('ep_cb_ghost', 'Oni Soul-Devourer: a head shaped like a big bone-white oni demon skull with two horns and red eyes, a dark iron handle wrapped with red cord')],
    'revolver': [
        ('ep_revolver', 'Desert Eagle Dusk: a big golden revolver with engraved patterns, a long hexagonal barrel and a red gem on the dark red grip'),
        ('ep_rv_sunset', 'an orange-and-gold revolver with a sunset-gradient barrel, a knight-helmet emblem, a brown wooden grip with a star'),
        ('ep_rv_bone', 'a white bone revolver with rib-like ridges along the barrel, icy blue crystals and a skull-shaped grip end'),
        ('ep_rv_python', 'a heavy gold revolver with a gold python coiled around the long barrel, the snake head at the muzzle, green gems'),
        ('ep_rv_enazma', 'Twin-Blade Revolver: a dark steel revolver with two curved silver blades mounted above and below the barrel (a gunblade), purple trim, a black grip')],
    'autopistol': [
        ('ep_autopistol', 'Firefly Light: a sleek silver-and-gold pistol with a row of small firefly-shaped warm yellow lights along the slide'),
        ('ep_ap_viper', 'a black-and-dark-green pistol with a snake-scale pattern and an open-mouthed viper head at the muzzle'),
        ('ep_ap_heckler', 'a red-and-orange pistol with flame-shaped fins and gold trim and a wide flared muzzle'),
        ('ep_ap_flash', 'God of Guns - Flash: a futuristic white-and-sky-blue pistol with angular wing-like fins, blue light strips along a long slide and a gold emblem')],
    'rifle': [
        ('ep_rifle', 'Piercing Eye: a long ornate sniper rifle with a big gold scope shaped like an eye, dark wood and gold trim'),
        ('ep_rf_death', 'a long black sniper rifle with a big scope, a white skull emblem on the stock and a black spiked muzzle brake'),
        ('ep_rf_zombie', 'a long icy-blue rifle covered with frost crystal spikes, a silver body'),
        ('ep_rf_howl', 'a heavy bronze-and-teal rifle with a big round drum magazine and a fat gold barrel ending in a howling wolf-head muzzle')],
    'handcannon': [
        ('ep_handcannon', 'Sun Devourer: a black-and-gold hand cannon engraved with flame patterns, the muzzle shaped as a gaping beast mouth around a gold sun emblem'),
        ('ep_hc_breaker', 'a stubby orange-and-gold hand cannon with a big striped drill-shaped muzzle'),
        ('ep_hc_aqua', 'a blue-and-gold hand cannon shaped like a big water vase (amphora) lying sideways, the vase mouth is the muzzle'),
        ('ep_hc_wing', 'a white-and-gold hand cannon with two large white angel wings on its sides'),
        ('ep_hc_meteor', 'Twin Meteor Bomb: a huge dark-red hand cannon with TWO fat stacked barrels, each muzzle rimmed with orange meteor rock, and a round bomb-shaped drum')],
    'bowgun': [
        ('ep_bowgun', 'Silver Moon Wing: a white-and-gold crossbow whose bow limbs are large white feathered angel wings, a blue gem, a loaded silver bolt'),
        ('ep_bg_red', 'a red-and-gold crossbow with big gold dragon-shaped limbs and a red dragon head at the front'),
        ('ep_bg_satan', 'a purple-and-black crossbow whose limbs are big bat-like demon wings, a loaded purple bolt'),
        ('ep_bg_lotus', 'Lotus of Ice and Fire: a crossbow whose bow limbs form a big lotus flower, the upper petals icy blue and the lower petals fire red, a white-and-gold stock'),
        ('ep_bg_headless', 'Headless Soul: a dark iron gothic crossbow with a carved jack-o-lantern pumpkin at the front and black tattered-cape shaped limbs with orange trim')],
    'spear': [
        ('ep_spear', 'Dragonkin Spear: a big red-gold dragon-head spearhead and a dark red shaft with gold dragon-scale bands'),
        ('ep_sp_evil', 'a big wide silver leaf-shaped spearhead, a cluster of gold bells and red tassels hanging below the head, a dark shaft'),
        ('ep_sp_lava', 'a big black-and-orange spearhead shaped like a cracked volcanic lava shard, a dark shaft with orange lava veins'),
        ('ep_sp_icedragon', 'Ice Dragon Spear: a white-silver shaft, a big crescent-shaped ice-blue blade like a dragon fin at the head and an ice dragon head at the socket')],
    'pole': [
        ('ep_pole', 'Sky Dome Pole: a white-gold staff with big cloud-shaped ornaments on both ends'),
        ('ep_pl_grian', 'a thick red-lacquered fighting staff with big silver steel caps on both ends and red cord wrapping'),
        ('ep_pl_breaker', 'a dark staff with big curved silver blades on both ends and blue gems'),
        ('ep_pl_phantom', 'a spectral cyan translucent staff with a ghostly swirl pattern and a big skull ornament at the right end'),
        ('ep_pl_magical', 'Magical Girl Staff of Shining Love: a pastel pink-and-white staff with a big gold heart-shaped ornament with small white angel wings and a pink gem at the right end, ribbons')],
    'rod': [
        ('ep_rod', 'Sage Astra: a short golden wand with a BIG gold star with small leaves and a red gem on the tip'),
        ('ep_rd_cheshire', 'a short purple wand topped with a big grinning purple-striped cat head'),
        ('ep_rd_meow', 'a short pastel pink wand topped with a big pink cat paw with little white wings'),
        ('ep_rd_thunder', 'Codex of Thunder: a short wand topped with a big open blue-and-gold spellbook with a yellow lightning-bolt emblem on its cover')],
    'staff': [
        ('ep_staff', 'Starry Sea Staff: a navy staff with gold rings and a big dark-blue galaxy orb with stars circled by a gold ring at the right end'),
        ('ep_st_willy', 'a golden staff wrapped with scrolls and prayer beads, a big gold prayer-wheel shaped head'),
        ('ep_st_sage', 'a gold staff with a big blue orb held in large gold prongs and a white tassel'),
        ('ep_st_moon', 'a silver-blue staff topped with a big silver crescent moon cradling a blue orb'),
        ('ep_st_witchgold', 'Witch\'s Golden Staff: a twisted golden staff topped with a big gold witch-hat shaped ornament and a hanging amber gem')],
    'broom': [
        ('ep_broom', 'Night Witch Broom: a dark purple broom with a curved handle ending in a gold crescent-moon charm, and a big purple feather-like brush'),
        ('ep_br_scribble', 'a giant paintbrush broom with a big rainbow-colored brush head and a gold handle with gems'),
        ('ep_br_lucky', 'a straw broom decorated with big four-leaf clovers and a gold horseshoe lucky charm, a gold handle'),
        ('ep_br_hunter', 'Hunter\'s Ghost-Mask Broom: a dark wood broom with a big white oni ghost mask fixed at the base of a black-and-red bristle brush')],
}
TIER_DESC = {   # 普通武器的品级外观：同一种武器一张表，剪影一级比一级大、一级比一级华丽（主线程审图：不能只换颜色）
    2: 'RARE grade (row 1): the basic shape with ONE added feature only: an extra decorative trim band and a small purple amethyst gem; polished steel / dark hardwood with purple accents; about the same size as the basic weapon',
    3: 'ARTIFACT grade (row 2): a clearly BIGGER guard / head / body than row 1, with side ornaments sticking out on both sides (fins, curls or small spikes); engraved silver with rose-pink enamel and a large pink crystal',
    4: 'LEGENDARY grade (row 3): the LARGEST and longest of the three, with a pair of golden wings or a halo-like crest on the guard / head / body; gold and bright orange with a big amber gem and flowing gold filigree',
}
WCLS = {t: c for c, ts in {'sword': ['shortsword', 'katana', 'club', 'greatsword', 'lightsaber'], 'gun': ['revolver', 'autopistol', 'rifle', 'handcannon', 'bowgun'],
                           'mage': ['spear', 'pole', 'rod', 'staff', 'broom']}.items() for t in ts}
ICON_ROOT = ICON_DIRS[0]
for _t, _its in BOLD_EPICS.items():
    _per = 3 if _t in ('greatsword', 'club') else 6   # 巨剑很宽、钝器头很大（6 把一张时上下粘在一起切不开）：一张表 3 把
    for _i in range(0, len(_its), _per):
        WEAPON_SHEETS[f'x_{_t}{_i // _per or ""}_{WCLS[_t]}'] = [(k, k if os.path.exists(os.path.join(ICON_ROOT, f'item_{k}.webp')) else f'w_{_t}', f'{BOLD[_t]}. Design: {d}') for k, d in _its[_i:_i + _per]]
# 魔剑-阿波菲斯（镇馆之宝）单独一张表重画：剪影要和别的巨剑（尤其邪龙魔剑）完全不同；切图时覆盖 x_greatsword 表里那把
WEAPON_SHEETS['x_apophis_sword'] = [('ep_gs_apophis', 'w_greatsword', f"{BOLD['greatsword']}. Design: Apophis the cursed demon sword, THE SHOWPIECE, its silhouette must be unlike any other sword: "
    'a colossal broad blade of black and deep crimson whose outer half curves up into a huge hooked crescent-moon shaped tip (like a giant sickle hook at the end); '
    'in the CENTER of the blade a large open demonic eye (red iris, slit pupil) framed by a jaw of white fangs; bright red rune lines painted along the blade; '
    'a dark gold crossguard shaped like curled demon horns; a long crimson-wrapped two-handed grip and a clawed pommel. Mostly smooth blade edges (no rows of spikes), so it never looks like a spiky dragon blade')]
for _t in BOLD:
    WEAPON_SHEETS[f't_{_t}_{WCLS[_t]}'] = [(f'{_t}_r{r}', f'w_{_t}', f'{BOLD[_t]}. {TIER_DESC[r]}') for r in (2, 3, 4)]
# 装备 2.0（docs/GEAR_PLAN_60.md）：B1a / B1b / B1c 的武器设计写在 art/tools/wdesign_{sword,gun,mage}.py 的 DESIGNS = { 类型: [(key, 设计), ...] }，
# 追加进 BOLD_EPICS（weapon_gen.py 按它出 v2 单张图），各自单独一组表名（x60_<类型>），不打乱上面老表的分组（老表切图按位置对应）
import importlib.util as _iu
for _c in ('sword', 'gun', 'mage'):
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'wdesign_{_c}.py')
    if not os.path.exists(_p): continue
    _s = _iu.spec_from_file_location(f'wdesign_{_c}', _p); _m = _iu.module_from_spec(_s); _s.loader.exec_module(_m)
    for _t, _its in getattr(_m, 'DESIGNS', {}).items():
        BOLD_EPICS.setdefault(_t, []).extend(_its)
        for _i in range(0, len(_its), 6):
            WEAPON_SHEETS[f'x60_{_t}{_i // 6 or ""}_{WCLS[_t]}'] = [(k, f'w_{_t}', f'{BOLD[_t]}. Design: {d}') for k, d in _its[_i:_i + 6]]

def bold_prompt(name, items):
    tier = name.startswith('t_')
    def like(i, ik):
        if tier: return f'the same kind of weapon and basic shape as icon {i} of the second image, restyled as described'
        if ik.startswith('w_'): return f'a brand-new design; only the weapon type follows icon {i} of the second image'
        return f'keep the theme, colors and motifs of icon {i} of the second image, but make the silhouette much bolder and bigger'
    rows = '; '.join(f'row {i + 1}: {d} ({like(i + 1, ik)})' for i, (_, ik, d) in enumerate(items))
    return ('2D game weapon sprite sheet for a cute chibi action RPG in the style of Dungeon Fighter Online. Draw exactly ' + str(len(items)) + ' weapons stacked in one column, one weapon per row, '
            'each weapon lying perfectly HORIZONTAL in strict side view (flat profile, not diagonal, not in perspective), with the handle / grip / stock at the LEFT and the blade tip / muzzle / head pointing to the RIGHT. '
            'These weapons are shown very small in the game, so every weapon needs a BOLD, CHUNKY, OVERSIZED, instantly recognizable silhouette: big simple shapes, strong color blocks, no thin fiddly details'
            + ('. The three rows are the same weapon at three rarity grades (one family), but their SILHOUETTES must differ clearly, not only their colors: row 1 is the basic shape plus a trim and a small gem, '
               'row 2 has a clearly bigger head / guard with side ornaments, row 3 is the largest and longest with wings or a halo-like crest' if tier else ', and every row must look clearly different from the others') + '. '
            f'{rows}. '
            'Match the art style of the chibi character in the first image exactly: bold dark outlines, clean cel shading, bright saturated colors, the same line thickness. '
            'Each weapon is centered in its row, uses most of the image width, with wide white gaps between rows; no hands, no characters, no text, no labels, no shadows. '
            'No effects at all: no glow halo, no sparks, no flames, no lightning, no smoke, no particles, no motion lines around the weapons (effects are added by the game). '
            'Do not use pure neon green or pure magenta anywhere. Plain pure white background.')

def weapon_ref(name, items):
    """把对应的物品图标拼成一张参考条（设计照图标来）"""
    from PIL import Image
    out = os.path.join(OUT, 'weapons', f'ref_{name}.png')
    M = Image.new('RGB', (256 * len(items), 256), (255, 255, 255))
    for i, (_, ik, _) in enumerate(items):
        ip = next(p for p in (os.path.join(d, f'item_{ik}.webp') for d in ICON_DIRS) if os.path.exists(p))
        im = Image.open(ip).convert('RGBA').resize((256, 256), Image.LANCZOS); M.paste(im, (i * 256, 0), im)
    os.makedirs(os.path.dirname(out), exist_ok=True); M.save(out); return out

def weapon_prompt(items, skin=False):
    like = 'the same kind of weapon and overall silhouette as icon {n} of the second image, but restyled as described' if skin else 'design like icon {n} of the second image'
    rows = '; '.join(f'row {i + 1}: {d} (' + like.format(n=i + 1) + ')' for i, (_, _, d) in enumerate(items))
    return ('2D game weapon sprite sheet for a cute chibi action RPG. Draw exactly ' + str(len(items)) + ' weapons stacked in one column, one weapon per row, '
            'each weapon lying perfectly HORIZONTAL in strict side view (flat profile, not diagonal, not in perspective), with the handle / grip / stock at the LEFT and the blade tip / muzzle / head pointing to the RIGHT. '
            f'{rows}. '
            'Match the art style of the chibi character in the first image exactly: bold dark outlines, clean cel shading, bright saturated colors, the same line thickness. '
            'Each weapon is centered in its row with wide white gaps between rows; no hands, no characters, no text, no labels, no shadows, no glow halo around the weapons. Plain pure white background.')

# ---- 时装套装：先做一张“穿这套时装”的参考立绘，再把占位动作表整张换装（姿势、占位棍都不变） ----
WHO = {'sword': 'boy swordsman (same face, same spiky silver hair, red eyes)', 'gun': 'girl gunner (same face, same long brown ponytail, blue eyes)',
       'mage': 'girl mage (same face, same long lavender hair, golden eyes)'}
SETS = {
    'sky1': {   # 天空套一「天穹圣翼」：白 / 金 / 天蓝，天使与骑士；背后一对白色小羽翼（画进帧里）
        'sword': 'a white knight long coat with gold trim and gilded shoulder armor, a sky-blue lining, and a pair of small white angel wings on the back; white long trousers with gold knee guards; '
                 'white-and-gold long boots; a wide gold belt with a blue sapphire in the middle; a gold cross brooch on the chest. The red scarf is removed.',
        'gun': 'a short white military-style jacket with gold trim and a pair of small white angel wings on the back; a fluffy sky-blue puffy mini skirt; white over-knee long boots with gold buckles; a thin gold belt; '
               'a gold cross brooch on the chest. The blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a white angel robe with wide sleeves and gold embroidery, a pair of small white angel wings on the back; a sky-blue skirt with a feather-trimmed hem; white short boots with gold trim; a gold waist chain; '
                'a gold cross brooch on the chest. The witch hat and the cape are removed (hair uncovered).',
    },
    'summer': {   # 夏日「晴空海滩」：天蓝 / 白 / 椰绿，点缀扶桑花粉
        'sword': 'an open blue-and-white Hawaiian short-sleeve shirt with a hibiscus flower pattern over a white tank top; sky-blue knee-length beach shorts printed with palm trees; brown sandals; '
                 'a woven straw belt with small seashells; a seashell necklace on the chest. The red scarf and the long coat are removed.',
        'gun': 'a white sailor-style crop top with a blue sailor collar scarf, showing the belly; light-blue denim shorts; white lace-up sandals; a colorful braided belt; a seashell necklace on the chest. '
               'The brown jacket, the blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a white sundress with thin straps and a sky-blue ruffled hem, with a sheer see-through light cardigan over it; white sandals; a woven straw belt with a pink hibiscus flower pinned on it; '
                'a seashell necklace on the chest. The witch hat and the cape are removed (hair uncovered).',
    },
    'sky2': {   # 天空套二「炎龙之魂」：黑 / 暗红 / 金，炎龙；背后一对黑红小龙翼（画进帧里）
        'sword': 'a black long coat with a dragon-scale pattern, a red lining and gold dragon embroidery, a dragon-head pauldron on one shoulder, and a pair of small black-and-red dragon wings on the back; '
                 'wide black trousers with red leg guards; black-and-gold battle boots; a red waist sash with a gold dragon-head buckle; a dragon-claw necklace holding a red gem on the chest. The red scarf is removed.',
        'gun': 'a short black leather jacket with red flame patterns and gold dragon patterns worn over a modest black high-neck top that covers the chest and belly, a pair of small black-and-red dragon wings on the back; a black-and-red mini skirt; black long boots with red laces; '
               'a red belt with a gold dragon-head buckle; a dragon-claw necklace on the chest. The blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a black-and-red high-collared long robe with a dark gold dragon-scale pattern, the skirt hem shaped like flames, a pair of small black-and-red dragon wings on the back; black short boots; '
                'a gold dragon-head waist buckle; a dragon-claw necklace on the chest. The witch hat and the cape are removed (hair uncovered).',
    },
    'academy': {   # 学院「星辉学院」：藏青 / 白 / 红，校徽、格纹、领结
        'sword': 'a navy blue school blazer with gold buttons and a school crest on the chest over a white shirt; grey plaid long trousers; brown leather shoes; a black leather belt; a red necktie. The red scarf is removed.',
        'gun': 'a short navy blue school jacket over a white shirt; a red-and-black plaid pleated mini skirt; black over-knee socks with brown loafers; a thin leather belt; a red bow tie at the collar. '
               'The blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a navy blue school cape over a white shirt; a long plaid pleated skirt; black stockings with Mary-Jane shoes; a thin leather belt; a red bow tie at the collar. The witch hat and the old cape are removed (hair uncovered).',
    },
    'spring': {   # 春节「锦鲤贺岁」：中国红 + 金，祥云、盘扣、福字纹、锦鲤、白色毛绒滚边、中国结（商城组设计）
        'sword': 'a red Chinese Tang-style short jacket with a mandarin stand-up collar, gold frog-knot buttons, auspicious cloud trim along the edges, a koi fish embroidered on the hem and a ring of white fluffy fur around the collar; '
                 'loose black lantern trousers with gold leg wraps at the shins; red embroidered cloth shoes; a wide gold waist sash with a red Chinese knot tassel hanging at the side; a gold longevity-lock pendant necklace on the chest. The red scarf is removed.',
        'gun': 'a short red qipao-style top with a mandarin stand-up collar, gold frog-knot buttons, a koi fish embroidery and white fluffy fur cuffs; a red-and-gold pleated mini skirt; white over-knee socks with red round-toe embroidered shoes; '
               'a red satin ribbon belt tied into a Chinese knot; a gold longevity-lock pendant necklace on the chest. The blue neckerchief and the brown cap are removed (hair uncovered).',
        'mage': 'a red Chinese ruqun-style long robe with wide sleeves, gold peony and auspicious cloud patterns and a white fluffy fur collar; the skirt reaches the ankles with a red-to-gold gradient; red embroidered shoes; '
                'a gold belt with a hanging jade pendant tassel; a gold longevity-lock pendant necklace on the chest. The witch hat and the cape are removed (hair uncovered).',
    },
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
            f'but change the clothes to this outfit: {outfit} The hands are empty (no weapon). No hat, no glasses, no hair ornament. Plain pure white background.')

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

def unify_prompt(cls, outfit, has_stick=True):
    """时装表“统一细节”：拿已经生成好的时装表再改一遍，让 9 个人的衣服完全一样（同一片段逐帧闪烁的问题）"""
    stick = ('Keep the flat pure green (#00FF00) sticks exactly as they are (same position, angle and length, flat pure green, no outline). ' if has_stick else '')
    return ('The FIRST image is a 2D game sprite animation sheet (3x3 grid, 9 frames) of one chibi character in an outfit. The SECOND image is the reference of that outfit. '
            'In the first image the outfit details differ slightly from frame to frame, which makes the animation flicker. Redraw the FIRST image so that the outfit is IDENTICAL in all 9 frames: '
            'exactly the same patterns and prints in exactly the same places on the garment, the same trims, the same number and position of buttons and ornaments, '
            'the same colors and the same shading brightness, exactly like frame 1 and the second image. '
            f'Outfit: {outfit} '
            'Do NOT change anything else: keep the same 3x3 layout, the same poses, the same positions and sizes of every frame, the same face, hair and art style. '
            f'{stick}No hat, no glasses, no hair ornament. Plain pure white background, no text.')

def jobs_unify(only):
    """--only 'spring/sword_walk,summer/gun_run'：输出 art/src/avatar/unify/<套装>/<表>.png（不覆盖原来的时装表，人工比较后再换）"""
    L = []
    for sid, per in SETS.items():
        for name in source_sheets():
            cls = name.split('_')[0]
            if cls not in per or not any(f'{sid}/{name}' == o or (o.endswith('*') and f'{sid}/{name}'.startswith(o[:-1])) for o in only.split(',')): continue
            src = os.path.join(OUT, 'sets', sid, f'{name}.png'); ref = os.path.join(OUT, 'refs', f'{cls}@{sid}.png')
            if not os.path.exists(src): continue
            L.append({'out': os.path.join(OUT, 'unify', sid, f'{name}.png'), 'refs': [src, ref], 'prompt': unify_prompt(cls, per[cls], name not in NO_WPN)})
    return L

# 没有占位棍的表里，时装版必须原样保留的道具（重火器画在帧里；装甲罩在衣服外面，时装版只换头和头发）
PLAIN_KEEP = {
    'gun_launcher2': ('Keep EVERY weapon exactly the same shape, size, angle and colors as in the first image: the olive-green tube grenade launcher (frame 2), '
                      'the gun-metal plasma emitter with glowing purple coils (frame 3), the black compressed-air cannon with a blue tank (frames 4 and 5), '
                      'the two black machine guns (frame 8) and the gold laser cannon (frame 9). Frames 6 and 7 show her inside a bulky red-and-gold powered armor suit: '
                      'keep that armor EXACTLY as it is (same shape, same red and gold colors, no outfit colors on it); in those two frames only the head and hair change (no cap). '),
}
def set_prompt_plain(cls, outfit, name=''):
    """没有占位棍的表（枪炮师的重武器等技能道具）：只换衣服"""
    return ('The FIRST image is a 2D game sprite animation sheet (3x3 grid, 9 frames) of a chibi character. The SECOND image shows the same character in a new outfit. '
            'Redraw the FIRST image exactly: the same 3x3 layout, the same poses, the same positions and sizes of every frame, the same props, weapons and effects, '
            f'but dress the character in EVERY frame in the outfit of the second image: {outfit} '
            f'{PLAIN_KEEP.get(name, "")}'
            'Keep the face, the hair and the art style. No hat, no glasses, no hair ornament. Plain pure white background, no text.')

def jobs_set(only):
    """每张动作表都要有时装版（缺帧会在两套衣服之间闪）：有占位表用占位表，没有（技能道具表）用原表"""
    L = []
    sd = os.path.join(OUT, 'sheets')
    for sid, per in SETS.items():
        for name, src in source_sheets().items():
            cls = name.split('_')[0]
            if cls not in per or not any(f'{sid}/{name}'.startswith(o) for o in only.split(',')): continue   # --only 可以逗号分隔多个前缀
            ref = os.path.join(OUT, 'refs', f'{cls}@{sid}.png')
            if not os.path.exists(ref): print('缺时装参考图，先跑 ref：', ref); continue
            ph = os.path.join(sd, f'{name}.png')
            if os.path.exists(ph): L.append({'out': os.path.join(OUT, 'sets', sid, f'{name}.png'), 'refs': [ph, ref], 'prompt': set_prompt(cls, per[cls])})
            elif name in NO_WPN: L.append({'out': os.path.join(OUT, 'sets', sid, f'{name}.png'), 'refs': [src, ref], 'prompt': set_prompt_plain(cls, per[cls], name)})
            else: print('缺占位表，先跑 wpn：', ph)
    return L

# ---- 头部配件：侧面（朝右）画，一张表一行 3 个：帽子、发饰、眼镜 ----
ACC = {
    'sky1': [('hat', 'a floating golden angel halo ring with a small golden wing on each side, seen from the side and slightly above, tilted, glowing softly'),
             ('hair', 'a pair of white feathers hair ornament, seen from the side, worn on the side of the head')],
    'summer': [('hat', 'a wide-brimmed woven straw sun hat with a blue ribbon band, seen in strict side view facing right'),
               ('hair', 'a big pink hibiscus flower hair clip, seen from the side'),
               ('face', 'a pair of pink heart-shaped sunglasses seen in strict side view (profile) for a character facing right: one heart-shaped pink lens in front and one thin temple arm going back to the left')],
    'sky2': [('hat', 'a pair of curved black-and-red dragon horns (both horns together as one piece, as worn on top of a head), seen in side view facing right'),
             ('hair', 'a small red flame-shaped hair ornament like a little fire, seen from the side')],
    'academy': [('hat', 'a navy blue beret with a small gold school crest badge, seen in strict side view facing right, tilted'),
                ('hair', 'a big red plaid ribbon bow hair ornament, seen from the side'),
                ('face', 'a pair of black square-framed glasses seen in strict side view (profile) for a character facing right: one square lens in front and one thin temple arm going back to the left')],
    'spring': [('hat', 'a small cute Chinese lion-dance head hat: a red lion head with gold eyebrows, big round eyes and fluffy fur edges, seen in strict side view facing right, worn on top of a head'),
               ('hair', 'a red fluffy pompom hair ornament with a gold tassel hairpin stuck beside it, seen from the side, worn on the side of the head'),
               ('face', 'a pair of round sunglasses with thin gold frames and red lenses, seen in strict side view (profile) for a character facing right: one round lens in front and one thin temple arm going back to the left')],
    'festival': [('hat', 'a small red top hat with a white band, a gold star-shaped emblem with a ruby and two white feathers on the side, seen in strict side view facing right, tilted slightly'),
                 ('hair', 'a red satin ribbon bow with gold trim and a small gold star in the knot, seen from the side, as a hair ornament worn at the back of the head'),
                 ('face', 'a pair of round red-and-gold glasses seen in strict side view (profile) for a character facing right: one round lens rim in front and one thin temple arm going back to the left, with small gold flower rivets')],
}

ACC_ICONS = {'festival': os.path.join(SRC, 'items', 'sheet_avatar.png')}

def jobs_acc(only):
    L = []
    for sid, items in ACC.items():
        if not sid.startswith(only): continue
        rows = '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(items))
        icons = ACC_ICONS.get(sid)   # 有物品图标表就一起参考（庆典时装）
        L.append({'out': os.path.join(OUT, 'acc', f'{sid}.png'), 'refs': [os.path.join(OUT, 'refs', f'sword@{sid}.png')] + ([icons] if icons else []),
                  'size': '2048x1152',
                  'prompt': ('2D game costume accessory sprites for a cute chibi action RPG, matching the art style of the character in the first image (bold dark outlines, clean cel shading, bright colors)'
                             f'{" and the designs of the matching icons in the second image" if icons else ""}. Draw exactly {len(items)} separate accessories in one row from left to right, each isolated with wide white gaps: {rows}. '
                             'No character, no head, no hands, no text, no shadows. Plain pure white background.')})
    return L

def jobs_weapons(only):
    L = []
    for name, items in WEAPON_SHEETS.items():
        if not any(name.startswith(p) for p in only.split(',')): continue   # --only 可以写多个前缀，逗号隔开
        cls = {'sword': 'sword', 'gun': 'gun', 'mage': 'mage', 'heavy': 'sword'}[name.split('_')[-1]]
        L.append({'out': os.path.join(OUT, 'weapons', f'{name}.png'), 'refs': [os.path.join(SRC, f'{cls}_ref.png'), weapon_ref(name, items)],
                  'prompt': bold_prompt(name, items) if name[:2] in ('x_', 't_') else weapon_prompt(items, name.startswith('k_')), 'size': '2048x2048' if len(items) > 1 else '2048x1024'})
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
    ap.add_argument('--keep', action='store_true')   # touch：换姿势，不按身体高度缩放
    a = ap.parse_args()
    base, key, _ = gi.load_cfg()
    if a.cmd == 'recell':   # avatar_gen.py recell --only summer/mage_react2 --cells 8
        sid, name = a.only.split('/'); return recell(sid, name, [int(x) for x in a.cells.split(',')], base, key)
    if a.cmd == 'touch':   # avatar_gen.py touch --sheet art/src/avatar/sheets/sword_walk.png --cells 0,3,7 [--prompt ring|文字]
        p = RING if a.prompt in ('', 'ring') else CELL.get(a.prompt, a.prompt)
        return touch(a.sheet, [int(x) for x in a.cells.split(',')], p, base, key, a.src or None, a.keep)
    if a.cmd == 'wpn': L = jobs_wpn(a.only, a.tag)
    elif a.cmd == 'weapons': L = jobs_weapons(a.only)
    elif a.cmd == 'ref': L = jobs_ref(a.only)
    elif a.cmd == 'set': L = jobs_set(a.only)
    elif a.cmd == 'acc': L = jobs_acc(a.only)
    elif a.cmd == 'unify': L = jobs_unify(a.only)
    else: sys.exit('未知命令 ' + a.cmd)
    print(f'{len(L)} jobs', flush=True)
    with ThreadPoolExecutor(min(2, a.j)) as ex:
        for f in as_completed([ex.submit(run, j, base, key, a.force) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
