#!/usr/bin/env python3
"""装备深化的物品图标：生成 3×2 的图标表（gpt-image，参考现有史诗图标的画风）→ 按格子切成单个图标 → art/final/icon/item_<key>.webp（128×128）

用法：
  python3 art/tools/gear_icons.py list                 列出所有图标表
  python3 art/tools/gear_icons.py gen  <表名...>        生成图标表原图（写到主仓库 art/src/gear/<表名>.png，已存在就跳过；--force 重生成）
  python3 art/tools/gear_icons.py cut  <表名...|all>    切图（从主仓库 art/src/gear/ 读原图）
生图配额：同时最多 2 个请求（开两个进程各跑一半），遇到 429 退避 60 秒以上。
"""
import os, sys, subprocess, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from prep import flood_bg, components

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))                 # worktree 的 art/
SRC = '/Users/luzhipeng/projects/dawnbreak/art/src/gear'                            # 原图放主仓库（不进 git）
REF = '/Users/luzhipeng/projects/dawnbreak/art/src/items/sheet_epic_c.png'          # 画风参考：现有的史诗图标表
GPT = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
STYLE = ('Same art style as the reference image: cute chibi (Q-version) fantasy mobile-game item icons, chunky proportions, thick dark outlines, '
         'glossy cel shading, rich saturated colors, each item surrounded by a soft golden legendary glow. ')
LAYOUT = ('A 3 columns x 2 rows grid of six separate item icons, each item isolated and centered in its own cell with generous empty space between items, '
          'items drawn diagonally where they are long (weapons from bottom-left to top-right), plain pure white background, no text, no labels, no frames, no grid lines. ')

# 表名 → 6 个 (物品 key, 画面描述)；顺序 = 从左到右、从上到下
SHEETS = {
  'ep_sword_a': [
    ('ep_ss_kanya', 'a short sword with a thin silver blade crackling with blue-white lightning, storm-cloud engraved guard'),
    ('ep_ss_fate', 'a short sword whose blade is cracked like shattered glass with golden light leaking out, clock-hand shaped crossguard'),
    ('ep_ss_shura', 'a dark crimson short sword with purple demonic runes and a shadowy wave aura, bone-white hilt'),
    ('ep_kt_slaughter', 'a long katana with a blood-red blade edge and dark grip wrapped in red cloth, dripping red glow'),
    ('ep_kt_andra', 'an elegant katana with a pale icy blue blade and ornate silver tsuba shaped like a blooming flower'),
    ('ep_kt_ninedragon', 'a golden katana with nine tiny dragon heads coiled around the guard, jade-green blade glow'),
  ],
  'ep_sword_b': [
    ('ep_cb_devour', 'a heavy spiked mace with a glowing purple evil eye in the head, soul wisps swirling around it'),
    ('ep_cb_soulmate', 'a hammer club made of white stone with a small cute lightning spirit sitting on top, yellow sparks'),
    ('ep_cb_kirin', 'a war hammer shaped like a qilin (kirin) head roaring, electric blue mane, golden horns'),
    ('ep_cb_heart', 'a brutal black club with a red crystal heart embedded that is cracking, dark red aura'),
    ('ep_gs_earth', 'a huge stone greatsword looking like a slab of earth with moss and brown runes, amber glow'),
    ('ep_gs_evildragon', 'a giant dark purple greatsword with a dragon skull hilt and a beating red heart gem'),
  ],
  'ep_sword_c': [
    ('ep_gs_guardian', 'a massive silver-blue greatsword shaped like a guardian shield-blade, white wings on the guard'),
    ('ep_ls_sun', 'a lightsaber with a blazing golden-orange sun blade and a round sun emblem on the hilt'),
    ('ep_ls_millennium', 'a lightsaber with a pure white glowing blade and an ancient gold-and-ivory hilt with star gems'),
    ('ep_ls_elegy', 'a lightsaber with a crimson blood-red glowing blade and a black rose hilt'),
    ('ep_rv_sunset', 'a revolver pistol with warm sunset orange barrel, brass fittings, a small horse emblem'),
    ('ep_rv_bone', 'a revolver made of white bone with icy blue frost crystals on the barrel'),
  ],
  'ep_gun_a': [
    ('ep_rv_python', 'a golden python-snake revolver with a coiled snake along the barrel, emerald eyes'),
    ('ep_ap_viper', 'a sleek black automatic pistol with green viper snake pattern and fangs on the muzzle'),
    ('ep_ap_heckler', 'an automatic pistol glowing red-hot with flames around the barrel, orange heat vents'),
    ('ep_rf_death', 'a long black sniper rifle with a skull emblem and a red scope lens'),
    ('ep_rf_zombie', 'a rifle covered with ice crystals, pale cyan barrel, a small zombie-hunter cross emblem'),
    ('ep_hc_breaker', 'a bulky hand cannon with a drill-like armor-breaking muzzle, orange and steel'),
  ],
  'ep_gun_b': [
    ('ep_hc_aqua', 'a hand cannon with an aqua blue water vase (aquarius jar) design pouring glowing water'),
    ('ep_hc_wing', 'a white and gold ceremonial hand cannon with angel wings on both sides and holy light'),
    ('ep_bg_red', 'a crossbow (bowgun) in crimson red and gold with flaming bolt loaded'),
    ('ep_bg_satan', 'a dark crossbow with devil horns and bat wings, purple cursed glow'),
    ('ep_sp_evil', 'a long spear with bronze bells hanging near the tip and talisman paper charms, exorcist style'),
    ('ep_sp_lava', 'a spear with a molten lava blade dripping magma, black obsidian shaft'),
  ],
  'ep_mage_a': [
    ('ep_pl_grian', 'a sturdy wooden fighting pole with iron caps and red cloth wraps, martial artist style'),
    ('ep_pl_breaker', 'a battle pole with sharp blade edges on both ends, steel and orange'),
    ('ep_pl_phantom', 'a translucent ghostly blue-white pole with a spirit wisp swirling around it'),
    ('ep_rd_cheshire', 'a short magic rod topped with a grinning purple striped cat head (cheshire cat)'),
    ('ep_rd_meow', 'a cute pink magic wand with a cat paw and cat ears on top, sparkles'),
    ('ep_st_willy', 'a long wooden staff with scrolls and prayer beads tied around its top, glowing words'),
  ],
  'ep_mage_b': [
    ('ep_st_sage', 'a grand sage staff with a big blue crystal orb held by golden branches'),
    ('ep_st_moon', 'a staff with a silver crescent moon on top and blue lightning chains flowing'),
    ('ep_br_scribble', 'a giant paintbrush broom with rainbow paint dripping from the bristles'),
    ('ep_br_lucky', 'a broom decorated with four-leaf clovers, a lucky charm and a golden horseshoe'),
    ('ep_head_campaign', 'a heavy iron shoulder armor pauldron with battle scratches and a red plume'),
    ('ep_head_skull', 'a dark black skull-shaped helmet pauldron with glowing purple eye sockets'),
  ],
  'ep_armor_a': [
    ('ep_head_jeno', 'a cursed cloth hood-helmet with small skeleton skulls hanging, green curse glow'),
    ('ep_bottom_tiger', 'a pair of light armor leg greaves with white tiger fur trim and tiger stripes'),
    ('ep_shoes_sky', 'a pair of heavy plate armored war boots with golden sky-blue wings'),
    ('ep_shoes_rabina', 'a pair of leather boots with snow and avalanche ice crystals, white fur trim'),
    ('ep_shoes_pisco', 'a pair of silver boots with cold blue light blades on the sides'),
    ('ep_belt_oath', 'a knight belt with a large golden oath buckle shaped like a shield and cross'),
  ],
  'ep_armor_b': [
    ('ep_belt_storm', 'a leather belt with swirling green wind and a tornado-shaped buckle'),
    ('ep_top_hes', 'a heavy chest armor made of red dragon bones and ribs, glowing orange dragon heart'),
    ('ep_bottom_hes', 'heavy leg armor made of red dragon bones with claws at the knees'),
    ('ep_neck_hunter', 'a necklace with a purple pendant cage holding swirling captured souls'),
    ('ep_brace_wave', 'a bracelet of blue-violet crystal with concentric wave ripple pattern'),
    ('ep_ring_devour', 'a dark ring with a gaping monster mouth eating a purple soul flame'),
  ],
  'ep_acc_a': [
    ('ep_ring_ice', 'a silver ring with a tiny ice fairy spirit on a pale blue crystal'),
    ('ep_ring_fire', 'a gold ring with a tiny fire fairy spirit on a red ruby'),
    ('ep_sup_michel', 'a holy white and gold talisman amulet with a blessing cross and feather'),
    ('ep_sup_paris', 'an elegant family crest emblem badge in pink and gold with a rose and a crown'),
    ('ep_stone_platani', 'a glowing golden stone fragment core from a golem, with runes'),
    ('ep_stone_grelin', 'a teardrop-shaped crystal glowing with aurora colors (green, pink, white)'),
  ],
  'ep_acc_b': [
    ('ep_stone_herik', 'a teardrop-shaped fiery red crystal with a flame inside'),
    ('ep_stone_aqui', 'a teardrop-shaped icy blue crystal with a snowflake inside'),
    ('ep_stone_merkel', 'a teardrop-shaped dark purple crystal with a ghostly spirit inside'),
    ('set_wargod_neck', 'a war god necklace with a golden sword and wing pendant, red gem'),
    ('set_wargod_bracelet', 'a war god golden bracelet with red gems and wing motifs'),
    ('set_wargod_ring', 'a war god golden ring with a red gem and tiny wings'),
  ],
  'ep_acc_c': [
    ('set_timelord_neck', 'a necklace with a pocket-watch pendant, clock gears, blue time glow'),
    ('set_timelord_bracelet', 'a bracelet made of clock gears and an hourglass charm, blue glow'),
    ('set_timelord_ring', 'a ring with a tiny clock face and hourglass, blue glow'),
    ('set_otherstone_neck', 'a necklace with a raw green-black otherworldly crystal, unstable energy'),
    ('set_otherstone_bracelet', 'a bracelet of green-black otherworldly crystals, crackling energy'),
    ('set_otherstone_ring', 'a ring with a green-black otherworldly crystal, crackling energy'),
  ],
}
# Lv20 三件套（上衣 / 下装 / 腰带）两套一张表；Lv28 五件套一套一张表（第 6 格放一件别的）
def _set3(sid, atype, look):
    return [(f'{sid}_top', f'a {atype} chest armor top, {look}'), (f'{sid}_bottom', f'{atype} pants leg armor, {look}'), (f'{sid}_belt', f'a {atype} belt, {look}')]
SHEETS['set20_a'] = _set3('set_witch', 'cloth robe', 'crimson witch design with flame embroidery and fire glow') + _set3('set_ironbeast', 'leather', 'dark iron-grey beast hide with metal studs and fangs')
SHEETS['set20_b'] = _set3('set_krom', 'light armor', 'green living vines and leaves, life tree design') + _set3('set_xuanming', 'heavy armor', 'deep navy and black with icy spirit wisps')
SHEETS['set20_c'] = _set3('set_ruins', 'plate armor', 'ancient sandstone ruins guardian design with teal runes') + [
    ('card1', 'a blank magic trading card with a silver frame and a blue monster silhouette, sparkle'),
    ('card2', 'a magic trading card with a purple frame and a monster silhouette, sparkle'),
    ('card3', 'a magic trading card with a pink-magenta ornate frame and a monster silhouette, sparkle')]
def _set5(sid, atype, look):
    return [(f'{sid}_top', f'a {atype} chest armor top, {look}'), (f'{sid}_head', f'a {atype} shoulder pauldron, {look}'), (f'{sid}_bottom', f'{atype} leg armor pants, {look}'),
            (f'{sid}_belt', f'a {atype} belt, {look}'), (f'{sid}_shoes', f'a pair of {atype} boots, {look}')]
SHEETS['set28_tremor'] = _set5('set_tremor', 'silk cloth', 'black and blood-red silk with dark curse sigils') + [('card4', 'a magic trading card with a golden ornate frame and a monster silhouette, sparkle')]
SHEETS['set28_reaper'] = _set5('set_reaper', 'leather', 'dark underworld king style with red lightning and heart motifs') + [('m_contra', 'a crystal split into two halves, one pink one cyan, repelling each other with sparks (contradiction crystal)')]
SHEETS['set28_arad'] = _set5('set_arad', 'light armor', 'sky blue and white with wind swirls and feathers') + [('amp_purify', 'a purple spell book with an otherworldly swirl portal on the cover')]
SHEETS['set28_evilgod'] = _set5('set_evilgod', 'heavy armor', 'black and crimson demonic god armor with horns and fire') + [('amp_guard', 'a pink protection ticket scroll with a shield emblem')]
SHEETS['set28_kingtear'] = _set5('set_kingtear', 'plate armor', 'royal white and gold with a blue teardrop gem and crown motifs') + [('amp_book', 'a golden ornate book with a shining upward arrow emblem')]
SHEETS['mats'] = [
    ('m_aura', 'a swirling orange-red flame aura orb, intense energy'),
    ('abyss_ticket', 'a dark purple invitation letter envelope with a demon wax seal and pink flames'),
    ('m_cosmos', 'a glowing cosmic soul orb with stars and a nebula inside, blue-cyan'),
    ('m_otherworld', 'a jar of dense green otherworldly essence liquid, glowing'),
    ('gear_seal', 'a purple magic crystal seal with a hexagram circle (abyss seal)'),
    ('gear_spare', 'a small pile of golden glowing dust'),
]

def cmd_gen(names, force=False):
    os.makedirs(SRC, exist_ok=True)
    for n in names:
        out = os.path.join(SRC, f'{n}.png')
        if os.path.exists(out) and not force: print('skip', n); continue
        items = SHEETS[n]
        prompt = STYLE + LAYOUT + 'Top row, left to right: ' + '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(items[:3])) + '. Bottom row, left to right: ' + '; '.join(f'({i + 4}) {d}' for i, (_, d) in enumerate(items[3:])) + '. Do not copy the items in the reference image.'
        for attempt in range(4):
            r = subprocess.run(['python3', GPT, 'edit', prompt, '-i', REF, '-o', out, '-s', '2048x1152', '-q', 'high'], capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(out): print('ok', n); break
            err = (r.stderr or r.stdout)[-400:]; print('fail', n, err)
            time.sleep(70 if '429' in err else 20)

def white_to_alpha(im):
    """白底 → 透明：从图边缘泛洪“浅色”像素（背景 + 物品外面的光晕，物品有深色描边挡着，里面的高光不会被泛洪到），
    泛洪到的区域按“离白色多远”算透明度，并把白色从颜色里减掉（金色光晕变成半透明的金色，不会留白边）"""
    a = np.array(im.convert('RGB')).astype(np.float32)
    mn = a.min(-1)
    B = flood_bg(mn > 110)
    alpha = np.clip((255 - mn) / 255.0 * 1.25, 0, 1)
    alpha = np.where(B, alpha, 1.0)
    alpha = np.where(B & (mn > 238), 0.0, alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(B[..., None], np.clip((a - (1 - alpha[..., None]) * 255) / safe, 0, 255), a)
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)

def cut_sheet(n):
    p = os.path.join(SRC, f'{n}.png')
    if not os.path.exists(p): print('missing', n); return
    im = Image.open(p).convert('RGBA'); W, H = im.size; cw, ch = W / 3, H / 2
    rgba = white_to_alpha(im)
    # 连通块按“大部分像素落在哪个格子”归到那一格（长武器会伸进隔壁格子，按格子硬切会切到别人的碎片）；
    # 两件物品粘在一起（例如项链的链子碰到上一格）时，这个连通块按格子边界拆开
    lab, comps = components(rgba[..., 3], min_cells=2)
    small = lab[::4, ::4]; gy, gx = np.mgrid[0:small.shape[0], 0:small.shape[1]]
    cellid = (np.minimum(1, (gy * 4) // ch).astype(int)) * 3 + np.minimum(2, (gx * 4) // cw).astype(int)
    own, split = {}, set()
    for num, cells in comps:
        m = small == num; cnt = np.bincount(cellid[m], minlength=6); tot = cnt.sum()
        top = np.argsort(cnt)[::-1]
        if tot and cnt[top[1]] > tot * 0.15 and cnt[top[1]] > 400: split.add(num)
        else: own.setdefault(int(top[0]), []).append(num)
    out_dir = os.path.join(ROOT, 'final', 'icon'); os.makedirs(out_dir, exist_ok=True)
    big = lab
    Y, X = np.mgrid[0:H, 0:W]
    fullcell = (np.minimum(1, Y // ch).astype(int)) * 3 + np.minimum(2, X // cw).astype(int)
    for i, (key, _) in enumerate(SHEETS[n]):
        if key == 'gear_spare': continue
        cx, cy = i % 3, i // 3
        mine = own.get(i, [])
        mask = np.isin(big, mine) | (np.isin(big, list(split)) & (fullcell == i))
        if not mask.any(): print('empty', n, key); continue
        ys, xs = np.where(mask & (rgba[..., 3] > 24))
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        part = rgba[y0:y1, x0:x1].copy(); part[..., 3] = np.where(mask[y0:y1, x0:x1], part[..., 3], 0)
        crop = Image.fromarray(part, 'RGBA'); s = int(max(crop.size) * 1.04)
        sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(crop, ((s - crop.width) // 2, (s - crop.height) // 2))
        name = 'item_' + key if not key.startswith('item_') else key
        sq.resize((128, 128), Image.LANCZOS).save(os.path.join(out_dir, f'{name}.webp'), 'WEBP', quality=86, method=6)
    print('cut', n)

# 单独重画的图标（图标表里那一格不理想时）：key → art/src/gear/ 下的单张原图（白底、一个物品）
FIXES = {'ep_ls_millennium': 'fix_millennium.png'}
def cut_fix(key):
    p = os.path.join(SRC, FIXES[key])
    if not os.path.exists(p): print('missing fix', key); return
    rgba = white_to_alpha(Image.open(p).convert('RGBA'))
    ys, xs = np.where(rgba[..., 3] > 24); crop = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
    s = int(max(crop.size) * 1.04); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(crop, ((s - crop.width) // 2, (s - crop.height) // 2))
    sq.resize((128, 128), Image.LANCZOS).save(os.path.join(ROOT, 'final', 'icon', f'item_{key}.webp'), 'WEBP', quality=86, method=6)
    print('fix', key)

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] == 'list': print('\n'.join(f'{k}: {", ".join(x for x, _ in v)}' for k, v in SHEETS.items()))
    elif a[0] == 'gen': cmd_gen([x for x in a[1:] if not x.startswith('--')], '--force' in a)
    elif a[0] == 'cut':
        names = list(SHEETS) if a[1:] == ['all'] else a[1:]
        for n in names: cut_sheet(n)
        for k in FIXES:
            if any(k in [x for x, _ in SHEETS[n]] for n in names): cut_fix(k)
