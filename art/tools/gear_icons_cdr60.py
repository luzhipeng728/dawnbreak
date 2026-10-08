"""装备 2.0 · 纯冷却流（content/items/cdr60.js）的图标表（gear_icons.py 自动合并；用法：python3 art/tools/gear_icons.py gen|cut <表名...>）
母题：沙漏 / 流沙 / 时钟。传说「时之沙漏」金 + 天蓝；神器「流沙」粉紫。流沙武器拿在手里是 <类型>_r3，只做图标。武器表覆盖当前所有已开放的类型。
刀剑一律直刃直尖（用户：不许弯钩卷尖）；枪身用亮色（全黑的枪 1 倍下看不清）。'gear_spare' 格子切图时跳过。
样图：gen cdr60_hourglass（传说 5 件 + 一件流沙，两种配色一起看）→ 审过再批量 gen 其余 8 张（同时 2~3 个）→ cut。
"""
GOLDBLUE = ', surrounded by a soft gold-and-sky-blue glow instead of a plain golden glow'
PINK = ', surrounded by a soft pink-purple magical glow instead of a golden glow'
SAND = 'dusty rose-pink and lavender-purple {kind} decorated with flowing pink sand patterns and small silver hourglass emblems'

SAND_ACC = {
    'sand_neck': 'a necklace with a small glass vial pendant full of shimmering rose-pink sand, a thin silver chain' + PINK,
    'sand_bracelet': 'a silver bangle bracelet with a glass channel all around it where rose-pink sand is flowing, small lavender gems' + PINK,
    'sand_ring': 'a silver ring topped with a tiny glass hourglass of rose-pink sand, lavender-purple band' + PINK,
    'sand_support': 'a small round glass bottle full of swirling shimmering pink sand, a silver cork and a lavender ribbon tied at the neck' + PINK,
    'sand_stone': 'a faceted rose-pink crystal gem with lavender-purple sand drifting inside it, set in a thin silver frame' + PINK,
}
ARMOR = {
    'cloth': ('cloth', ('a long cloth robe top', 'a cloth shoulder mantle', 'a long cloth skirt', 'a cloth sash belt', 'a pair of soft cloth boots')),
    'leather': ('leather', ('a leather chest armor jacket', 'a pair of leather shoulder guards', 'leather pants', 'a leather belt', 'a pair of leather short boots')),
    'light': ('light armor', ('a light armor chest plate', 'a pair of light armor shoulder pauldrons', 'light armor leg guards', 'a light armor belt', 'a pair of light armor boots')),
    'heavy': ('heavy armor', ('a heavy armor chest plate', 'a pair of heavy armor shoulder pauldrons', 'heavy armor greaves', 'a heavy armor belt', 'a pair of heavy armor war boots')),
    'plate': ('plate armor', ('a plate armor breastplate', 'a pair of plate armor pauldrons', 'plate armor leg plates', 'a plate armor belt', 'a pair of plate armor sabatons')),
}
def _armor(a):
    kind, names = ARMOR[a]
    return [(f'sand_{a}_{s}', f'{n} ({kind}), ' + SAND.format(kind=kind) + PINK) for s, n in zip(('top', 'head', 'bottom', 'belt', 'shoes'), names)]
W = {
    'shortsword': 'a short sword with a perfectly STRAIGHT blade of translucent pink glass with rose-pink sand flowing inside it, a small hourglass-shaped lavender-purple crossguard',
    'katana': 'a perfectly STRAIGHT katana (a chokuto: straight back and straight edge, no curve at all, straight angled point) whose blade is translucent pink glass with pink sand flowing inside, a lavender hilt wrap and a round hourglass tsuba',
    'club': 'a heavy mace club whose head is a big lavender-purple framed hourglass full of glowing pink sand, a silver-wrapped handle',
    'greatsword': 'a huge greatsword with a broad perfectly STRAIGHT lavender-purple blade and a glass channel of flowing pink sand down its middle, a sand-dune shaped silver crossguard',
    'lightsaber': 'a lightsaber: a lavender-and-silver hilt shaped like a slim hourglass and a perfectly straight glowing pink energy blade made of swirling sand particles',
    'revolver': 'a revolver pistol with a bright lavender-purple frame, a pink glass cylinder with sand flowing inside and a shiny silver barrel',
    'autopistol': 'a sleek automatic pistol in bright rose-pink and white with a small hourglass emblem on the grip and pink sand drifting from the vents',
    'rifle': 'a long rifle with a bright lavender-purple body, a shiny silver barrel and a glass hourglass-shaped scope filled with pink sand',
    'handcannon': 'a bulky hand cannon with a bright lavender-purple barrel and a big glass hourglass drum of glowing pink sand on top',
    'bowgun': 'a crossbow (bowgun) with bright lavender-purple limbs, a silver stock and a loaded bolt trailing pink sand',
    'spear': 'a long spear with a STRAIGHT pink glass spearhead filled with flowing sand and a lavender-purple shaft with silver rings',
    'pole': 'a long fighting pole in lavender-purple with silver caps on both ends and a ribbon of pink sand swirling around it',
    'rod': 'a short magic rod topped with a small glass hourglass of pink sand held by silver crescent prongs',
    'staff': 'a tall wizard staff of lavender-purple wood topped with a large ornate silver hourglass full of glowing pink sand',
    'broom': 'a broom with a lavender-purple handle and bristles made of flowing pink sand, a tiny silver hourglass charm tied on',
    # 圣职者的五种巨兵（运行时手持图先复用同形制长杆 / 重兵器，但图标 key 独立）。
    'cross': 'a large ivory cross with a lavender-purple metal frame and a glass hourglass of glowing pink sand in its center',
    'rosary': 'a string of silver prayer beads with a faceted pink hourglass crystal and lavender sand sparks',
    'totem': 'a heavy lavender-purple totem club carved with hourglass symbols and wrapped in flowing pink sand',
    'scythe': 'a long silver scythe with a translucent pink glass blade filled with flowing sand and a lavender shaft',
    'battleaxe': 'a massive lavender-purple battle axe with a straight silver edge and a glowing pink sand channel',
}
_w = lambda *ts: [(f'sand_{t}', W[t] + PINK) for t in ts]
_acc = lambda *ks: [(k, SAND_ACC[k]) for k in ks]

SHEETS = {
    'cdr60_hourglass': [
        ('set_hourglass_neck', 'a necklace with a small golden hourglass pendant filled with glowing sky-blue sand, a fine gold chain and tiny clock-numeral engravings' + GOLDBLUE),
        ('set_hourglass_bracelet', 'a wide golden bangle with a small clock face in the middle and a glass channel of flowing sky-blue sand around it' + GOLDBLUE),
        ('set_hourglass_ring', 'a golden ring topped with a tiny hourglass whose sky-blue sand is flowing upward' + GOLDBLUE),
        ('set_hourglass_support', 'an ornate golden hourglass standing on its frame, glowing sky-blue sand flowing upward inside it, little clock hands and gears on the frame' + GOLDBLUE),
        ('set_hourglass_stone', 'a faceted sky-blue crystal gem with golden sand swirling inside it, set in a thin golden clock-dial frame' + GOLDBLUE),
    ] + _acc('sand_neck'),
    'cdr60_sand_cloth': _armor('cloth') + _acc('sand_bracelet'),
    'cdr60_sand_leather': _armor('leather') + _acc('sand_ring'),
    'cdr60_sand_light': _armor('light') + _acc('sand_support'),
    'cdr60_sand_heavy': _armor('heavy') + _acc('sand_stone'),
    'cdr60_sand_plate': _armor('plate') + [('gear_spare', 'a small pile of shimmering pink sand')],
    'cdr60_sand_sword': _w('shortsword', 'katana', 'club', 'greatsword', 'lightsaber') + [('gear_spare', 'a small silver pocket watch')],
    'cdr60_sand_gun': _w('revolver', 'autopistol', 'rifle', 'handcannon', 'bowgun') + [('gear_spare', 'a small brass key')],
    'cdr60_sand_mage': _w('spear', 'pole', 'rod', 'staff', 'broom') + [('gear_spare', 'a small round blue mana potion bottle with a cork')],
    'cdr60_sand_priest': _w('cross', 'rosary', 'totem', 'scythe', 'battleaxe') + [('gear_spare', 'a small silver prayer charm')],
}
