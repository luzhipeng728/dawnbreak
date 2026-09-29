"""装备 2.0 · B1c 魔法师武器的设计文字（docs/GEAR_PLAN_60.md §7）：avatar_gen.py 读 DESIGNS 追加进 BOLD_EPICS，weapon_gen.py 按它出 v2 单张图。
物品定义在 src/content/items/epics60_w_mage.js。出图：python3 art/tools/weapon_gen.py <key,...> -j 3；切图：python3 art/tools/avatar_weapons.py ep_sp_ ep_pl_ ep_rd_ ep_st_ ep_br_
审图要求：魔杖 / 法杖 / 扫把的头要大（1 倍画面拿在手里也认得出）；矛尖、棍梢笔直；每把史诗一眼认得出、互相不像；不用纯绿 / 洋红。
"""
# 矛、棍棒：尖端 / 棍梢必须笔直（和刀剑的 THICK 一样的要求）
_ST = '. The spearhead points perfectly STRAIGHT along the shaft line and ends in a straight sharp point centered on that line; NO hook, no curved, bent, forked or curled tip'
_PL = '. Both ends are straight and centered on the pole line (no hooks, no curled or bent tips)'
# 魔杖：杖头特别大，缩小到 1 倍也看得清
_RD = '. The head ornament is HUGE: about as tall as half the wand length and much wider than the handle, so it reads clearly at small size'
_BIG = '. The head ornament is HUGE and wide, clearly the biggest part of the weapon'
# 暗色系：游戏背景偏暗，纯黑的武器在手里会糊成一团
_DARK = '. Use deep purple, charcoal and dark steel with bright rim highlights instead of pure black, so it stays readable on a dark background'

DESIGNS = {
    'spear': [
        # 继承装备（1~30）
        ('ep_sp_bronze', 'Bronze Soul-Binding Spear: an archaic ritual spear with a broad dark bronze leaf-shaped spearhead covered in engraved cloud patterns and teal-blue patina, '
                         'three long yellow paper talisman strips with red brush-script seals tied under the head, a black lacquered shaft with bronze rings' + _ST),
        ('ep_sp_trident', 'Flame Demon Trident: a TRIDENT with three straight parallel crimson-and-gold prongs of which the middle one is the longest, glowing orange-red lava cracks in the prongs, '
                          'a black iron shaft with a gold flame-shaped collar and a red gem where the prongs meet. The three prongs point straight forward, no curling'),
        # Lv1~10
        ('ep_sp_tassel', 'Red-Tassel Vanguard Spear: a simple bright spear with a polished silver diamond-shaped spearhead, a HUGE fluffy bright red horsehair tassel bursting out under the head, '
                         'a red-lacquered shaft with a gold butt cap' + _ST),
        # Lv34 / Lv38 深渊
        ('ep_sp_silverleaf', 'Dark Elf Silverleaf Spear: an elegant long spear with a slender, very long mirror-silver leaf-shaped spearhead with an engraved vein line, a violet amethyst set at the socket '
                             'framed by two small silver leaves, a slim matte black shaft with thin silver filigree spirals' + _ST),
        ('ep_sp_abyssfang', 'Abyss Fang Spear: a big bone-white monster fang used as the spearhead, with glowing violet rune cracks along it, a black spiked socket gripping the fang, '
                            'a black shaft wrapped with purple leather strips and small bone spikes' + _ST + _DARK),
        # Lv45 / Lv48
        ('ep_sp_piston', 'Bilmark Pile-Driver Spear: a heavy MECHANICAL spear: a thick steel pile-driver spike as the spearhead mounted on a big brass hydraulic piston cylinder with pipes and a pressure gauge, '
                         'yellow-and-black hazard stripes on the cylinder, a riveted steel shaft' + _ST),
        ('ep_sp_gentguard', 'Gent Royal Guard Spear: a ceremonial guard spear with a long polished steel diamond-section spearhead, a gold crossbar below it, and a square royal-blue banner with a gold eagle crest '
                            'hanging from the crossbar, a navy shaft with gold bands' + _ST),
        # 官方新增（Lv60 T2 / T3）
        ('ep_sp_snowwhite', 'Spear of Pure White: an immaculate pure-white spear: a long pearl-white and silver spearhead with a thin gold edge, a pair of small white feathered angel wings spreading from the socket, '
                            'a big round pearl under the wings, a white shaft with silver rings' + _ST),
        ('ep_sp_tianjiao', 'Tianjiao Imperial War Spear: a majestic imperial spear: a big gleaming gold spearhead with a radiant sun-crest ring behind it, a huge crimson tassel, '
                           'a crimson shaft wrapped in a coiling gold dragon-scale pattern, a gold dragon-claw butt cap' + _ST),
        ('ep_sp_lance1893', 'M1893 Knight Lance: a JOUSTING LANCE: a long fluted cone-shaped steel lance body tapering to a sharp point on the center line, a big round steel vamplate hand guard near the grip, '
                            'royal blue and gold enamel stripes on the cone, brass rivets and a small brass steam valve on the vamplate. The cone is perfectly straight and symmetric'),
    ],
    'pole': [
        # 继承装备
        ('ep_pl_tiger', 'Roaring Tiger Staff: a thick dark-red wooden fighting staff capped at BOTH ends by a big bronze tiger head with open roaring jaws and amber eyes, bronze bands along the shaft' + _PL),
        ('ep_pl_lantern', 'Soul-Guiding Lantern Staff: a long black wooden staff; at the right end a big hexagonal bronze lantern with glowing cyan-blue ghost fire inside hangs from a short hook, '
                          'white paper charms tied below it, a bronze cap on the left end' + _PL),
        # Lv1~10
        ('ep_pl_sprout', 'Forest Sprite Oak Staff: a knobbly living oak branch staff with small fresh leaves sprouting along it, a big glossy brown acorn cap on each end with a glowing amber seed' + _PL),
        # Lv34 / Lv38 深渊
        ('ep_pl_obsidian', 'Lava Cave Obsidian Staff: a glossy black obsidian staff with faceted volcanic glass caps on both ends, bright orange lava veins glowing inside the caps and a dark iron grip wrap' + _PL),
        ('ep_pl_chains', 'Dark City Warden Chain Staff: a heavy dark iron staff with a big black spiked iron mace-like knob on each end, iron chains wound around the shaft and a violet gem in each knob' + _PL + _DARK),
        # Lv45 / Lv48
        ('ep_pl_coin', 'Bandit King Gold Coin Staff: a staff whose both ends are wrapped in thick stacks of shiny gold coins held by red cord, a fat red money pouch tied near one end, a brown wooden shaft' + _PL),
        ('ep_pl_chitin', 'Bug King Carapace Staff: a staff made of segmented glossy dark-teal and amber insect carapace plates, with a big amber insect stinger spike on the right end and a spiky carapace knob on the left' + _PL),
        # 官方新增
        ('ep_pl_duck', 'Crazy Duck Staff: a funny staff with blue-and-white candy stripes and a BIG yellow duck head on the right end with an angry frown, a wide orange beak quacking open and a tiny red bow tie, '
                       'a small yellow duck tail on the left end' + _PL),
        ('ep_pl_elandra', "Elandra's Ultimate War Staff: an ornate silver war staff inlaid with sapphire-blue enamel, both ends crowned by a pair of small silver angel wings around a big faceted sapphire, "
                          'engraved master-smith runes along the shaft' + _PL),
        ('ep_pl_reaper', "Reaper's Temptation: a black bone staff with a grinning skull wearing a tattered dark hood on the right end, violet soul flames glowing in its eye sockets, "
                         'vertebra-like segments along the shaft and a sharp straight silver spike on the left end' + _PL + _DARK),
        ('ep_pl_frost', 'Frost Crystal Staff: a long staff of translucent ice-blue crystal with big clusters of faceted ice crystals on both ends, frosty white silver bands and snowflake engravings along the shaft' + _PL),
    ],
    'rod': [
        # 继承装备
        ('ep_rd_aria', 'Thunder Aria Wand: a short dark blue wand topped with a BIG silver tuning fork whose two prongs crackle with bright blue-and-yellow lightning painted inside them, a gold ring at the fork base' + _RD),
        ('ep_rd_jester', "Jester's Prank Wand: a short striped red-and-blue wand topped with a BIG three-pointed jester hat in red, blue and yellow with round gold bells on each point and a grinning white mask below it" + _RD),
        ('ep_rd_owl', 'Night Owl Whisper Wand: a short dark wooden wand topped with a BIG snowy white owl with big glowing amber eyes and wings spread wide, perched on a silver crescent-shaped perch' + _RD),
        # Lv1~10
        ('ep_rd_firefly', 'Firefly Jar Wand: a short wooden wand topped with a BIG round glass jar with a copper lid and handle, filled with glowing warm-yellow fireflies, a little leaf tied to the lid' + _RD),
        # Lv34 / Lv38 深渊
        ('ep_rd_spider', "Spider Queen's Web Wand: a short black wand topped with a BIG round silver spiderweb disc, a purple spider-shaped gem sitting in the center of the web and small silver dew drops on the threads" + _RD),
        ('ep_rd_skullcandle', 'Undead Candle Wand: a short bone wand topped with a BIG white skull with a thick purple candle on its crown burning with a violet flame, melted wax dripping down the skull' + _RD + _DARK),
        # Lv45 / Lv48
        ('ep_rd_baton', "Piper's Conductor Wand: a black-and-silver conductor's baton topped with a HUGE shiny golden treble clef symbol (as tall as half the wand, thick and bold) with a big purple satin bow tied at its base and two small golden music notes attached to it" + _RD),
        ('ep_rd_gear', 'Celestial Artisan Gear Wand: a short brass wand topped with a BIG cluster of three interlocking brass cogwheels around a glowing sky-blue energy core' + _RD),
        # 官方新增
        ('ep_rd_icedragon', 'Ice Dragon Wand: a short white-silver wand topped with a BIG small white ice dragon coiled around the tip with its wings spread, holding a glowing pale-blue ice crystal in its jaws' + _RD),
        ('ep_rd_rabbit', 'Spirit Rabbit Wand: a short white-and-gold wand topped with a BIG white jade rabbit sitting inside a golden crescent moon, red gem eyes, a small pink cloud ribbon below it' + _RD),
    ],
    'staff': [
        # 继承装备
        ('ep_st_candela', "Oathkeeper's Candelabra Staff: a long dark bronze staff topped with a BIG three-armed bronze candelabra holding three white candles with bright blue flames, a hanging silver oath medallion" + _BIG),
        ('ep_st_hourglass', "Time Sage's Hourglass Staff: a long white-and-gold staff topped with a BIG golden hourglass with glowing blue sand, framed by two gold rings like clock hands" + _BIG),
        ('ep_st_pumpkin', "Pumpkin Witch's Lantern Staff: a long crooked black wooden staff topped with a BIG carved jack-o'-lantern pumpkin glowing orange inside, wearing a tiny purple witch hat, a curly vine at its stem" + _BIG),
        ('ep_st_dawn', 'Dawnlight Staff: a slender white-gold staff topped with a BIG radiant golden sun disk with straight sun-ray spikes around it and a glowing orange crystal at its center' + _BIG),
        # Lv34 / Lv38 深渊
        ('ep_st_frostfist', "Lik's Frost Staff: a thick frosted grey-blue wooden staff topped with a HUGE jagged chunk of clear ice-blue crystal like a frozen fist, frost and icicles on the shaft below it" + _BIG),
        ('ep_st_darkpriest', 'Dark Elf High Priestess Staff: a tall black staff topped with a BIG glowing violet crystal cradled by twisting silver tree-branch prongs, small silver chains with moon charms hanging down' + _BIG + _DARK),
        # Lv45 / Lv48
        ('ep_st_steam', 'Test Subject Steam Staff: a riveted steel staff topped with a BIG glass tank of bubbling glowing blue liquid in a brass frame with little pipes, cogs and a pressure gauge' + _BIG),
        ('ep_st_astrolabe', 'Gent Magic Corps Star-Chart Staff: a navy-and-brass staff topped with a BIG FLAT round brass star-chart disc (a planisphere, seen face-on like a big coin) engraved with constellations and glowing blue star dots, a long brass pointer needle across it and a small blue star gem at its center; no rings, no spheres' + _BIG),
        # 官方新增
        ('ep_st_willyrage', "Willy's Wrathful Staff: a crimson and black staff topped with a BIG red-gold prayer-wheel shaped head wrapped in burning scrolls with orange flames painted on them, "
                            'red prayer beads and charred paper strips hanging below' + _BIG),
    ],
    'broom': [
        # 继承装备
        ('ep_br_mop', "Apprentice's Magic Mop: a long wooden handle with a BIG shaggy mop head of thick cyan-blue cotton strands, soap bubbles stuck to it and a small silver star badge on the binding" + _BIG),
        ('ep_br_goldbell', 'Fortune Gold-Bell Broom: a red-lacquered handle with gold patterns and a BIG orange-gold straw brush tied with red cord, several round gold bells and red knots hanging at the binding' + _BIG),
        # Lv1~10
        ('ep_br_cloud', 'Cotton Cloud Broom: a pale sky-blue handle with a BIG fluffy puffy white cloud as the brush head, a small yellow star charm tied at the binding with a ribbon' + _BIG),
        # Lv34 / Lv38 深渊
        ('ep_br_frostfox', 'Snow Fox Tail Broom: a birch-white handle with a BIG long fluffy white fox tail as the brush, its tip fading to ice blue with small frost crystals, a silver clasp at the binding' + _BIG),
        ('ep_br_midnight', 'Midnight Batwing Broom: a dark violet handle with a BIG deep purple bristle brush streaked with glowing lavender lines, flanked by a pair of spread bat wings with lighter violet membranes and gold claws, a small bat face with red eyes at the binding' + _BIG + _DARK),
        # Lv45 / Lv48
        ('ep_br_scarecrow', 'Scarecrow Broom: a rough wooden handle with a BIG bundle of golden wheat straw as the brush, a stitched burlap scarecrow head with button eyes and a patched brown hat at the binding' + _BIG),
        ('ep_br_chimney', 'Chimney Sweeper: a long black iron handle ending in a BIG round black bristle chimney-sweep brush (a big circular brush like a sunburst), a soot-black top hat hanging near it' + _BIG),
        # 官方新增
        ('ep_br_rescue', 'Crisis Rescuer Broom: a glossy red-and-white striped handle with a BIG white brush, a red-and-white lifebuoy ring around the binding and a little red siren light on the handle end' + _BIG),
        ('ep_br_wargod', "War God's Brow Broom: a gold-armored handle with a BIG flowing crimson horsehair plume as the brush, like a war helmet's crest, a golden winged helmet crest with a red gem at the binding" + _BIG),
        ('ep_br_dink', "Dink the Snake's Magic Broom: a black handle with a teal-and-purple snake coiling around it, a BIG star-spangled purple and gold bristle brush, a tiny black magician top hat at the binding" + _BIG + _DARK),
    ],
}
