"""团本专属美术设定（希洛克 / 安徒恩 / 奥兹玛）：角色 / 背景 / 图标的数据，供 raid_art.py 使用。
精灵名统一前缀 raidSi* / raidAn* / raidOz*（全局唯一）；h = 站立高度（世界单位，玩家约 115）。
kind: boss / elite / mob。【原创】= 官方资料缺口，按官方风格 + 原创细节设计。
"""


def C(kind, cn, h, desc, hold, atk, cast, low, use='', **kw):
    d = dict(kind=kind, cn=cn, h=h, desc=desc, hold=hold, atk=atk, cast=cast, low=low, use=use)
    d.update(kw); return d


def FLY(kind, cn, h, desc, atk, cast, low, use='', hover=30, **kw):
    return C(kind, cn, h, desc, None, atk, cast, low, use, fly=True, hover=hover, **kw)


def QUAD(kind, cn, h, desc, atk, cast, low, use='', **kw):
    kw.setdefault('cycle', 'trot')
    return C(kind, cn, h, desc, None, atk, cast, low, use, **kw)


# ============================== 希洛克（魔界 · 靛紫 / 白瓷面具 / 暗金） ==============================
SI_CHARS = {
    # ---- 领主（8）：现有 11 套精灵换色里辨识度最差的 ----
    'raidSiHanir': C('boss', '魅惑之哈妮尔', 112, 'Hanir the Charmer, a boss of the Siroco raid (tier of the Wit gate): a graceful demon dancer-sorceress with long wavy rose-pink hair and curled small horns, half-lidded amber eyes, a plum and gold sheer veil outfit with a long trailing sash, thin gold chains and bells on wrists and ankles, a small heart-shaped mirror hanging at the waist, barefoot.',
                     'with a heart-shaped hand mirror in one hand', 'the sash whipping forward', 'raising the hand mirror as the sash floats up', 'twirling low with the sash trailing', '魅惑 / 传心机制领主（哈妮尔）'),
    'raidSiVita': C('boss', '慈悲之维塔', 124, 'Vita the Merciful, a boss of the Siroco raid (Pain gate): a tall serene demon priestess with long snow-white hair, a blindfold of white cloth with a gold eye emblem, a long pure white and pale gold robe with big wide sleeves, a halo ring of gold behind her head, small pale feathered wings, gentle smile, holding a tall golden staff with a hanging bell.',
                    'holding a tall golden bell staff', 'the bell staff swinging forward', 'raising the staff high as the sleeves spread', 'bowing low with the staff held forward', '慈悲 / 回复类领主（维塔）'),
    'raidSiNexJustice': C('boss', '公义之奈克斯', 130, 'Nex of Justice, a boss of the Siroco raid: a tall armored demon knight-woman in dark navy steel plate with gold judgement-scale motifs on the shoulders, a long flowing crimson cape, a tall crested helmet with a visor slit, holding a huge two-handed scale-bladed sword and a hanging pair of small golden balance scales at the belt.',
                          'holding a huge scale-bladed greatsword', 'the greatsword swung in a wide arc', 'planting the greatsword and raising one hand', 'lowering the shoulder with the greatsword held back', '公义之奈克斯（区别于普通奈克斯：披甲骑士）'),
    'raidSiRodos': C('boss', '洛多斯', 128, 'Rodos, a boss of the Siroco raid: a heavy bull-headed demon colossus with a blackened iron bull mask and curved bronze horns, a broad chest covered with rusty chain harness and spikes, thick forearms wrapped in iron bands, a ragged dark red loincloth, holding a huge chain-linked iron flail ball.',
                     'holding a huge chained iron flail ball', 'the flail ball swung overhead and smashed down', 'raising the flail ball high with both hands', 'charging forward with the head lowered and the flail dragging', '重型破招领主（洛多斯）'),
    'raidSiGusdi': C('boss', '古斯迪', 118, 'Gusdi, a boss of the Siroco raid: a gaunt hunched demon engineer-alchemist with a pointed pale grey face, round brass goggles, a dark leather apron full of vials and tools, patchwork dark teal coat, mechanical brass claw replacing the left hand, a big backpack with bubbling glass tanks and copper pipes.',
                     'holding a large brass wrench-claw', 'the brass claw clamping forward', 'raising the claw as the backpack tanks glow', 'crouching low and scuttling forward', '机关 / 毒雾类领主（古斯迪）'),
    'raidSiGulumi': C('boss', '咕噜米', 96, 'Gulumi, a boss of the Siroco raid: a short round plump demon creature like a grinning puppet-clown, a big cracked white porcelain face with a wide stitched smile and sunken black eyes, a patchwork jester suit of purple and mustard, a three-pointed jester hat with small bells, thin long arms, holding a rusty music-box on a stick.',
                      'holding a rusty music-box on a stick', 'swinging the music-box forward', 'holding the music-box up with both hands', 'hopping forward low', '小丑 / 召唤类领主（咕噜米）'),
    'raidSiRena': C('boss', '蕾娜', 108, 'Rena, a boss of the Siroco raid: a fierce young demon huntress with short messy white-silver hair, one eye covered by a black patch and the other glowing blood red, a cropped black leather jacket with a fur collar, torn dark red scarf, strapped belts and bandages, a long slim bow with a thin black string and a quiver of dark arrows.',
                     'holding a long slim black bow', 'swinging the bow like a staff', 'drawing the bow string back with an arrow', 'dashing forward very low with the bow held back', '远程 / 追踪类领主（蕾娜）'),
    'raidSiMinhao': C('boss', '明皓', 118, 'Minghao, a boss of the Siroco raid: a calm slim young swordsman-monk with a topknot of long black hair, a white and indigo wide-sleeved robe with gold cloud embroidery, a pale ghostly face with closed eyes and a red mark on the forehead, wooden prayer beads around the neck, holding a slim long sword in a dark scabbard.',
                      'holding a long slim sword', 'the long sword slashing in a clean arc', 'holding the sword upright before the face with both hands', 'lunging forward low with the sword drawn back', '剑修 / 反击类领主（明皓）'),
    # ---- 精英（6） ----
    'raidSiKula': C('elite', '崔拉', 108, 'Kula, one half of the twin demon sisters of the Siroco raid: a slim girl with a glossy dark violet bob haircut and a single curled horn on the left, a gold-trimmed black short dress with an asymmetric cape, one glowing violet orb floating in her palm, mischievous smile.',
                    'holding a glowing violet orb in the front hand', 'tossing the orb forward', 'raising the orb overhead with both hands', 'dashing forward low', '双生精英：崔拉（紫球）'),
    'raidSiTanna': C('elite', '昙娜', 108, 'Tanna, the other half of the twin demon sisters of the Siroco raid: a slim girl with a glossy pale blue-silver bob haircut and a single curled horn on the right, a silver-trimmed white short dress with an asymmetric cape, one glowing icy cyan orb floating in her palm, shy smile. A mirror image in color scheme of her sister.',
                     'holding a glowing cyan orb in the front hand', 'tossing the orb forward', 'raising the orb overhead with both hands', 'dashing forward low', '双生精英：昙娜（青球）'),
    'raidSiCrone': C('elite', '老妪', 92, 'The Crone, an elite of the Siroco raid: a tiny hunched old witch with a huge crooked nose, wrinkled grey-green skin, a big patched dark violet shawl and a pointed wide-brim hat with a white porcelain mask pinned on it, thin claw-like fingers, holding a gnarled wooden crutch hung with small masks and a lantern.',
                     'holding a gnarled crutch with small masks', 'the crutch poking forward', 'raising the crutch as the hanging masks swing', 'creeping forward low', '精英：老妪（诅咒 / 召唤）'),
    'raidSiGate': C('elite', '门之守卫', 128, 'The Gate Guard elite of the Siroco raid: a huge animated standing stone door-golem, a tall rectangular black stone slab body with a glowing indigo keyhole in the chest, heavy iron hinges as shoulders, thick stone arms ending in iron door-ring fists, a pair of small glowing eyes carved at the top, chains hanging from the arms.',
                     None, 'both iron-ring fists slamming forward', 'raising both fists as the keyhole glows', 'leaning the whole slab forward low', '精英：门（破门 / 钥匙图）'),
    'raidSiGenbu': C('elite', '玄武', 112, 'Genbu, an elite of the Siroco raid: a squat powerful turtle-warrior of the demon realm, a huge dark teal tortoise shell on the back with gold ring patterns, a small armored turtle head with a stern face, a thick short snake-tail with fangs, strong stubby legs, holding a heavy round shield.',
                     'holding a heavy round shell shield', 'the shield bashing forward', 'raising the shield overhead as the shell glows', 'ducking behind the shield and charging low', '精英：玄武（龟壳 / 破壳）'),
    'raidSiDisguiser': C('elite', '伪装者', 104, 'The Disguiser, an elite of the Siroco raid: a lanky shapeshifter demon in a plain brown commoner coat that is open at the chest, showing a smooth faceless white porcelain body inside, a half-melted smiling porcelain mask hanging at the side of the head, long thin arms, holding a short rusty dagger.',
                         'holding a short rusty dagger', 'the dagger stabbing forward', 'spreading the coat wide to reveal the faceless body', 'lunging forward low with the dagger', '精英：伪装者（假扮 / 分身）'),
    # ---- 小怪（4） ----
    'raidSiGrimFollower': C('mob', '被侵蚀的格里姆希克教徒', 92, 'A corrupted Grimshick cultist of the Siroco raid: a small hunched cultist in a tattered grey hooded robe with eroded violet veins crawling over the skin, glowing white eye sockets, a ragged rope belt, bare feet, clutching a cracked wooden prayer rod.',
                            'holding a cracked wooden prayer rod', 'the prayer rod jabbing forward', 'raising the prayer rod as violet cracks glow on the hands', 'stumbling forward low', '小怪：教徒'),
    'raidSiGrimWarrior': C('mob', '被侵蚀的格里姆希克战士', 112, 'A corrupted Grimshick warrior of the Siroco raid: a sturdy cultist soldier in dented dark iron armor with a skull-shaped helmet, eroded violet veins cracking through the armor, a tattered grey tabard with a torn cult sigil, holding a heavy rusty cleaver and a small buckler.',
                            'holding a heavy rusty cleaver', 'the cleaver chopping down', 'raising the cleaver overhead and roaring', 'charging forward low with the buckler', '小怪：战士'),
    'raidSiGrimElder': C('mob', '被侵蚀的格里姆希克上级教徒', 104, 'A corrupted Grimshick senior priest of the Siroco raid: a tall thin cultist in a long black and violet ceremonial robe with a tall pointed gold-trimmed hat, a half-eroded cracked white mask, long thin fingers with ring jewels, holding a hooked ritual censer on a chain.',
                         'holding a hooked ritual censer on a chain', 'swinging the censer forward', 'raising the censer high as the robe flutters', 'gliding forward low', '小怪：上级教徒（施法）'),
    'raidSiShard': C('mob', '希洛克的碎片', 88, 'A shard of Siroco: a small ghostly doll-like copy of the stalker woman, a child-sized body of black-violet shadow with long flowing hair, one big white porcelain mask for a face with violet glowing cracks, tattered hooded cloak, wispy shadow hem instead of feet, small clawed hands.',
                     None, 'its small claws raking forward', 'raising both hands as small masks orbit', 'gliding forward low with claws out', '小怪：碎片', fly=True, hover=16),
}
for _n in ('raidSiShard',): SI_CHARS[_n]['hold'] = None

SI_ICONS = {   # 3×2 一张，key → 描述
    'raidsi_a': [
        ('raid_si_petal', 'a single glowing deep violet flower petal with a gold edge floating above a tiny crystal dish, the raid currency, soft violet light'),
        ('raid_si_memory', 'a glowing shard of broken white glass containing a tiny memory scene of a cracked porcelain mask, indigo sparkles'),
        ('raid_si_mirror', 'a cracked round hand mirror with a dark gold frame, a red tearful eye reflected in the glass, crimson crack lines'),
        ('raid_si_gatekey', 'an ornate black iron key with a violet gem in the bow and tiny chains, glowing indigo runes along the shaft'),
        ('raid_si_hourglass', 'a small gothic hourglass with violet sand and bat-wing frame, the sand glowing, countdown puzzle object'),
        ('raid_si_mask', 'a white porcelain theatre mask with violet glowing cracks and gold trim, small and cute, floating'),
    ],
    'raidsi_b': [
        ('raid_si_resonance', 'two small crystal orbs, one violet and one cyan, joined by a thin glowing line, resonance puzzle object'),
        ('raid_si_orb_violet', 'a single glowing violet energy orb inside a small dark gold cage, twin sister orb puzzle object'),
        ('raid_si_orb_cyan', 'a single glowing icy cyan energy orb inside a small silver cage, twin sister orb puzzle object'),
        ('raid_si_coffin', 'a tiny upright black coffin with white porcelain masks and violet ribbons, the shadow coffin raid emblem'),
        ('raid_si_scale', 'a small golden balance scale with one dark pan and one light pan, tiny gems, judgement puzzle object'),
        ('raid_si_pass', 'a dark violet raid pass ticket with a gold eye emblem and a torn corner, glowing edges'),
    ],
}

# ============================== 安徒恩 Neo（巨兽体内：冷灰蓝黑雾 → 红黑岩浆 → 红色肉质心脏） ==============================
AN_CHARS = {
    # ---- 领主（8） ----
    'raidAnNerbe': C('boss', '歼灭之内尔贝', 126, 'Nerbe the Annihilator, a boss inside the giant beast Antuen: a tall cold mechanical-demon gunner in dark steel-blue armor with a cracked grey bone-white mask-helm, glowing icy cyan eyes, a heavy shoulder cannon, thick power cables hanging from the back, tattered grey cloak, holding a long electrical rifle-lance with a crackling coil head (drawn plain).',
                     'holding a long coil rifle-lance', 'the rifle-lance thrusting forward', 'raising the rifle-lance as the shoulder cannon opens', 'crouching low and charging forward', '歼灭之内尔贝（拦截电球）'),
    'raidAnTaiori': C('boss', '毁灭之塔伊奥利', 132, 'Taiori the Destroyer, a boss inside the giant beast Antuen: a huge crimson-black armored demon warlord with spiked shoulder plates, a horned iron crown-helmet with an ember-orange glowing slit, molten cracks across the chest plate, a tattered black war banner on the back, holding a gigantic black war hammer with a red-hot head (drawn plain).',
                      'holding a gigantic black war hammer', 'the war hammer smashing down', 'raising the hammer overhead with both hands', 'charging forward low with the shoulder', '毁灭之塔伊奥利（A/B 机制）'),
    'raidAnFreines': C('boss', '湮灭之弗雷伊内斯', 120, 'Freines the Obliterator, a boss inside the giant beast Antuen: a slender ghostly demon assassin-mage in a layered black and dark violet cloak, face hidden by a pale oval mask with a single vertical red slit, long grey-white hair, several faint translucent mirror-shards floating behind her back, thin long fingers, holding a thin curved void-blade.',
                       'holding a thin curved dark blade', 'the thin blade slashing across', 'raising both hands as mirror shards float around', 'dashing forward very low', '湮灭之弗雷伊内斯（击杀幻影）'),
    'raidAnAgnes': C('boss', '炽炎之艾格尼丝', 124, 'Agnes the Blazing, a boss inside the giant beast Antuen: a tall demon flame-sorceress with long swept-back hair of orange-red embers, three glowing amber eyes (one big eye open on the forehead), a black and ember-red layered robe with molten gold trim, charred horns, long clawed hands, holding a staff topped by a large closed-lidded eye orb.',
                     'holding a staff topped with a big eye orb', 'the eye staff striking forward', 'raising the staff as the forehead eye opens wide', 'gliding forward low', '炽炎之艾格尼丝（睁眼禁攻）'),
    'raidAnMagta': C('boss', '全能之玛特伽', 138, 'Magta the Omnipotent, a boss inside the giant beast Antuen: a gigantic obsidian-black volcano-golem demon with a body of cooled lava plates and glowing orange magma seams, a small horned head with white-hot eyes sunk in the shoulders, huge asymmetric arms (a giant stone claw and a giant cannon fist), a crown of jagged rock spikes.',
                     None, 'the giant stone claw smashing forward', 'raising both arms as the magma seams brighten', 'bracing the shoulder and pushing forward low', '全能之玛特伽（黑色火山，破招破防）'),
    'raidAnMedil': C('boss', '深渊之梅迪尔', 122, 'Medil of the Abyss, a boss inside the giant beast Antuen: a deep-sea style demon cultist in a dark teal-black robe with a hood shaped like an anglerfish, a glowing pale blue lure hanging in front of the hood, gaping dark void where the face should be with tiny white eyes, long tentacle-like sleeves ending in claws, bone-white rope belt with small skulls.',
                     None, 'the long tentacle sleeves lashing forward', 'spreading both arms as the lure glows', 'crawling forward low with the sleeves dragging', '深渊之梅迪尔（深渊吞噬）【原创】'),
    'raidAnHeart': C('boss', '安徒恩的心脏', 150, 'The Heart of Antuen, the final boss: a gigantic living red fleshy heart creature standing on thick pulsing arterial legs, a glossy dark crimson muscular body with thick veins and bulging valves, a ring of small fleshy tendrils on top, a single huge white-yellow eye embedded in the chest, thick tubes hanging down like arms with bony claws, wet and glossy.',
                     None, 'its bony-clawed tubes smashing forward', 'rearing up as the veins bulge and the chest eye opens', 'lunging forward low on the thick legs', '安徒恩的心脏（最终领主，红色肉质）', fly=False),
    'raidAnCaptain': C('boss', '苍穹贵族号舰长', 118, 'The Captain of the sky-ship Noble, a boss inside the giant beast Antuen【original design】: a once-proud human-demon naval officer corrupted by black fog, a long cold grey-blue greatcoat with tarnished silver epaulettes and a tricorn captain hat, pale cracked skin with dark fog leaking out of the eyes and collar, a ghostly grey scarf, holding a ship-wheel shaped shield and a rusty cutlass.',
                       'holding a rusty cutlass', 'the cutlass slashing across', 'raising the cutlass as black fog swirls from the coat', 'lunging forward low with the cutlass', '苍穹贵族号舰长（P1 阻截领主）【原创】'),
    # ---- 精英（8） ----
    'raidAnDevourer': C('elite', '吞噬魔', 128, 'The Devourer, an elite inside the giant beast Antuen: a bloated hungry demon with a huge round belly that is a gaping toothy maw with three glowing slots of red, orange and blue elemental light on the belly, short thick legs, thin arms, small horned head with sleepy eyes, wearing a torn black harness with chains.',
                        None, 'the big belly maw lunging forward to bite', 'opening the belly maw wide with the slots glowing', 'waddling forward low with the belly dragging', '吞噬魔（属性球破防）'),
    'raidAnMoltenWorm': C('elite', '熔岩怪虫', 84, 'The Molten Larva, a hatchery elite inside the giant beast Antuen: a thick segmented lava-worm monster with a glossy dark red body, glowing orange magma lines between the segments, a round mouth ringed with sharp teeth, a hard black shell plating on its back, six short legs.',
                          None, 'its toothy mouth snapping forward', 'rearing up its front body as the back shell opens', 'wriggling forward low', '孵化所精英：熔岩怪虫（破壳）', cycle='crawl'),
    'raidAnPatrolMelta': C('elite', '巡视者梅尔塔', 118, 'Patroller Melta, a hatchery elite inside the giant beast Antuen: a tall lean demon sentry in a black iron shell armor with a long beak-like faceplate, a single round red lens eye, long scythe-like forearm blades, a tattered dark grey cape, thin digitigrade legs, a small lantern on the belt.',
                           None, 'the forearm blades slashing crosswise', 'spreading the arms as the red lens eye flares', 'dashing forward low with the blades back', '孵化所精英：巡视者梅尔塔'),
    'raidAnCrusherAtor': C('elite', '粉碎者阿托尔', 134, 'Crusher Ator, a hatchery elite inside the giant beast Antuen: a huge hulking demon brute with dull red stone-like skin, a tiny head and an enormous right arm shaped like a gigantic rock-crusher fist with iron spikes, a left arm bound in thick chains, a thick leather belt with bone trophies, heavy stomping legs.',
                           None, 'the giant crusher fist slamming down', 'raising the giant fist overhead', 'charging forward low with the fist dragging', '孵化所精英：粉碎者阿托尔'),
    'raidAnHorrorWraith': C('elite', '恐怖邪念体', 112, 'The Horror Wraith, a hatchery elite inside the giant beast Antuen: a tall floating ghostly mass of dark purple-black mist shaped like a tattered robe with no legs, a pale elongated skull face with a stretched silent scream and hollow glowing red eyes, many long thin dark hands reaching out of the mist.',
                            None, 'the long thin hands grabbing forward', 'spreading the many hands as the mist swells', 'swooping forward low', '孵化所精英：恐怖邪念体', fly=True, hover=22),
    'raidAnEgalle': C('elite', '吞噬之厄伽勒', 126, 'Egalle the Devouring, an elite inside the giant beast Antuen: a rotund six-armed demon glutton in a stained bone-white and dark red butcher apron, a huge toothy grin across a wide flat face, tiny gold ring earrings, every hand holding a cleaver or hook, a big iron pot helmet.',
                       'holding a huge butcher cleaver', 'the cleaver chopping down', 'raising all arms with the cleavers and hooks', 'waddling forward low with the cleavers back', '吞噬之厄伽勒（精英）'),
    'raidAnCannonGuard': C('elite', '舰炮守卫', 124, 'The Cannon Guard, an elite of the sky-ship Noble inside the giant beast Antuen【original design】: a heavy armored automaton gunner of cold grey-blue steel with a round porthole-like glowing amber eye, a big left arm that is a short ship cannon, a right arm with a clamp, brass rivets and rust streaks, small steam vents, a faded noble crest on the chest.',
                           None, 'the clamp arm punching forward', 'raising the cannon arm as the amber eye glows', 'rolling forward low on its heavy legs', '舰炮防御战精英：舰炮守卫【原创】'),
    'raidAnInfectedBrood': C('elite', '感染孵化体', 112, 'The Infected Broodmother, an elite of the purple infected hatchery inside the giant beast Antuen【original design】: a bulging pale-purple spider-like egg-carrier demon with a swollen translucent egg sac on its back full of tiny dark larvae, four crooked spindly legs, a small fanged face with many red eyes, purple infection veins across the body.',
                             None, 'its front legs stabbing forward', 'rearing up as the egg sac pulses', 'scuttling forward low', '紫色感染孵化场精英：感染孵化体【原创】', cycle='crawl'),
    # ---- 小怪（6） ----
    'raidAnFogWisp': FLY('mob', '黑雾游魂', 84, 'A black-fog wisp inside the giant beast Antuen: a small floating ghost of dense grey-blue fog shaped like a tattered shroud, two dim white eyes, thin trailing wisps instead of legs, a few ghostly hands, cold and gloomy.', 'its ghostly hands raking forward', 'swelling larger as the fog thickens', 'drifting forward low', '小怪：黑雾游魂', hover=24),
    'raidAnHullCrawler': C('mob', '船壳爬虫', 64, 'A hull crawler inside the giant beast Antuen: a flat armored beetle-like parasite of dark grey-blue iron-plate shell with rust spots, many thin legs, two pincer jaws, small glowing amber eyes, tiny bolts stuck on its back.',
                          None, 'its pincers snapping forward', 'rearing up its front as the shell plates rattle', 'scuttling forward low', '小怪：船壳爬虫', cycle='crawl'),
    'raidAnLavaImp': C('mob', '熔岩小鬼', 86, 'A lava imp inside the giant beast Antuen: a small wiry black-skinned imp with glowing orange cracks all over, curved little horns, a pointed tail with a molten tip, big pointed ears, a mischievous toothy grin, holding a chunk of molten rock like a club.',
                      'holding a chunk of molten rock', 'the rock club swinging down', 'raising the rock club overhead and cackling', 'dashing forward low', '小怪：熔岩小鬼'),
    'raidAnMagmaHound': QUAD('mob', '岩浆猎犬', 76, 'A magma hound inside the giant beast Antuen: a four-legged dog-like beast whose body is cooled black rock plates with glowing red-orange magma showing between the plates, a stubby snout with a mouth glowing like a furnace, short horns of dark rock, a thick tail with a few small rock spikes.', 'its snapping jaws', 'rearing on its hind legs and roaring', 'crouching low ready to pounce', '小怪：岩浆猎犬'),
    'raidAnFleshPolyp': C('mob', '肉瘤寄生体', 78, 'A flesh polyp inside the giant beast Antuen: a short squat blob of glistening red flesh with wet pink veins, a single big yellowish eye on top, a lamprey-like round mouth on the front, two stubby tentacle-arms and two short fleshy legs, small bubbles of mucus.',
                         None, 'the tentacle arms slapping forward', 'swelling up as the veins throb', 'flopping forward low', '小怪：肉瘤寄生体（心脏房）'),
    'raidAnBloodLeech': QUAD('mob', '血管水蛭', 60, 'A blood leech inside the giant beast Antuen: a long glossy dark red leech-like worm creature with a round toothy sucker mouth, small pale tendril legs along the belly, throbbing dark veins on the back, wet shiny skin.', 'its sucker mouth lunging to bite', 'rearing up the front and flaring the sucker mouth', 'slithering forward low', '小怪：血管水蛭（心脏房）', cycle='crawl'),
}
AN_BG = {
    'raidAnFog': {'floorW': 1700, 'bg': (
        "The interior of a huge decaying sky-ship hull inside a giant beast: a cold grey-blue and black color palette, rusted riveted steel ribs and arches fading into thick black fog, tarnished silver noble ornaments and broken chandeliers, dim blue porthole lights, drifting black mist, dead cold silence, far corridors disappearing into darkness.",
        'a floor of corroded grey-blue steel deck plates with rivets and scratches, dark oily puddles, fallen silver ornaments and scraps, thin black mist lying on the floor',
        'broken ship railings, tangled rusty chains, cold black fog and dim blue sparks of broken lamps')},
    'raidAnVolcano': {'floorW': 1700, 'bg': (
        "The interior of a giant beast's leg, a black volcano pillar rising to the sky: a red-black color palette, huge cooled obsidian walls and cracked basalt columns with rivers of glowing orange-red magma flowing in the cracks, the dark fleshy sinew of the beast faintly visible between rocks, hot red haze, rising heat, towering pillars in the distance.",
        'a floor of black basalt slabs with glowing red magma cracks, scorched ash, small lava puddles and charred bones',
        'jagged black volcanic rocks, bubbling magma pools, glowing red cracks and dark ash piles')},
    'raidAnHeart': {'floorW': 1700, 'bg': (
        "The inside of a giant beast's heart chamber: a deep red and dark crimson fleshy palette, huge thick pulsing veins and arteries like pillars, glistening wet muscle walls with bulging valves, hanging membranes and mucus strands, faint warm pinkish-red glow from within, a huge slow-beating atmosphere, organic and eerie.",
        'a floor of glossy red muscle tissue with fine veins, wet sheen and small pools of dark blood, soft pulsing texture',
        'thick coiling veins, wet flesh lumps and hanging mucus strands in red and dark crimson')},
}
AN_ICONS = {
    'raidan_a': [
        ('raid_an_manaore', 'a chunk of raw dark magic ore, jagged black crystal with glowing orange-red veins and a teal-blue core, the raid currency'),
        ('raid_an_heartshard', 'a glossy red crystalline shard that looks like a piece of a heart with a tiny glowing vein pattern, wet shine'),
        ('raid_an_hatchkey', 'a bone-white egg-shaped key with a red gem and a coiled worm motif, hatchery key puzzle object'),
        ('raid_an_elemball', 'a floating tri-colored energy ball split into red, orange and blue sections, elemental ball puzzle object'),
        ('raid_an_cannon', 'a tiny grey-blue ship cannon on a brass mount with a glowing red charge crystal, cannon defense puzzle object'),
        ('raid_an_fogbottle', 'a small glass bottle full of swirling grey-blue black fog with a cork and chain, black fog source puzzle object'),
    ],
    'raidan_b': [
        ('raid_an_pillar', 'a tiny black obsidian pillar with glowing orange magma cracks and a ring of small gems, sky-pillar puzzle object'),
        ('raid_an_eye', 'a closed-lid fleshy eye orb on a thin staff base with fiery orange lashes, eye-guard puzzle object'),
        ('raid_an_glutton_set', 'a glutton-series fusion equipment emblem: a bone-white and dark red armor chestpiece shaped like a toothy maw with gold trim, glowing'),
        ('raid_an_ancient_set', 'an ancient-series fusion equipment emblem: an ornate rusted bronze and teal armor chestpiece with ancient runes and a tiny glowing heart gem, glowing'),
        ('raid_an_fusion_core', 'a fusion core: a red-and-teal two-tone crystal sphere in a gold cage with swirling light, fusion altar material'),
        ('raid_an_pass', 'a dark red raid pass ticket with a gold beast-eye emblem and a torn corner, glowing edges'),
    ],
}

# ============================== 奥兹玛（毁灭=红 / 绝望=蓝紫 / 恐怖=黑绿，混沌王座） ==============================
OZ_CHARS = {
    # ---- 领主（8） ----
    'raidOzBelias': C('boss', '毁灭之贝利亚斯', 134, 'Belias of Destruction, a boss of the Ozma raid (red destruction zone): a huge crimson demon lord with a charred horned skull-like crown, molten glowing red eyes, wide black armored shoulders with spikes, a chest plate with a burning ember core, a tattered red war cape, clawed gauntlets, holding a monstrous jagged black greatsword with red runes (drawn plain).',
                      'holding a monstrous jagged black greatsword', 'the greatsword slashing down', 'raising the greatsword overhead as the cape flutters', 'charging forward low with the greatsword dragging', '毁灭区领主：贝利亚斯（红）'),
    'raidOzTiamat': C('boss', '绝望之提亚马特', 130, 'Tiamat of Despair, a boss of the Ozma raid (blue-violet despair zone): a tall sorrowful demon queen with long flowing deep indigo hair covering one eye, a pale blue-violet skin, a broken crown of ice-blue crystal, a tattered midnight blue gown with silver tears embroidery, huge drooping skeletal wings, long thin claws, holding a long staff topped with a weeping crystal.',
                      'holding a long staff with a weeping crystal', 'the staff sweeping forward', 'spreading the skeletal wings as the crystal glows', 'gliding forward low', '绝望区领主：提亚马特（蓝紫）'),
    'raidOzKazan': C('boss', '恐怖之卡赞', 126, 'Kazan of Horror, a boss of the Ozma raid (black-green horror zone): a hulking hunched demon shaman with a bloated greyish skin, a dark moss-green and black ragged cloak, a skull mask with four sunken eyes, a long drooping jaw with sharp teeth, bone totems and shrunken heads hanging on the belt, long gnarled arms, holding a gnarled bone staff wrapped with dark vines.',
                     'holding a gnarled bone staff', 'the bone staff smashing forward', 'raising the bone staff as the hanging heads rattle', 'creeping forward low with the arms dragging', '恐怖区领主：卡赞（黑绿）'),
    'raidOzAstros': C('boss', '阿斯特罗斯', 116, 'Astros, a boss of the Ozma raid: an elegant female dimensional sorceress with long pale silver hair with a faint star-map pattern, a black and gold star-embroidered long dress, a headpiece shaped like a crescent moon, three small floating ring-doors orbiting her, calm cold eyes, holding a slim dark silver scepter with a star at the tip.',
                      'holding a slim star scepter', 'the scepter pointing forward', 'raising the scepter as the ring-doors spin around', 'gliding forward low', '次元之门领主：阿斯特罗斯'),
    'raidOzOzma': C('boss', '混沌之奥兹玛', 140, 'Ozma the Chaos, the final boss of the Ozma raid: a towering androgynous chaos deity-demon in layered black-gold ornate armor, six floating shards of three colors (crimson, indigo and dark green) around the body, a huge gold-black halo-crown behind the head, a pale expressionless face with seamless white eyes, long black cloak flowing like liquid, holding a long twisted black and gold scepter.',
                    'holding a long twisted black-gold scepter', 'the scepter slashing across', 'raising the scepter as the six shards orbit', 'floating forward low', '最终领主：奥兹玛（混沌王座）'),
    'raidOzEllinos': C('boss', '埃利诺斯', 124, 'Ellinos, a countdown boss of the Ozma raid【original design】: a gaunt tall time-keeper demon in a long black coat with an enormous cracked clock face worn as a chest plate with ticking gold hands, a tall top hat with a tiny hourglass, pale grey face with monocle, long gold chains hanging a pocket watch in each hand.',
                       'holding two pocket watches on gold chains', 'swinging the pocket watch chains forward', 'raising both watches as the clock hands spin', 'rushing forward low', '倒计时领主：埃利诺斯【原创】'),
    'raidOzSehet': C('boss', '赛赫', 104, 'Sehet, a function-stage boss of the Ozma raid that restores sanity【original design】: a small gentle winged spirit-priestess with soft white-gold hair, a pale halo, a short white and teal robe with a big flower collar, two tiny white wings, calm closed eyes, holding a small glass lantern with a warm light.',
                     'holding a small glass lantern', 'the lantern swinging forward', 'raising the lantern with both hands', 'floating forward low', '功能图：赛赫（提升理智）【原创】'),
    'raidOzDeadKeeper': C('boss', '亡者回廊守护者', 128, 'The Keeper of the Corridor of the Dead, a function-stage boss of the Ozma raid【original design】: a tall skeletal knight in rusted black-green armor with a hollow helmet and two cold white eye-lights, a tattered grey funeral banner as cape, heavy chains around the arms, holding a long coffin-lid shield and a bone halberd.',
                          'holding a bone halberd and a coffin-lid shield', 'the halberd thrusting forward', 'raising the coffin-lid shield as chains rattle', 'charging forward low behind the shield', '功能图：亡者回廊（加伤害）【原创】'),
    # ---- 精英（6，每区 2 个） ----
    'raidOzEmberKnight': C('elite', '余烬骑士', 122, 'An Ember Knight, an elite of the red destruction zone of the Ozma raid: a heavy knight in black armor split by glowing red-hot cracks, a horned bucket helm with a burning slit, a tattered crimson tabard, holding a big black kite shield and a jagged red-edged sword (drawn plain).',
                           'holding a jagged sword and a black kite shield', 'the jagged sword slashing down', 'raising the sword and shield as the cracks glow', 'charging forward low behind the shield', '毁灭区精英：余烬骑士'),
    'raidOzMagmaGolem': C('elite', '熔毁魔像', 132, 'A Molten Golem, an elite of the red destruction zone of the Ozma raid: a huge golem of dark red cooled rock plates with glowing orange magma seams, a tiny head with a burning mouth, fists like boulders with spikes, thick stumpy legs, chunks of rock floating off the shoulders.',
                          None, 'both boulder fists smashing forward', 'raising both fists as the seams flare', 'bulldozing forward low', '毁灭区精英：熔毁魔像'),
    'raidOzTearMage': C('elite', '垂泪魔导师', 108, 'A Weeping Mage, an elite of the blue-violet despair zone of the Ozma raid: a hunched sad mage in a long drooping deep blue robe with a deep hood, dark void face with two streaming pale tear-lines of light, a tiny floating crystal drop above each shoulder, thin pale hands, holding a short cracked crystal wand.',
                        'holding a short cracked crystal wand', 'the crystal wand jabbing forward', 'raising the wand as tears of crystals float up', 'drifting forward low', '绝望区精英：垂泪魔导师'),
    'raidOzFrostWraith': C('elite', '寒霜怨灵', 116, 'A Frost Wraith, an elite of the blue-violet despair zone of the Ozma raid: a tall ghostly knight of pale blue-violet translucent ice-mist, a hollow dark helm with two cold white lights, a broken long tattered cape, ice shard spikes on the shoulders, no legs but a wispy trail, holding a long broken ice spear.',
                          'holding a long broken ice spear', 'the ice spear thrusting forward', 'raising the spear as ice shards float', 'gliding forward low', '绝望区精英：寒霜怨灵', fly=True, hover=18),
    'raidOzRotShaman': C('elite', '腐化祭司', 114, 'A Rot Shaman, an elite of the black-green horror zone of the Ozma raid: a bent grey-skinned priest in a ragged dark olive robe with a rotten wooden mask grown over with dark moss, glowing pale sickly yellow eyes, a necklace of small skulls, long clawed hands, holding a staff with a swaying bundle of dark vines and a hanging censer.',
                         'holding a staff with vines and a censer', 'the staff jabbing forward', 'raising the staff as the censer swings', 'creeping forward low', '恐怖区精英：腐化祭司'),
    'raidOzSwampHorror': C('elite', '沼泽恐魔', 120, 'A Swamp Horror, an elite of the black-green horror zone of the Ozma raid: a huge slimy hunched toad-like demon with dark murky olive skin, glossy black patches, a gigantic wide mouth full of crooked teeth, six small pale eyes, long thick arms with webbed claws, a bulging throat sac, dripping with swamp weeds.',
                           None, 'the webbed claws swiping forward', 'bloating the throat sac and spreading the arms', 'leaping forward low', '恐怖区精英：沼泽恐魔'),
    # ---- 小怪（6，每区 2 个） ----
    'raidOzCinderImp': C('mob', '灰烬小魔', 84, 'A cinder imp of the red destruction zone of the Ozma raid: a small charred black imp with glowing red eyes and ember cracks, tiny bat wings, a spiked tail, holding a small burning iron trident (drawn plain).',
                        'holding a small iron trident', 'the trident jabbing forward', 'raising the trident overhead and shrieking', 'dashing forward low', '毁灭区小怪：灰烬小魔'),
    'raidOzEmberHound': QUAD('mob', '炽炎猎犬', 74, 'An ember hound of the red destruction zone of the Ozma raid: a four-legged lean black dog-demon with glowing crimson eyes and cracks along the body, small curved horns, a tail ending in embers, sharp bared teeth.', 'its snapping jaws', 'rearing on its hind legs and howling', 'crouching low ready to pounce', '毁灭区小怪：炽炎猎犬'),
    'raidOzMourner': FLY('mob', '哀泣幽灵', 86, 'A mourner ghost of the blue-violet despair zone of the Ozma raid: a small floating ghost shaped like a veiled bride in a pale blue-violet tattered dress, face hidden by a white veil with two dark teary eyes, long dangling thin arms, no legs, a trailing wispy tail.', 'its long arms reaching forward', 'spreading the arms as the veil lifts', 'gliding forward low', '绝望区小怪：哀泣幽灵', hover=24),
    'raidOzDroneFish': FLY('mob', '蓝紫幽鱼', 70, 'A despair fish of the blue-violet despair zone of the Ozma raid: a floating translucent ghost deep-sea fish with a blue-violet body, a big round pale glowing lure eye, long wispy fins like veils, tiny needle teeth, bone-like ribs visible.', 'its toothy mouth snapping forward', 'opening its mouth wide as the lure eye glows', 'diving forward low', '绝望区小怪：蓝紫幽鱼', hover=26),
    'raidOzSporeling': C('mob', '孢子怪', 76, 'A sporeling of the black-green horror zone of the Ozma raid: a short round mushroom-like creature with a dark olive and black cap covered in pale spots, a stubby body with a gaping toothy mouth, thin twig arms, small root-like legs, glowing pale yellow eyes.',
                        None, 'its twig arms whipping forward', 'puffing up the cap as it shakes', 'rolling forward low', '恐怖区小怪：孢子怪'),
    'raidOzBogCrawler': QUAD('mob', '沼泽爬行者', 62, 'A bog crawler of the black-green horror zone of the Ozma raid: a long low six-legged salamander-like creature with slimy dark olive-black skin, a flat wide head with many pale eyes, a gaping wide mouth, a thick tail dripping weeds.', 'its wide mouth snapping forward', 'raising its head and hissing', 'crouching low ready to lunge', '恐怖区小怪：沼泽爬行者', cycle='crawl'),
}
OZ_BG = {
    'raidOzRuin': {'floorW': 1700, 'bg': (
        "The red Destruction zone of a chaotic dimension: a vast burning ruined black fortress floating in a crimson void, shattered towers and broken bridges of black stone with glowing red cracks, a blood-red sky with huge swirling ember clouds, rivers of lava falling into the void, dramatic crimson and black palette.",
        'a floor of cracked black stone slabs with glowing red lava cracks, scattered embers and rubble',
        'jagged black ruins, glowing lava cracks and floating embers in crimson and black')},
    'raidOzDespair': {'floorW': 1700, 'bg': (
        "The blue-violet Despair zone of a chaotic dimension: a vast frozen sorrowful cathedral drowned in an endless deep indigo void, drooping icicle-like crystal pillars and weeping stone statues, a sky of dark violet clouds with faint pale falling crystal tears, cold moonlit mist, melancholy blue and violet palette.",
        'a floor of dark blue-violet polished stone with frost patterns, thin water films and scattered crystal shards',
        'weeping statues, ice crystal clusters and cold indigo mist in blue and violet')},
    'raidOzHorror': {'floorW': 1700, 'bg': (
        "The black-green Horror zone of a chaotic dimension: a sickly swamp of twisted dead giant roots and rotten gnarled trees under a black sky, huge drooping vines with glowing pale yellow eyes watching from the dark, murky dark olive and black fog, rotting bone arches, unsettling palette of black and dark moss green.",
        'a floor of black mud and dark olive moss with twisted roots, small bones and murky puddles',
        'twisted black roots, dark moss lumps, bone piles and murky fog in black and dark olive')},
    'raidOzThrone': {'floorW': 1700, 'bg': (
        "The Chaos Throne of the final boss: a vast floating black and gold cathedral platform in the middle of a swirling void where crimson, indigo and dark green light streams merge, a huge empty ornate gold-black throne in the distance, giant floating broken pillars, three colored fractured rings of light in the sky, majestic and ominous.",
        'a floor of polished black marble inlaid with gold runic circle patterns and faint three-colored cracks of crimson, indigo and dark green light',
        'broken black marble pillars and floating gold-black debris with faint crimson, indigo and green light wisps')},
}
OZ_ICONS = {
    'raidoz_a': [
        ('raid_oz_chaos', 'a swirling chaos grudge orb: a dark sphere with churning crimson, indigo and dark green wisps inside, tiny screaming faces, the raid currency'),
        ('raid_oz_destruction', 'a destruction-series fusion equipment emblem: a black and crimson spiked armor chestpiece with a glowing ember core, glowing'),
        ('raid_oz_despair', 'a despair-series fusion equipment emblem: a deep indigo and silver tear-drop themed armor chestpiece with a weeping crystal core, glowing'),
        ('raid_oz_horror', 'a horror-series fusion equipment emblem: a black and dark moss-green bone-and-vine armor chestpiece with a staring pale yellow eye core, glowing'),
        ('raid_oz_sacrifice', 'a sacrifice-series fusion equipment emblem: a white and gold ritual armor chestpiece with a heart-shaped broken chain and an offering bowl, glowing'),
        ('raid_oz_godflame', 'a divine-flame-series fusion equipment emblem: a gold and white-hot orange sacred armor chestpiece wreathed in a stylized divine flame, glowing'),
    ],
    'raidoz_b': [
        ('raid_oz_sanity', 'a small glass vial of calm glowing pale teal-white liquid with a tiny brain-and-star emblem, sanity potion'),
        ('raid_oz_door', 'a small floating ring-shaped dimensional door of gold and black with a swirling starry inside, dimension door puzzle object'),
        ('raid_oz_altar', 'a tiny black stone altar with a glowing gold rune circle and a small floating key crystal, altar puzzle object'),
        ('raid_oz_twinsword', 'two small crossed swords, one crimson and one indigo, chaos-level twin-sword puzzle object'),
        ('raid_oz_clock', 'a tiny cracked gold pocket watch with ticking hands and sparks of crimson light, countdown puzzle object'),
        ('raid_oz_throne_key', 'an ornate gold and black key with a three-colored gem in the bow of crimson, indigo and dark green, chaos throne key'),
    ],
}

RAIDS = {
    'si': dict(id='raidsi', name='希洛克团本', raid='siroco', prefix='raidSi', chars=SI_CHARS, bg={}, icons=SI_ICONS),
    'an': dict(id='raidan', name='安徒恩团本', raid='anton', prefix='raidAn', chars=AN_CHARS, bg=AN_BG, icons=AN_ICONS),
    'oz': dict(id='raidoz', name='奥兹玛团本', raid='ozma', prefix='raidOz', chars=OZ_CHARS, bg=OZ_BG, icons=OZ_ICONS),
}
