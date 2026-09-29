"""装备 2.0 · B1a 鬼剑士武器设计（docs/GEAR_PLAN_60.md §7）：avatar_gen.py 把 DESIGNS 追加进 BOLD_EPICS，weapon_gen.py 按它出 v2 单张图。
  出图：python3 art/tools/weapon_gen.py <key,...> -j 3    切图 + 图标：python3 art/tools/avatar_weapons.py
规则（用户 2026-09-29）：刀剑一律直刃直尖（不许弯钩 / 卷尖 / 分叉尖）；巨剑要厚重霸气；每把史诗一眼认得出、彼此差别明显。
分组：Lv1~10 补齐 / 继承装备（1~30，接替搬走的官方史诗，新外观）/ Lv34 / Lv38 深渊 / Lv45 原创 / 官方 Lv50~60 新增。
"""
KT = ('. The blade is perfectly STRAIGHT like a chokuto (straight back and straight edge along the center line, no curve at all) and clearly wide, '
      'ending in a straight angled point on the center line; the tip never turns up or down')
DESIGNS = {
    'shortsword': [
        ('ep_ss_greenleaf', 'Greenleaf Shortsword: a straight leaf-shaped blade of glossy jade green with a lighter midrib vein line and small side veins engraved on it, '
                            'a crossguard made of two curled brown wooden vines with tiny leaves, a vine-wrapped wooden grip and a round acorn-shaped pommel'),
        ('ep_ss_pearl', 'Mirage Blade Sylvia: a slim straight blade of iridescent mother-of-pearl (white with pink, lilac and sky-blue opal sheen), '
                        'a silver crescent-shaped crossguard studded with three round white pearls, a lilac silk-wrapped grip and a big pearl pommel'),
        ('ep_ss_hourglass', 'Shifting Sands Shortsword: a straight translucent amber-glass blade with glittering gold sand swirling inside it, '
                            'a crossguard shaped like a small golden hourglass lying sideways, a dark brown leather grip and a gold sun-dial disc pommel'),
        ('ep_ss_violet', 'Violet Tempest: a straight deep violet steel blade with bright lilac zig-zag lightning runes painted down its center, '
                         'a silver crossguard shaped like a curling storm cloud, a black grip wrapped with violet cord and a silver pommel holding a purple gem'),
        ('ep_ss_starvow', 'Oath of the Star Path: a straight midnight-navy blade sprinkled with small gold star points joined by thin gold constellation lines, '
                          'a crossguard that is a gold astrolabe ring (a circle with an inner cross) with a blue gem in the center, a navy grip and a gold star-shaped pommel'),
        ('ep_ss_cobra', 'Crimson Scale Fang: a straight bone-white blade with a crimson snake-scale pattern down its center, the crossguard is a spread black-and-red cobra hood '
                        'with two ruby eyes, a red scaled grip and a pommel shaped like a coiled snake tail'),
        ('ep_ss_widow', 'Spider Silk Shadowblade: a straight slim dark grey-violet blade engraved with a fine silver spider-web pattern, the crossguard is a black spider '
                        'with eight short thin legs spread to both sides and a round purple gem abdomen, a black grip and a small purple gem pommel'),
        ('ep_ss_raven', "Raven's Kiss: a straight blade of black obsidian glass with a vivid crimson glowing line down its center, the crossguard is a black raven "
                        'with its small wings spread to both sides and a red gem eye, a black grip and a black feather-shaped pommel'),
        ('ep_ss_lion', 'Royal Guard Shortsword - Glory: a straight polished silver blade with gold filigree down its center, a royal-blue enamel crossguard shaped like a small crown '
                       'with a gold lion-head crest in the middle, a blue grip with gold wire and a gold lion-paw pommel'),
        ('ep_ss_barn', "Barn's Shortsword, the blade of the legendary swordsman Barn: a straight broad bright-steel blade with one deep fuller engraved with gold runes, "
                       'a heavy red-and-gold heraldic crossguard with a crest shield in the middle, a red leather grip and a gold pommel with a long red tassel'),
        ('ep_ss_hundred', 'Twin Swords - Hundred Demons Rampage: a straight dark blue-black blade covered with pale icy-blue ghost-flame patterns and small grinning ghost faces painted inside it, '
                          'the crossguard is a white oni mask with two small horns, a black-and-blue wrapped grip and a small gold pommel'),
        ('ep_ss_westflame', 'King of Ten Thousand Swords - Flame of the West: a straight blade of bright flame-orange steel with red-hot glowing flame engravings, '
                            'the crossguard is a big red-gold royal crown set with rubies, a crimson grip with gold wire and a gold sun-shaped pommel'),
        ('ep_ss_bluewraith', "Blue's Wraith Shortsword: a straight translucent spectral pale-cyan blade with wailing ghost faces and wisps trapped inside it, "
                             'a dark iron crossguard wrapped in rusty chains holding a cyan soul gem, a black grip and a small iron skull pommel'),
        ('ep_ss_hurricane', "Barn's Hurricane Shortsword: a straight gleaming silver-teal blade engraved with swirling wind spirals and streamlines, "
                            'a crossguard of two stylized silver-and-emerald wind wings swept back toward the grip, a big emerald gem, a teal grip and a spiral-shaped silver pommel'),
    ],
    'katana': [
        ('ep_kt_sakura', 'Sakura Blizzard: a pale pink blade with a white wavy temper line and small cherry blossom petals engraved along it, '
                         'a round pink tsuba shaped like a five-petal sakura flower, a white-and-pink diamond-wrapped hilt and a small sakura charm at the pommel'),
        ('ep_kt_redflame', 'Scarlet Flame Judgment Blade: a polished steel blade with a bright orange-red flame-shaped temper line along the edge, '
                           'a black hexagonal tsuba with flame-shaped cutouts, a black-and-orange wrapped hilt and a gold pommel cap'),
        ('ep_kt_falcon', 'Skysplitter - Falcon: a steel-blue blade with silver feather engravings, a bronze tsuba shaped like a pair of small spread falcon wings, '
                         'a brown wrapped hilt and a bronze falcon-head pommel with a brown feather tassel'),
        ('ep_kt_damascus', 'Nameless - Hundredfold Forged: a wide dark gunmetal blade covered with BOLD bright silver damascus wave stripes, three glowing gold rune rings engraved along it, '
                           'a big square black iron tsuba with gold inlaid corners, a gold-and-black rope-wrapped hilt and a gold pommel cap'),
        ('ep_kt_phoenix', 'Phoenix Plume Soulguard: a crimson-gold blade with golden phoenix feather patterns along its back, a gold tsuba sculpted as a phoenix head '
                          'with flame-red tail feathers spread around it, a red-and-gold wrapped hilt and a gold pommel with a red gem'),
        ('ep_kt_moonshadow', 'Dark Elf Moonshadow Blade: a purple-black blade with silver elven vine engravings and a thin glowing violet line along the edge, '
                             'a silver tsuba shaped like a crescent moon wrapped by a leaf, a dark violet wrapped hilt'),
        ('ep_kt_ferryman', 'Ferryman of the Styx: a pale ghostly teal-grey blade with swirling soul-wisp patterns, a black round tsuba with a small bronze lantern charm hanging from it, '
                           'a black-and-teal wrapped hilt and a bone-white pommel'),
        ('ep_kt_whitenight', 'White Night of the Snowfield: a snow-white blade with a pale ice-blue frost-crystal temper line, a silver hexagonal snowflake tsuba, '
                             'a white-and-ice-blue wrapped hilt and a small clear ice crystal pommel'),
        ('ep_kt_bloodmoon', 'Blood Dance Moon Blade: a deep crimson blade with swirling red petal engravings, a big round blood-red tsuba like a full moon with a black crescent cut into it, '
                            'a black-and-crimson wrapped hilt and a long red tassel'),
        ('ep_kt_siran', "Siran's Katana, the refined sword of the sword master Siran: a mirror-polished silver blade with an elegant wavy temper line, a square gold tsuba engraved with ocean waves, "
                        'a white diamond-wrapped hilt with black lacquer fittings and a navy tassel'),
        ('ep_kt_crossdou', 'Cross Slash Blade - Dou: a steel-blue blade, a big silver CROSS-shaped guard with a round blue gem in the middle, '
                           'a navy-and-silver wrapped hilt and a silver cross-shaped pommel'),
        ('ep_kt_arona', "Arona's Embrace: a gleaming rose-gold blade with a pearl-white temper line, a tsuba shaped like two small white feathered angel wings around a pink heart gem, "
                        'a white-and-rose wrapped hilt and a small gold halo ring at the pommel'),
    ],
    'club': [
        ('ep_cb_oakfang', 'Oakfang Club: a thick chunky oak-wood club head banded with two iron rings and studded with short iron nails, a string of white beast teeth tied around it, '
                          'a leather-wrapped wooden handle'),
        ('ep_cb_darkmoon', 'Dark Moon Star Mace: a big round midnight-blue mace head shaped like a dark crescent moon cradling a glowing silver star, small silver stars and short silver spikes around it, '
                           'a black-and-silver handle'),
        ('ep_cb_wolf', 'Netherwolf Soul-Eater: the head is a fierce black iron wolf head with glowing purple eyes and bared fangs, wearing a spiked collar, on a dark iron handle wrapped with purple cord'),
        ('ep_cb_urn', 'Soul-Sealing Urn Hammer: the head is a big round purple ceramic urn sealed with a bronze lid and paper talismans, pale soul wisps glowing through its cracks, '
                      'bronze bands and short spikes, a dark wooden handle'),
        ('ep_cb_bell', 'Thunder Bell Maul: the head is a big bronze temple bell lying sideways, engraved with yellow lightning-bolt runes, held by a gold dragon-shaped mount on a long bronze handle'),
        ('ep_cb_whitetiger', 'White Tiger Skyshaker: the head is sculpted as a roaring white tiger head with black stripes and blue lightning streaks and gold fangs, on a gold-and-white handle'),
        ('ep_cb_anvil', 'Anvil of Judgment: a massive anvil-shaped head of black iron and gold with a glowing crimson rune on its side and gold corner caps, on a thick black-and-red handle'),
        ('ep_cb_tombstone', 'Tombstone Maul: the head is a big grey carved gravestone with a cross relief and patches of moss, bound with heavy iron chains, on a dark iron handle'),
        ('ep_cb_plague', "Diregie's Plague Flask Mace: the head is a big round glass flask full of bubbling murky yellow-green poison held in a spiked black iron cage, "
                         'a skull-shaped stopper, on a dark bronze handle'),
        ('ep_cb_gear', 'Gear Breaker Hammer: a big mechanical hammer head made of brass gears, a steel piston and a small steam valve, riveted steel plates, on a steel handle with a black rubber grip'),
        ('ep_cb_siran', "Siran's Barbed Club: a long dark hardwood club that thickens toward the end, covered with rows of sharp steel barbs, gold bands and a navy leather grip"),
        ('ep_cb_dwarf', "Dwarf's Mighty Golden Hammer: a huge stubby block-shaped solid gold war hammer head engraved with dwarven runes, bronze bands around it and a big ruby set in its side, "
                        'on a thick gold-and-bronze handle'),
    ],
    'greatsword': [
        ('ep_gs_oak', 'Heartwood Greatsword: a huge thick slab blade of polished golden-brown oak wood with steel-lined edges and green leaf engravings, '
                      'a crossguard of twisted tree roots, a vine-wrapped grip and a round wooden pommel'),
        ('ep_gs_glacier', 'Wrath of the Glacier: a huge thick slab blade of clear pale-blue glacier ice with white frost inside and steel-blue edges, '
                          'a heavy silver crossguard shaped like jagged ice crystals, a white wrapped grip and an ice crystal pommel'),
        ('ep_gs_cleaver', 'Mountain Splitter: a colossal butcher-cleaver greatsword: a very wide rectangular dark-steel blade with a squared chisel tip and a round hole near the end, '
                          'a row of big brass rivets along the back, a black-and-bronze crossguard and a long bronze-wrapped grip'),
        ('ep_gs_bonedragon', 'Spine of the Bone Dragon: a huge blade made of bone-white dragon vertebrae fused together with a ridge of short vertebra spikes down the center, pale bone edges, '
                             'a crossguard of two dragon claws, a dark grey wrapped grip and a small dragon-skull pommel'),
        ('ep_gs_ruby', 'Crimson Crystal Demon Sword - Naraka: a huge thick blade of faceted blood-red ruby crystal growing out of a black iron hilt, lighter red facets and a dark crimson core glow, '
                       'a black iron crossguard with small crystal shards, a black grip and a red crystal pommel'),
        ('ep_gs_lionheart', 'Lionheart Warden: a huge broad gold blade with a white enamel stripe down the center, the crossguard is a roaring gold lion head with a red mane sweeping to both sides, '
                            'a red wrapped grip and a gold lion-paw pommel'),
        ('ep_gs_lavafang', 'Lava Fang Greatsword: a huge thick blade of black volcanic obsidian with glowing orange-red lava cracks running through it and a row of blunt rock teeth along both edges, '
                           'a basalt-grey crossguard, a charred grip and a glowing magma pommel'),
        ('ep_gs_blackknight', 'Oath of the Dark Knight: a huge pitch-black steel greatsword with gold trim along both edges and a gothic gold cross engraved in the center, '
                              'a spiked black gothic crossguard with a big purple gem, a black-and-purple grip and a spiked pommel'),
        ('ep_gs_siege', 'Siege Breaker: a huge industrial greatsword: a thick dark steel slab blade with a brass piston and gears mounted along its back, riveted armor plates, '
                        'a glowing orange furnace core at the base of the blade, a heavy steel crossguard and a black rubber-wrapped grip'),
        ('ep_gs_yilong', 'Yilong Sword - Resolution: a huge broad blade of white jade and silver with a slender silver Chinese dragon engraved flowing along it, '
                         'a jade-green crossguard shaped like a dragon head, a jade-and-white wrapped grip, a jade pommel and a green tassel'),
        ('ep_gs_ziwu', 'Ziwu Seven Star Sword: a huge broad dark-blue steel blade inlaid with seven glowing gold stars in the Big Dipper pattern joined by fine gold lines, '
                       'a gold crossguard shaped like a yin-yang disc, a navy grip and a gold pommel with a red tassel'),
        ('ep_gs_survivor', 'Secret of the Survivor: a huge battle-scarred greatsword: a thick grey steel blade with scratches and a bronze patch plate riveted on it, a green gem glowing at its base, '
                           'bandages wrapped around the crossguard and grip, a broken-chain charm at the pommel'),
        ('ep_gs_demonslave', 'Slave of the Demon: a huge crimson-and-black demonic blade with glowing red veins, heavy iron shackles clamped around the base of the blade with a broken chain hanging down, '
                             'a crossguard with a slit red demon eye, short bone spikes along the back edge, a black grip and a spiked pommel'),
    ],
    'lightsaber': [
        ('ep_ls_firefly', 'Firefly Lightsaber: a small bronze hilt shaped like a lantern with a leaf-shaped guard, and a straight thick warm golden-yellow energy blade with a white core '
                          'and tiny firefly light dots inside it'),
        ('ep_ls_dawn', 'Dawnbreak Lightsaber: a white-and-rose-gold hilt with a small sunrise emblem guard, and a straight thick pastel pink-to-peach gradient energy blade with a white core'),
        ('ep_ls_prism', 'Prism Blade - Refractor: a silver hilt with a big faceted clear crystal prism emitter, and a straight thick energy blade made of rainbow bands running along its length '
                        '(red, orange, yellow, blue, violet) with a white core'),
        ('ep_ls_aurora', 'Aurora Radiance: a dark navy hilt with a silver star-shaped guard, and a straight thick energy blade of shimmering aurora colors (teal flowing into violet) with a white core'),
        ('ep_ls_requiem', 'Requiem Nocturne: a silver hilt shaped like the neck and scroll of a violin with four black strings along it, '
                          'and a straight thick dark crimson-to-black gradient energy blade with a pale pink core'),
        ('ep_ls_elfstar', 'Dark Elf Starlight Saber: an elegant dark-silver elven hilt with leaf-shaped guard filigree, and a straight thick deep jade-teal energy blade with a pale core '
                          'and tiny silver star sparkles inside'),
        ('ep_ls_void', 'Void Edge: a black obsidian hilt with a floating purple ring around the emitter, and a straight thick pitch-black energy blade with a bright violet glowing rim '
                       'and a starry void inside'),
        ('ep_ls_coil', 'Gent Prototype Electromagnetic Saber: a chunky industrial steel hilt with copper coils, a small battery pack and a round gauge, '
                       'and a straight thick bright electric-blue energy blade with a white core and white lightning streaks inside'),
        ('ep_ls_tianji', 'Heaven Spine Qiankun Sword: an ornate gold-and-white hilt with a round yin-yang disc guard, and a straight thick white-gold energy blade with faint trigram line marks inside'),
        ('ep_ls_bonejail', 'Heaven Spine Bone Prison Breath: a bone-white hilt shaped like a segment of spine with a small ribcage guard and a skull-shaped emitter, '
                           'and a straight thick cold pale-blue ghostly energy blade with a white core'),
        ('ep_ls_wuxuan', "Wuxuan's Scattered Soul: a dark bronze hilt with round cutouts holding small glowing soul orbs, and a straight thick deep royal-blue energy blade "
                         'with scattered white spirit wisps floating inside'),
        ('ep_ls_branz', 'Flame Blade - Branz: a black dragon-scale hilt with red gems and flame-shaped fins, and a straight thick blazing crimson-to-orange fire energy blade '
                        'with a yellow-white core and flame patterns painted inside (the outline stays straight)'),
        ('ep_ls_icedragon', 'Wrath of the Ice Dragon: the hilt is a silver-white ice dragon head with blue gem eyes and swept-back horns, its open jaws emit a straight thick ice-blue energy blade '
                            'with a white core and frost crystal patterns inside'),
    ],
}
DESIGNS['katana'] = [(k, d + KT) for k, d in DESIGNS['katana']]   # 太刀样图刀尖上翘（用户不许弯钩卷尖）：统一追加直刀要求
# 血之挽歌（ep_ls_elegy，搬到 Lv60）旧设计（weapon_gen.py EPIC_V2）是弯钩尖，按用户「直刃直尖」重画用这段（weapon_gen.py 归主线程，改它之前用 art/tools/wdesign_sword.py 里这段手动重出）
ELEGY_STRAIGHT = ('Elegy of Blood: an ornate black-and-silver hilt wrapped in thorny vines, a big crimson rose blooming where the blade comes out and a short red ribbon hanging from the pommel; '
                  'a THICK solid blood-red energy blade with a bright pink-white core that runs perfectly STRAIGHT and ends in a straight rounded point on the center line')
