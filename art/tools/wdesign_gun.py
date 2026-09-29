# 装备 2.0 · B1b 神枪手武器的设计文字（docs/GEAR_PLAN_60.md §6 / §7）：avatar_gen.py 读进 BOLD_EPICS，weapon_gen.py 一把一张出图
# DESIGNS = { 类型: [(key, 设计), ...] }；每把都要一眼认得出、互相不像：主色 + 招牌部件（枪口 / 弩臂 / 枪身造型）各不相同。
# 枪要“大而清楚”：设计里写粗壮的枪身和大号招牌部件，1 倍拿在手里也看得出是哪一把。不用纯绿 / 品红。
BIG = 'Chunky oversized proportions: a thick body and a big bold signature part that reads clearly at small size'

DESIGNS = {
    'revolver': [
        # 继承装备（Lv1~30，接替搬到官方等级的左轮）
        ('ep_rv_rider', 'Wasteland Rider: a rugged frontier revolver with a long octagonal blued-steel barrel, a brass cylinder engraved with a horseshoe, '
                        'a big tan leather-wrapped grip studded with round silver conchos and a short fringe of leather tassels hanging below the grip. ' + BIG),
        ('ep_rv_scarlet', 'Scarlet Edge Revolver: a crimson-and-silver gunblade revolver with ONE long curved crimson blade mounted UNDER the barrel and reaching past the muzzle like a bayonet, '
                          'a silver cylinder engraved with roses, a black grip with a red silk tassel. ' + BIG),
        ('ep_rv_frostfang', 'Frost Fang: an ice-white and pale-blue revolver whose muzzle is an open snarling wolf head with icy fangs, a row of jagged ice crystals along the top of the barrel, '
                            'a frosted silver cylinder and a dark navy grip wrapped in white fur. ' + BIG),
        ('ep_rv_cobra', 'Crimson Cobra .45: a heavy long-barreled revolver of dark crimson and black; a red-scaled cobra rises along the top of the barrel and spreads its wide hood over the muzzle, '
                        'glowing amber gem eyes, a black cylinder with a red scale pattern, a black grip with silver inlay. ' + BIG),
        # 原创 Lv34 / 38 / 45 / 48
        ('ep_rv_moonshade', 'Moonshade Silver Bullet: a sleek dark-elf revolver of midnight-blue steel and silver, a big crescent-moon shaped silver blade fin standing on top of the barrel, '
                            'a cylinder with six glowing pale-blue moonstone chambers, an elegant curved dark wood grip ending in a silver crescent pommel. ' + BIG),
        ('ep_rv_plague', 'Plague Doctor: a grim revolver whose long barrel ends in a big curved bone-white plague-doctor beak mask with two round red glass eye lenses, '
                         'an old riveted bronze frame, a cylinder holding small glass vials of murky olive-yellow liquid, a dark brown leather grip wrapped in bandages. ' + BIG),
        ('ep_rv_glacier', 'Glacier Marshal: a massive heavy-frame revolver of black iron with thick white frost and snow caps along the top of a THICK square barrel, a huge gold sheriff star on the side of the frame, a big round black cylinder and a bright red-and-white striped grip; no blue ice crystals. ' + BIG),
        ('ep_rv_gendarme', 'Gendarme Service Revolver: a heavy revolver of polished white steel with deep jade-green enamel panels, a big round cylinder engraved with a gold eagle crest, a short thick barrel ending in a big square muzzle brake, a black grip with a jade-and-gold braided cord hanging from it; no blue. ' + BIG),
        # 官方新增（70 版 Lv60 / 官方 Lv65）
        ('ep_rv_belit', "Belit's Imprint Revolver: a desert revolver with a carved sandstone-gold frame covered in glowing amber hieroglyph imprints, a black obsidian barrel ending in a scarab-beetle shaped muzzle, "
                        'a sand-swirl engraved cylinder and a dark wrapped grip with a hanging amber gem. ' + BIG),
        ('ep_rv_firesnake', 'Ultimate Fire Serpent: a blazing revolver whose long barrel is the body of a fire serpent with overlapping orange-red scales and a row of flame-shaped fins along the top and bottom, '
                            'the muzzle is a black iron serpent skull with glowing lava eyes, an obsidian cylinder with glowing orange lava cracks, a black-and-gold grip. ' + BIG),
    ],
    'autopistol': [
        ('ep_ap_dawn', 'Dawn Star: a cheerful starter pistol of white enamel and warm gold, a big gold half-sun emblem with rays on the side of the slide, a soft orange stripe along the slide, '
                       'a white grip with a small gold star. ' + BIG),
        ('ep_ap_rattler', 'Rattler Fang: a pistol of dark brown and black with a bold black-and-tan diamond-back rattlesnake scale pattern (no gold), two big curved bone-white fangs pointing down under the muzzle, and a segmented bone-white rattlesnake rattle hanging from the bottom of the grip. ' + BIG),
        ('ep_ap_gale', 'Gale Pistol: a streamlined jade-teal and silver pistol shaped like a swooping swallow, big swept-back feather-shaped fins on top of the slide, a pointed beak-like muzzle, '
                       'pale wind-swirl engravings and a silver grip. ' + BIG),
        ('ep_ap_forge', 'Furnace Heart: a stocky black iron pistol built like a tiny furnace, a round grated furnace door on the side of the slide showing glowing orange coals inside, '
                        'brass pipes, cooling fins on the barrel and a riveted black grip. ' + BIG),
        ('ep_ap_weaver', 'Web Weaver: a dark violet-black pistol with eight thin jointed silver spider legs curling out from the slide, a round spider-body chamber with red gem eyes on top, '
                         'silver cobweb engravings on the grip. ' + BIG),
        ('ep_ap_soullantern', 'Soul Lantern: a gothic pistol of black iron with an old square lantern built into the frame holding a glowing pale-blue ghost flame, '
                              'a long barrel ending in a small silver skull, a short chain with a little bell hanging under the barrel, a dark grip. ' + BIG),
        ('ep_ap_gear', 'Clockwork Heart: a steampunk brass-and-copper pistol with big exposed gears on the side of the slide, a round pressure gauge, copper tubes, a small steam valve and a dark walnut grip. ' + BIG),
        ('ep_ap_bulwark', 'Bulwark Warden: a heavy royal-guard pistol of white steel and gold, a thick slide with a gold shield emblem and a small lion head, a bulky square muzzle, a royal blue grip with gold trim. ' + BIG),
        ("ep_ap_energy", "Mecca's Energy Pistol: a futuristic dark gunmetal energy pistol with a glowing electric-blue energy core visible through the frame, three glowing blue coil rings around the barrel, "
                         'cooling vents and a black grip with blue light lines. ' + BIG),
        ('ep_ap_reaper', 'Desert Reaper: a sinister pistol with a bone-white and sand-gold body, a curved black scythe blade mounted along the underside and reaching forward past the muzzle, '
                         'a horned ram skull with glowing red eyes on the side of the frame, black tattered cloth wrapped around the grip. ' + BIG),
    ],
    'rifle': [
        ('ep_rf_falcon', "Falcon's Eye: a light hunting rifle with a warm honey-colored wooden stock, a slim steel barrel, a small brass scope, and a charm of brown-and-white falcon feathers tied under the barrel. " + BIG),
        ('ep_rf_verdict', 'Silent Verdict: a long dark navy and silver sniper rifle with a very long thick silencer tube, a big silver scope, a gold judge-gavel emblem on the stock and white crosshair engravings. ' + BIG),
        ('ep_rf_thunderhorn', 'Thunder Horn: a heavy rifle of dark steel and gold whose barrel flares into a big brass war-horn shaped muzzle, yellow lightning-bolt engravings along the barrel, a dark wooden stock. ' + BIG),
        ('ep_rf_frostgrave', 'Frostgrave Hunter: a long rifle of weathered grey-blue iron with a coffin-shaped wooden stock bound with iron bands, a big ice-crystal scope, '
                             'a silver stake-shaped bayonet under the muzzle and small frost shards along the barrel. ' + BIG),
        ('ep_rf_magma', 'Magma Piercer: a long heavy rifle of black volcanic rock with glowing orange lava cracks, a spiral drill-shaped obsidian muzzle and a bronze scope. ' + BIG),
        ('ep_rf_bloodmoon', 'Blood Moon Hunter: a gothic long rifle of black iron and crimson, a big round blood-red moon disc mounted above the middle behind the scope, '
                            'bat-wing shaped fins on the stock and silver filigree along the barrel. ' + BIG),
        ('ep_rf_snowhunter', 'Snowfield Hunter: a sturdy white-and-steel hunting rifle with a white fur-wrapped stock, a big round snowflake-shaped muzzle brake, an ice-blue scope and a brown leather strap. ' + BIG),
        ('ep_rf_beacon', 'Beacon Eye: a war rifle of dark bronze and red with a long barrel ending in a flame-crowned beacon-tower shaped muzzle, a round scope with a glowing orange lens, '
                         'a red-and-gold banner cloth tied to the stock. ' + BIG),
        ("ep_rf_mechgod", "Mech War God's Battle Rifle: a bulky high-tech battle rifle of steel-grey and gold armor plates, a big rectangular magazine, two stacked barrels with glowing orange energy vents, "
                          'and a mechanical war-god helmet emblem on the side. ' + BIG),
        ('ep_rf_ninedragon', 'Nine Dragons Fiend-Breaker Rifle: a majestic long rifle of crimson lacquer and gold, a crest of small golden dragon heads along the top rail, the largest golden dragon head forms the muzzle '
                             'holding a white pearl, gold cloud patterns on the stock. ' + BIG),
    ],
    'handcannon': [
        ('ep_hc_firework', 'Festival Firework Cannon: a cute festive hand cannon with a fat red barrel like a paper lantern with gold bands, a flared gold muzzle, a short fuse on top and a red-and-gold striped grip. ' + BIG),
        ('ep_hc_twinstar', 'Twin Flame Stars: a deep blue hand cannon covered with golden star patterns, a huge five-pointed-star shaped muzzle rim of glowing orange, two small star emblems on the side. ' + BIG),
        ('ep_hc_rockcrush', 'Rock Crusher: a brutal hand cannon built from rough grey stone blocks bound by iron straps, a huge square cracked stone muzzle and a wooden grip. ' + BIG),
        ('ep_hc_tide', 'Tide Watcher: a sea-themed hand cannon whose barrel is a big pearl-white and coral conch shell, the conch opening is the muzzle, blue wave engravings and a coral-red grip. ' + BIG),
        ('ep_hc_bell', 'Holy Bell Salute: a ceremonial hand cannon whose barrel is a big golden church bell lying sideways (the bell mouth is the wide muzzle), white ribbons and a small silver cross, a white grip. ' + BIG),
        ('ep_hc_goliath', "Giant's Hammer: a massive hand cannon made from a giant's forged war-hammer head, a huge square iron hammer head at the front with the muzzle hole in its face, bronze straps "
                          'and a thick wooden grip wrapped in rope. ' + BIG),
        ('ep_hc_cathedral', 'Crimson Cathedral: a hand cannon shaped like a gothic cathedral spire lying sideways, dark stone with a round blood-red stained-glass rose window on the side, '
                            'an iron gargoyle head forming the muzzle. ' + BIG),
        ('ep_hc_ironbull', 'Iron Bull Cannon: a mechanical hand cannon whose muzzle is a riveted dark steel bull head with two big curved horns and glowing red eyes, two short smokestack pipes on top. ' + BIG),
        ('ep_hc_siege', 'Siege Tower: a hand cannon whose fat barrel looks like a round grey stone castle tower with crenellations along the top, an iron portcullis grate around the wide muzzle '
                        'and royal blue banners hanging from it. ' + BIG),
        ('ep_hc_dragon', 'Miracle Dragon Cannon: a huge hand cannon whose barrel is a bronze-red scaled western dragon head with open jaws as the muzzle and a glowing orange throat, '
                         'folded dragon wings along the sides of the barrel. ' + BIG),
    ],
    'bowgun': [
        ('ep_bg_feather', 'Teal Plume Crossbow: a light hunter hand crossbow whose bow limbs are big curved teal-and-white feathers, a light wooden stock and a loaded bolt with teal fletching. ' + BIG),
        ('ep_bg_raven', 'Night Raven: a black hand crossbow whose bow limbs are spread raven wings of glossy black feathers, a raven skull at the front with a small purple gem eye, dark silver fittings. ' + BIG),
        ('ep_bg_phoenix', 'Flame Phoenix: a crimson-and-gold hand crossbow whose bow limbs are flaming phoenix wings of orange and gold feathers, a phoenix head at the front and a long flowing tail feather under the stock. ' + BIG),
        ('ep_bg_whisper', 'Abyss Whisper: a dark indigo hand crossbow whose bow limbs are two curling black tentacles with glowing violet suckers, one big staring golden eye at the front, silver thorn fittings. ' + BIG),
        ('ep_bg_graveward', 'Graveyard Watchman: a grim hand crossbow with a weathered dark wooden stock studded with iron nails, a grey tombstone-shaped front plate, '
                            'dark iron limbs, and a small iron lantern with a warm yellow flame hanging under the front. ' + BIG),
        ('ep_bg_spiderqueen', 'Venom Spider Queen: a hand crossbow whose bow limbs are long jointed black spider legs with purple-red tips, a big black spider body with a red hourglass mark on the front, '
                              'and a loaded bolt with a violet venom tip. ' + BIG),
        ('ep_bg_icestring', 'Ice Crystal String: a hand crossbow whose bow limbs are two large sharp pale-blue ice-crystal blades, a big white snowflake emblem at the front, a frosted silver stock. ' + BIG),
        ('ep_bg_hivesting', 'Hive Queen Sting: a hand crossbow with a honey-gold and black striped body like a giant wasp abdomen, translucent amber insect-wing bow limbs and a big stinger-shaped bolt. ' + BIG),
        ('ep_bg_tianxuan', 'Tianxuan Soulreaver: an elegant oriental hand crossbow of white jade and dark silver, bow limbs shaped like sweeping cloud scrolls, a glowing pale-cyan soul orb at the front and red tassels. ' + BIG),
        ('ep_bg_doom', 'Doom Punisher: a massive hand crossbow of black iron and blood-red, bow limbs made of two huge jagged executioner blades, a horned demon mask at the front, chains wrapped around the stock. ' + BIG),
        ('ep_bg_sky', 'Sky Punisher: a heavenly hand crossbow of white marble and gold, bow limbs shaped like two big golden sun-ray crescents, a big sky-blue star crystal at the center, blue-and-white cloud patterns. ' + BIG),
    ],
}
