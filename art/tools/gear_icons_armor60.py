"""装备 2.0 · B2 防具的图标表（gear_icons.py 自动合并这里的 SHEETS；用法：python3 art/tools/gear_icons.py gen|cut <表名...>）
每表 3×2（5~6 件）；同一套的部件写同一段外观（配色 + 母题），一眼看得出是一套、不同套之间差别明显。
表名一律 ar60_ 开头（原图放主仓库 art/src/gear/，各块共用目录，不能重名）。"""

PINK = ' (this one has a soft pink-magenta glow instead of the golden glow)'

def _set5(sid, kind, look, names):
    return [(f'{sid}_{s}', f'{n} ({kind}), {look}') for s, n in zip(('top', 'head', 'bottom', 'belt', 'shoes'), names)]

def _pick(sid, kind, look, parts):
    """parts: [(部位, 画面名词)]"""
    return [(f'{sid}_{s}', f'{n} ({kind}), {look}') for s, n in parts]

CLOTH5 = ('a long cloth robe top', 'a cloth shoulder mantle', 'a long cloth skirt', 'a cloth sash belt', 'a pair of soft cloth boots')
LEATHER5 = ('a leather chest armor jacket', 'a pair of leather shoulder guards', 'leather pants', 'a leather belt', 'a pair of leather short boots')
LIGHT5 = ('a light armor chest plate', 'a pair of light armor shoulder pauldrons', 'light armor leg guards', 'a light armor belt', 'a pair of light armor boots')
HEAVY5 = ('a heavy armor chest plate', 'a pair of heavy armor shoulder pauldrons', 'heavy armor greaves', 'a heavy armor belt', 'a pair of heavy armor war boots')
PLATE5 = ('a plate armor breastplate', 'a pair of plate armor pauldrons', 'plate armor leg plates', 'a plate armor belt', 'a pair of plate armor sabatons')

# 散件 / 领主神器的画面描述（当填充格用）
L = {
    # Lv50 搬家后的继承装备（外观和官方原物品要明显不同）
    'ep_head_emberwolf': 'a pair of heavy dark grey steel shoulder pauldrons shaped like snarling wolf heads, smoldering orange embers between the fangs',
    'ep_head_stonespirit': 'a pair of light shoulder pauldrons made of mossy grey stone, each with a small cute sleepy earth spirit face',
    'ep_shoes_starwalk': 'a pair of pastel pink and white cloth ankle boots trailing sparkling stardust, a small crescent moon charm',
    'ep_shoes_frostglide': 'a pair of navy and white fur-trimmed boots with a single silver ice-skate blade under each sole, snowflake charms',
    # 官方 Lv50 / Lv55 系列（同系列同外观：地灵绝魂 翠玉金边、古拉德 黑红金边火焰、玄武 墨绿龟甲黑蛇、波罗丁 白金圣骑士）
    'ep_belt_earthsoul': 'a light armor belt of green jade plates with gold swirl trims and a glowing jade buckle',
    'ep_shoes_earthsoul': 'a pair of light armor long boots of green jade plates with gold swirl trims',
    'ep_top_earthsoul': 'a light armor chest plate of green jade plates with gold swirl trims and a glowing jade earth gem',
    'ep_bottom_earthsoul': 'light armor leg guards of green jade plates with gold swirl trims',
    'ep_belt_gurad': 'a heavy dark red and black armor belt with gold trims and a burning flame buckle',
    'ep_shoes_gurad': 'a pair of heavy dark red and black armor short boots with gold trims, flames bursting from the heels',
    'ep_top_gurad': 'a heavy dark red and black chest armor with gold trims and a burning flame core, fire on the shoulders',
    'ep_bottom_gurad': 'heavy dark red and black armor greaves with gold trims and flames at the knees',
    'ep_head_xuanwu': 'a pair of heavy dark green shoulder pauldrons shaped like turtle shells with a coiled black snake, icy blue glow',
    'ep_top_xuanwu': 'a heavy dark green chest armor shaped like a turtle shell with a coiled black snake, icy blue glow',
    'ep_bottom_xuanwu': 'heavy dark green leg armor with turtle shell plates and black snake scales, icy blue glow',
    'ep_head_borodin': 'a white and gold holy knight plate helmet with small angel wings and a praying cross emblem',
    'ep_shoes_borodin': 'a pair of white and gold holy knight plate long boots with small angel wings',
    'ep_top_borodin': 'a white and gold holy knight plate breastplate with a praying cross and small angel wings',
    'ep_bottom_borodin': 'white and gold holy knight plate leg armor with cross emblems on the knees',
    'ep_belt_monica': 'a vintage brown cloth and lace belt with an antique brass cameo buckle',
    'ep_shoes_atlas': 'a pair of dark brown leather long boots with seven small different-colored gems and silver chains',
    'ep_top_iris': 'an elegant lady cloth robe in lilac silk with a fluffy white sable fur collar',
    'ep_bottom_nivu': 'a short teal cloth shaman skirt embroidered with spell runes and tiny bells',
    'ep_top_titan': 'a dark green leather chest armor with one big glowing yellow snake eye gem in the center',
    'ep_bottom_goliath': 'red leather leg armor with flame patterns and giant metal studs',
    # 原创补缺 Lv45 / Lv57
    'ep_top_moonveil': 'a dark navy leather night-stalker jacket with a translucent silver moonlight veil and a crescent clasp',
    'ep_top_steamcore': 'a bulky brass and steel steam-powered heavy chest armor with a small boiler, pipes and puffs of steam',
    'ep_bottom_ashwalker': 'light armor leg guards covered in grey ash with glowing ember sparks and scorched red cloth',
    'ep_bottom_runeweave': 'a long cloth skirt woven with glowing blue and gold rune patterns',
    'ep_head_brass': 'a brass engineer helmet with telescope goggle lenses and small gears',
    'ep_belt_bandit': 'a wide leather bandolier belt with throwing knives and small gunpowder pouches',
    'ep_shoes_hamelin': 'a pair of colorful patchwork cloth dancing boots with floating musical notes and a small flute charm',
    'ep_head_chrono': 'a silver plate helmet with a clock face on the visor and glowing blue clock hands',
    'ep_belt_railway': 'a heavy iron belt hung with wrenches and rivets and a small train wheel buckle',
    'ep_belt_seasalt': 'a sea-worn leather belt crusted with white salt, rope knots and a seashell buckle',
    'ep_shoes_mistwalk': 'a pair of grey cloth soft-soled short boots wrapped in drifting fog',
    'ep_shoes_ardent': 'a pair of khaki military light armor combat boots with spiked soles and a red star',
    'ep_shoes_timestep': 'a pair of heavy dark blue armored boots with a glowing golden clockwork wheel at each heel',
    # 领主神器（粉色）
    'nm_top_kaino': 'a silver leather chest armor crackling with blue-white lightning and goblin shaman charms' + PINK,
    'nm_bottom_kaino': 'silver leather leg armor crackling with blue-white lightning' + PINK,
    'nm_top_sauta': 'a blood-red heavy chest armor with big bull horns on the shoulders' + PINK,
    'nm_bottom_sauta': 'blood-red heavy leg armor with bull hoof shaped knee guards' + PINK,
    'nm_bottom_lotus': 'purple plate greaves shaped like the long spindly legs of a giant beast' + PINK,
    'nm_top_spiz': 'a black and violet light armor chest plate with dragon bone ribs and ghostly dark elf spirits' + PINK,
    'nm_top_headless': 'a hollow dark knight heavy chest armor with ghostly blue flames rising from the empty neck' + PINK,
    'nm_bottom_headless': 'dark knight heavy leg armor wrapped in ghostly blue wisps' + PINK,
    'nm_bottom_lik': 'giant icy blue plate leg armor covered in frost and icicles' + PINK,
    'nm_top_ruug': 'a fur-lined cloth jacket with beast claw marks and a wolf fur hood' + PINK,
    'nm_head_sabertooth': 'a pair of leather shoulder guards each with a big white ice sabertooth fang' + PINK,
    'nm_head_seski': 'a pair of light armor shoulder pauldrons made of glowing snow spirit crystals' + PINK,
    'nm_top_suleide': 'a black motorcycle leather jacket armor with orange racing stripes and chrome exhaust pipes' + PINK,
    'nm_bottom_gt9600': 'white and cyan mechanical robot leg armor with glowing laser vents' + PINK,
}
F = lambda *ks: [(k, L[k]) for k in ks]

SHEETS = {}
# Lv28 原创继承套（天空之城深渊）
SHEETS['ar60_inh_nightsilk'] = _set5('set_ar_nightsilk', 'cloth', 'midnight violet silk with silver star-thread embroidery and crescent moons', CLOTH5) + F('ep_head_emberwolf')
SHEETS['ar60_inh_crimsonfang'] = _set5('set_ar_crimsonfang', 'leather', 'crimson and black leather decorated with white wolf fangs', LEATHER5) + F('ep_head_stonespirit')
SHEETS['ar60_inh_cloudwing'] = _set5('set_ar_cloudwing', 'light armor', 'cream white and gold with fluffy cloud puffs and small golden feather wings', LIGHT5) + F('ep_shoes_starwalk')
SHEETS['ar60_inh_lavaforge'] = _set5('set_ar_lavaforge', 'heavy armor', 'blackened steel with glowing orange lava cracks and spikes', HEAVY5) + F('ep_shoes_frostglide')
SHEETS['ar60_inh_oathshield'] = _set5('set_ar_oathshield', 'plate armor', 'polished steel and cobalt blue with a silver shield crest and white cape trims', PLATE5) + F('ep_belt_gurad')
# Lv40 原创五件套（万年雪山深渊）
SHEETS['ar60_s40_snowmoon'] = _set5('set_ar_snowmoon', 'cloth', 'white and ice-lilac cloth with snowflake and crescent moon embroidery', CLOTH5) + F('ep_shoes_gurad')
SHEETS['ar60_s40_frostwolf'] = _set5('set_ar_frostwolf', 'leather', 'grey-white wolf fur leather with frost-covered fang ornaments and icy blue eyes', LEATHER5) + F('ep_belt_monica')
SHEETS['ar60_s40_aurora'] = _set5('set_ar_aurora', 'light armor', 'teal-green to violet aurora gradient plates with shimmering light ribbons', LIGHT5) + F('ep_shoes_atlas')
SHEETS['ar60_s40_glacier'] = _set5('set_ar_glacier', 'heavy armor', 'massive translucent cyan glacier ice crystals over frozen grey stone', HEAVY5) + F('ep_head_brass')
SHEETS['ar60_s40_snowfort'] = _set5('set_ar_snowfort', 'plate armor', 'white snow-capped iron plates with small fortress tower motifs and red banners', PLATE5) + F('ep_belt_bandit')
# Lv48 原创五件套（诺斯玛尔深渊）
SHEETS['ar60_s48_alchemy'] = _set5('set_ar_alchemy', 'cloth', 'emerald green alchemist cloth with potion vials, brass goggles and green flames', CLOTH5) + F('ep_shoes_hamelin')
SHEETS['ar60_s48_nightraid'] = _set5('set_ar_nightraid', 'leather', 'black assassin leather with dark purple trims, dagger holsters and glowing red eye visors', LEATHER5) + F('ep_bottom_ashwalker')
SHEETS['ar60_s48_scout'] = _set5('set_ar_scout', 'light armor', 'khaki military scout style with brass buttons and a flowing red scarf', LIGHT5) + F('ep_top_moonveil')
SHEETS['ar60_s48_ironcannon'] = _set5('set_ar_ironcannon', 'heavy armor', 'gunmetal steam-powered armor with rivets, small cannon barrels and smoke puffs', HEAVY5) + F('ep_bottom_runeweave')
SHEETS['ar60_s48_gentguard'] = _set5('set_ar_gentguard', 'plate armor', 'royal blue and silver city guard plates with a golden lion crest', PLATE5) + F('ep_top_steamcore')
# Lv20 三件套：老 key 改成原创继承套（绯焰祭司 / 铁鬃猎手 / 琥珀蜂刺 / 暮钟守卫 / 灰岩壁垒）+ 官方三件套回到 Lv60（官方部位）
TBB = lambda top, bottom, belt: [('top', top), ('bottom', bottom), ('belt', belt)]
SHEETS['ar60_r20_a'] = (_pick('set_witch', 'cloth', 'orange and white sun priestess cloth with golden sun-flame embroidery', TBB('a long priestess robe', 'a long priestess skirt', 'a cloth sash belt'))
                        + _pick('set_ironbeast', 'leather', 'brown boar hide with steel bristles and boar tusk ornaments', TBB('a leather hunter jacket', 'leather hunter pants', 'a leather belt')))
SHEETS['ar60_r20_b'] = (_pick('set_krom', 'light armor', 'amber-yellow and black stripes with bee stinger spikes and honeycomb pattern', TBB('a light armor chest plate', 'light armor leg guards', 'a light armor belt'))
                        + _pick('set_xuanming', 'heavy armor', 'bronze and deep teal with bell and clock motifs', TBB('a heavy armor chest plate', 'heavy armor greaves', 'a heavy armor belt')))
SHEETS['ar60_r20_c'] = (_pick('set_ruins', 'plate armor', 'grey granite stone plates with green moss and iron bands', TBB('a plate armor breastplate', 'plate armor leg plates', 'a plate armor belt'))
                        + _pick('set_ar_witch', 'cloth', 'crimson and black witch style with flame embroidery and fire glow', [('head', 'a crimson witch cloak cape with a pointed hood'), ('top', 'a long crimson witch robe'), ('bottom', 'crimson witch long pants')]))
SHEETS['ar60_t1_a'] = (_pick('set_ar_ironbeast', 'leather', 'dark iron-grey beast hide with metal plates, fangs and glowing red eyes', [('top', 'a leather chest armor'), ('bottom', 'leather leg guards'), ('belt', 'a leather belt')])
                       + _pick('set_ar_krom', 'light armor', 'white-silver with green life-tree vines and glowing emerald seeds', [('head', 'a pair of light armor shoulder pauldrons'), ('top', 'a light armor chest plate'), ('bottom', 'light armor leg guards')]))
SHEETS['ar60_t1_b'] = (_pick('set_ar_xuanming', 'heavy armor', 'deep navy and black with icy spirit wisps and silver clock and star runes', [('head', 'a heavy dark mantle cloak with a silver clock clasp'), ('top', 'a heavy chest armor with a swirling galaxy core'), ('belt', 'a heavy belt with a glowing memory crystal buckle')])
                       + _pick('set_ar_ruins', 'plate armor', 'ancient sandstone plates with glowing teal runes', [('top', 'a plate armor breastplate'), ('bottom', 'plate armor leg plates'), ('shoes', 'a pair of plate armor war boots')]))
# Lv10 原创两件套
SHEETS['ar60_s10_a'] = (_pick('set_ar_sprout', 'cloth', 'leaf-green apprentice cloth with little sprouts and leaves', [('head', 'a cloth hood with a tiny sprout on top'), ('bottom', 'a long cloth skirt')])
                        + _pick('set_ar_goblin', 'leather', 'brown patched leather hung with goblin teeth and ear trophies', [('bottom', 'leather pants'), ('belt', 'a leather trophy belt')])
                        + _pick('set_ar_thunder', 'light armor', 'steel-blue plates with yellow lightning bolt emblems and sparks', [('head', 'a pair of light armor shoulder pauldrons'), ('belt', 'a light armor belt')]))
SHEETS['ar60_s10_b'] = (_pick('set_ar_tauhorn', 'heavy armor', 'rust-red iron with curved bull horns', [('head', 'a pair of heavy shoulder pauldrons'), ('bottom', 'heavy greaves')])
                        + _pick('set_ar_oakguard', 'plate armor', 'oak wood planks with iron bands and green moss', [('head', 'a plate helmet'), ('belt', 'a plate belt')])
                        + F('ep_belt_seasalt', 'ep_shoes_mistwalk'))
# 散件系列 + 领主神器
SHEETS['ar60_loose_earth'] = F('ep_top_earthsoul', 'ep_bottom_earthsoul', 'ep_belt_earthsoul', 'ep_shoes_earthsoul', 'ep_head_chrono', 'ep_belt_railway')
SHEETS['ar60_loose_holy'] = F('ep_head_borodin', 'ep_top_borodin', 'ep_bottom_borodin', 'ep_shoes_borodin', 'ep_shoes_ardent', 'ep_shoes_timestep')
SHEETS['ar60_loose_fire'] = F('ep_top_gurad', 'ep_bottom_gurad', 'ep_bottom_goliath', 'ep_head_xuanwu', 'ep_top_xuanwu', 'ep_bottom_xuanwu')
SHEETS['ar60_loose_misc'] = F('ep_top_iris', 'ep_bottom_nivu', 'ep_top_titan', 'nm_top_kaino', 'nm_bottom_kaino')
SHEETS['ar60_lord_a'] = F('nm_top_sauta', 'nm_bottom_sauta', 'nm_bottom_lotus', 'nm_top_spiz', 'nm_top_headless', 'nm_bottom_headless')
SHEETS['ar60_lord_b'] = F('nm_bottom_lik', 'nm_top_ruug', 'nm_head_sabertooth', 'nm_head_seski', 'nm_top_suleide', 'nm_bottom_gt9600')

# 切图前修原图（gen 之后、cut 之前跑）：python3 art/tools/gear_icons_armor60.py fix <表名...>
#   1. 有的生成图四周带一条黑线 → 切图时被当成物品，同一排的图标被切得很小：四周 10 像素刷白
#   2. 5 件的表，模型常把下排两件画在 1/4、3/4 处（跨格子）→ 挪到第 4、5 格中心（只能跑一次，跑过的表别再跑）
if __name__ == '__main__':
    import sys
    import numpy as np
    from PIL import Image
    SRC = '/Users/luzhipeng/projects/dawnbreak/art/src/gear'
    for n in sys.argv[2:] if sys.argv[1:2] == ['fix'] else []:
        p = f'{SRC}/{n}.png'; a = np.array(Image.open(p).convert('RGB')); H, W = a.shape[:2]; E = 10
        if (np.concatenate([a[:E], a[-E:]], 0).min(-1) < 200).any() or (np.concatenate([a[:, :E], a[:, -E:]], 1).min(-1) < 200).any():
            a[:E] = a[-E:] = 255; a[:, :E] = a[:, -E:] = 255; print('border', n)
        if len(SHEETS[n]) == 5:
            bot = a[H // 2:]; A = np.full_like(bot, 255); B = np.full_like(bot, 255)
            A[:, :W // 2 - W // 12] = bot[:, W // 12:W // 2]; B[:, W // 4:W - W // 4] = bot[:, W // 2:]
            a[H // 2:] = np.minimum(A, B); print('relayout', n)
        Image.fromarray(a).save(p)
