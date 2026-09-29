# 装备 2.0 · B3 首饰 / 辅助装备 / 魔法石的图标表（gear_icons.py 自动合并；用法：python3 art/tools/gear_icons.py gen|cut <表名>）
# 每张表 3×2 六件，同一套装放同一张表（统一画风），同一张表里的物品外形要一眼分得开；'gear_spare' 格子切图时跳过
PINK = ', surrounded by a soft pink magical glow instead of a golden glow'
SHEETS = {
  # 继承套装：苍穹战魂（天蓝银白、翅膀）/ 刻时者（黄铜钟摆、绿光）——和战神（金红）/ 时空主宰者（蓝光怀表）区分开
  'acc60_a': [
    ('set_ac_skysoul_neck', 'a silver necklace with a small winged sword pendant and a sky-blue gem, white feather accents'),
    ('set_ac_skysoul_bracelet', 'a wide silver bangle with two small white wings and three sky-blue gems, cloud engravings'),
    ('set_ac_skysoul_ring', 'a silver ring with tiny white wings on both sides of a round sky-blue gem'),
    ('set_ac_chrono_neck', 'a brass pendulum pendant necklace: a swinging brass pendulum disc with a small green-glowing gear in the middle'),
    ('set_ac_chrono_bracelet', 'a bronze bracelet made of interlocking clockwork cogs with small green glowing jewels'),
    ('set_ac_chrono_ring', 'a bronze ring whose top is a tiny spinning cogwheel with a green glowing center'),
  ],
  # 继承魔法石：四颗心形晶石（光 / 火 / 冰 / 暗，和龙之泪的水滴形区分开）+ 两件继承辅助装备
  'acc60_b': [
    ('ep_stone_dawnheart', 'a heart-shaped faceted crystal glowing golden-white with little light rays, set in a thin silver frame'),
    ('ep_stone_flameheart', 'a heart-shaped faceted crystal glowing red-orange with a flame flickering inside, set in a thin silver frame'),
    ('ep_stone_frostheart', 'a heart-shaped faceted crystal glowing pale icy blue with frost patterns inside, set in a thin silver frame'),
    ('ep_stone_nightheart', 'a heart-shaped faceted crystal glowing deep purple with tiny stars inside, set in a thin silver frame'),
    ('ep_sup_prayer', 'a small hand-stitched white cloth prayer charm pouch with a blue cross embroidery and a tiny silver bell, tied with a blue ribbon'),
    ('ep_sup_crest', 'an old tarnished silver noble family crest badge: a faded blue shield with a cracked little crown on top, polished shine'),
  ],
  # 官方 Lv60 辅助（奥尔卡 / 布万加）+ Lv65 魔法石（高级精灵 / 信奘的宝珠）+ 信奘的药丸 + 继承的石巨人琥珀核
  'acc60_c': [
    ('ep_stone_golem', 'a chunky amber-orange glowing stone core with carved golem runes and rough rock edges'),
    ('ep_sup_orca', 'a battered old iron sailor helmet with dents, a small anchor emblem and sea-blue trim'),
    ('ep_sup_bwanga', 'a tribal chieftain armband made of thick brown leather and white bear fur, with bone beads and a red war-paint claw emblem'),
    ('ep_stone_elftear', 'a large teardrop crystal whose inside swirls with four fused colors: gold, red, ice blue and purple'),
    ('ep_stone_xinzang', 'a round translucent jade-white prayer orb with a glowing golden swirl inside, resting on a small golden lotus base'),
    ('ep_sup_xinzang', 'a small brown gourd medicine bottle with a red cord, three glowing golden pills spilling out of it'),
  ],
  # 官方 Lv70 辅助（欧文 / 龙之金章 / 天之印记）+ Lv8~15 原创
  'acc60_d': [
    ('ep_sup_owen', 'a cursed dark iron gauntlet wrapped in purple chains with glowing violet curse runes'),
    ('ep_sup_goldmedal', 'a pure gold medal with a coiled dragon relief and a red ribbon, gleaming'),
    ('ep_sup_heaven', 'a radiant white-gold seal emblem shaped like a halo with small wings, glowing holy light'),
    ('ep_brace_thunder', 'a simple copper bangle with a small yellow lightning-bolt charm, crackling sparks'),
    ('ep_ring_catseye', 'a gold ring set with a big green cat-eye gemstone with a slit pupil, tiny purple poison droplets'),
    ('ep_neck_dragonscale', 'a pendant made of a single large red-orange dragon scale on a leather cord'),
  ],
  # Lv16~39 原创散件
  'acc60_e': [
    ('ep_stone_puppet', 'a glass eyeball marble with a bright blue iris held in a tiny carved wooden puppet-hand frame'),
    ('ep_sup_scripture', 'a torn page of an ancient holy scripture with glowing golden letters-like marks (no readable text), rolled and tied with a purple cord'),
    ('ep_brace_spider', 'a bracelet woven from thick white spider silk with a small black spider charm, purple sheen'),
    ('ep_ring_goliath', 'a thick heavy iron knuckle ring glowing red-hot, cracked with orange magma lines'),
    ('ep_sup_anvil', 'a small iron anvil-shaped badge with hammer dents and flying orange sparks'),
    ('ep_stone_yeti', 'a rough icy blue-white crystal core with tufts of white fur around its base'),
  ],
  # 白狼猎团（Lv40 套装）+ Lv42~49 原创散件
  'acc60_f': [
    ('set_ac_whitewolf_neck', 'a necklace of three white wolf fangs on a leather cord with pale blue beads'),
    ('set_ac_whitewolf_bracelet', 'a white wolf fur wrist bracer with leather straps and one small wolf fang charm, pale blue beads'),
    ('set_ac_whitewolf_ring', 'a silver ring shaped like a howling white wolf head with pale blue eyes'),
    ('ep_neck_rose', 'a pendant of a frozen teardrop ice crystal with a tiny rose inside, silver chain'),
    ('ep_brace_ratbell', 'a bracelet of small tarnished brass bells with little rat-tail charms and a dark purple ribbon'),
    ('ep_stone_ember', 'a small round glass bottle holding a flickering orange flame, sealed with a cork and red wax'),
  ],
  # 帝国试验体（Lv45，钢铁 + 青色能量）/ 根特守备队（Lv48，银 + 蓝金盾徽）
  'acc60_g': [
    ('set_ac_imperial_neck', 'a steel dog tag necklace on a ball chain, with a glowing teal circuit line and a small bolt'),
    ('set_ac_imperial_bracelet', 'a heavy mechanical steel restraint cuff with rivets and teal glowing lights'),
    ('set_ac_imperial_ring', 'a mechanical steel ring with a small glowing teal overloaded energy core, tiny sparks'),
    ('set_ac_gentguard_neck', 'a silver whistle on a blue-and-gold braided cord with a small blue shield charm'),
    ('set_ac_gentguard_bracelet', 'a navy blue cloth armband with silver trim and a golden shield crest'),
    ('set_ac_gentguard_ring', 'a silver signet ring with a blue enamel shield crest and a gold rim'),
  ],
  # Lv54~57 原创散件（后三格备用，不切）
  'acc60_h': [
    ('ep_neck_gaslamp', 'a pendant shaped like a tiny Victorian brass gas lamp with a warm orange flame inside, grey fog wisps'),
    ('ep_brace_quicksand', 'a sandstone-colored bangle with a small glass capsule of flowing golden sand and desert engravings'),
    ('ep_ring_cerberus', 'a black iron ring shaped like a spiked dog collar with three tiny dog heads with ember-red eyes'),
    ('gear_spare', 'a small round blue potion bottle'),
    ('gear_spare', 'a small golden key'),
    ('gear_spare', 'a small red apple'),
  ],
  # 领主神器（粉色光晕）
  'acc60_named': [
    ('nm_neck_spiz', 'a pendant of a single dark purple dragon scale growing the wrong way, with a green evil eye gem' + PINK),
    ('nm_sup_headless', 'a torn black leather horse rein with a rusty iron bit and ghostly blue flames' + PINK),
    ('nm_brace_hanik', 'a bracelet made of one huge curved ivory tusk fang with blood-red streaks, bound with iron bands' + PINK),
    ('nm_ring_ivan', 'a clunky steampunk ring with a tiny fire-extinguisher nozzle and a red valve, little flames' + PINK),
    ('nm_neck_wail', 'a necklace with a pale crying ghost-face pendant and dark teardrop gems, misty grey chain' + PINK),
    ('nm_sup_skelknight', 'a rusty iron knight gauntlet clenched into a fist with bone fingers peeking out' + PINK),
  ],
}
