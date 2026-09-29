"""装备 2.0 · B1a 鬼剑士武器的领主神器图标（粉色品级；拿在手里用 <类型>_r3 外观，所以只做图标）
  python3 art/tools/gear_icons.py gen pink60_sword_a pink60_sword_b    python3 art/tools/gear_icons.py cut pink60_sword_a pink60_sword_b
刀剑同样直刃直尖（用户：不许弯钩卷尖）。第二张表只有 2 件，其余格子用 gear_spare 占位（切图时跳过）；邪龙的骨角太刀在第一张表里画弯了，挪到第二张重画。
"""
PINK = 'rose-pink enamel accents and a faceted pink crystal (artifact grade)'
SHEETS = {
    'pink60_sword_a': [
        ('nm_ss_kino', f'a short sword with a straight jagged-edged silver blade crackling with bright yellow lightning inside it, a crossguard of goblin bones wrapped with blue cloth, {PINK}'),
        ('nm_gs_sauta', f'a huge heavy greatsword whose broad straight blade is carved from a giant ivory beast horn with bronze bands, a leather-wrapped grip and a small bull-skull pommel, {PINK}'),
        ('nm_ls_seghart', f'a lightsaber: an ornate white-and-gold hilt with a pair of small feathered light wings on the guard and a straight bright golden-white energy blade, {PINK}'),
        ('nm_gs_lotus', f'a huge greatsword whose broad straight blade is a thick dark-purple octopus tentacle with rows of pink suckers, a coral-shaped crossguard, {PINK}'),
        ('nm_gs_spiz', f'a huge greatsword with a broad straight black blade made from an evil dragon horn with glowing violet veins, a dragon-scale crossguard, {PINK}'),
        ('gear_spare', f'a straight katana whose blade is carved from pale bone-white dragon horn, a dragon-claw tsuba, a black wrapped hilt with pink cord, {PINK}'),   # 这一格画弯了（用户不许弯刀），改到第二张表重画
    ],
    'pink60_sword_b': [
        ('nm_ls_bentink', f'a lightsaber made from a flamethrower: a red fuel-tank hilt with brass pipes and a nozzle emitter, and a straight roaring orange fire energy blade, {PINK}'),
        ('nm_kt_spiz', f'a perfectly STRAIGHT katana (a chokuto: straight back and straight edge, no curve at all, straight angled point) whose wide blade is carved from pale bone-white dragon horn with dark bone ridges, a dragon-claw tsuba, a black wrapped hilt with pink cord, {PINK}'),
        ('gear_spare', 'a small round blue mana potion bottle with a cork'),
        ('gear_spare', 'a brown leather coin pouch with gold coins'),
        ('gear_spare', 'a small silver key with a blue gem'),
        ('gear_spare', 'a small wooden treasure chest with gold trim'),
    ],
}
