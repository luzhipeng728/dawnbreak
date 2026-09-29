"""装备 2.0 · B1c 魔法师武器的领主神器 / Lv55 粉装图标（只做图标，拿在手里用 <类型>_r3 外观）。
gear_icons.py 自动合并：python3 art/tools/gear_icons.py gen pink60_mage_a pink60_mage_b；cut 同名。物品定义在 src/content/items/epics60_w_mage.js 第 6 段。
"""
_P = ', rose-pink artifact-grade trim'
SHEETS = {
    'pink60_mage_a': [
        ('nm_pole_kaino', 'a long fighting staff crackling with electricity: dark steel with glowing yellow lightning coils on both ends and a pink crystal in the middle' + _P),
        ('nm_staff_lotus', 'a long bone-white staff topped with a cluster of pale blue ghostly soul wisps swirling around a pink skull gem' + _P),
        ('nm_staff_spiz', "a long staff made of an evil dragon's black spine with sharp vertebra spikes, topped with a small dragon skull holding a red gem" + _P),
        ('nm_spear_headless', "a long black war spear with a straight jagged dark iron spearhead, wailing ghost faces in grey mist carved along the blade and a torn purple pennant" + _P),
        ('nm_staff_sabertooth', 'a long frosted staff topped with a huge curved white sabertooth fang wrapped in ice crystals and a pale blue frost gem' + _P),
        ('nm_broom_seski', 'a witch broom with an icy blue handle and a big frosty white-and-pale-blue brush covered in snowflakes' + _P),
    ],
    'pink60_mage_b': [
        ('nm_spear_thor', "a long thunder god's halberd spear with a straight silver-gold spearhead and a small axe blade, crackling blue lightning runes, a pink gem at the socket" + _P),
        ('nm_pole_flute', 'a long jade-white flute that doubles as a fighting staff, carved with ocean wave patterns, gold caps on both ends and a pink tassel' + _P),
        ('nm_rod_dawn', 'a short magic wand topped with a big glowing sunrise ornament: a golden half-sun with pink morning clouds and rays' + _P),
        ('nm_staff_harmony', 'a long staff topped with four small orbs (red fire, blue ice, gold light, purple dark) orbiting a big pink crystal in a silver ring' + _P),
        ('nm_staff_lynn', "a long neat white-and-pink mage staff topped with a pink heart-shaped crystal inside a silver star frame and a small bow" + _P),
        ('nm_broom_bone', 'a broom with a handle made of stacked vertebra bones and a big bristly brush of pale bone spikes, a small skull at the binding' + _P),
    ],
}
