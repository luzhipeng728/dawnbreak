#!/usr/bin/env python3
"""男圣职者转职 驱魔师（exorcist，pe_）/ 复仇者（avenger，pa_）的美术：技能图标、觉醒插图（cutin/<转职>{,2,3}）、转职立绘（job/<转职>）、
驱魔师的式神（fx/pe_*）、复仇者魔化的恶魔翼 / 角（fx/pa_*）。
沿用 combatgen.py 的生图 / 切图流水线（只替换表的内容，不修改 combatgen.py）；原图写到主仓库 art/src/combat/。
  exorcist_avenger_art.py icons <job>        图标表（一个转职一张，4 列）→ <主仓库>/art/src/combat/icons/<pe|pa>_icons.png
  exorcist_avenger_art.py iconcut <job>      切图标 → art/final/icon/<技能 id>.webp
  exorcist_avenger_art.py cutin <job> [名字]  觉醒插图 → <主仓库>/art/src/combat/cutin/<转职>{,2,3}.png
  exorcist_avenger_art.py cutinprep <job>    → art/final/cutin/<转职>{,2,3}.webp
  exorcist_avenger_art.py job <job> / jobprep <job>   转职立绘 → art/final/job/<转职>.webp
  exorcist_avenger_art.py parts <job> / partsprep <job>  驱魔：五只式神一张表；复仇者：恶魔翼 + 角 + 恶魔镰刀一张表 → art/final/fx/<pe|pa>_*.webp
  exorcist_avenger_art.py review             图标 / 插图 / 立绘 / 部件总览 → art/work/priest_jobs/<job>.jpg
人物参考：男圣职者原装立绘（主仓库 art/src/priest_ref.png：蜂蜜金短发、蓝眼睛）；驱魔 = 道袍 + 符咒 / 念珠 + 战斧，复仇者 = 暗色重甲 + 镰刀（魔化时恶魔角 / 翼）。
生图约定：同时最多 1 个请求（全队共用接口），429 退避 65 秒；已存在的输出跳过。纯绿 #00FF00 / 品红 #FF00FF 是流水线标记色，不能用。
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C

REF = os.path.join(C.SRC, 'priest_ref.png')
FACE = 'honey-blond short messy hair, calm blue eyes, the same young male priest face as the reference'
LOOK = {
    'exorcist': ('a young male exorcist priest in cute chibi anime style: ' + FACE + ', a long crimson-red taoist-style exorcist robe with a white inner collar, wide sleeves and gold trim, '
                 'a string of huge dark prayer beads slung over one shoulder, yellow paper talismans with red ink tucked in the belt, '
                 'dark trousers and brown boots, a huge silver-and-gold battleaxe (giant weapon)'),
    'avenger': ('a young male avenger priest in cute chibi anime style: ' + FACE + ', heavy dark gunmetal-and-black plate armor with purple trim and spiked pauldrons, '
                'a tattered dark purple half-cape, a glowing violet demonic mark on the left cheek, a huge black scythe with a curved violet-edged blade'),
}
PFX = {'exorcist': 'pe', 'avenger': 'pa'}
DARK_CUTIN = {'avenger3'}   # 深色背景的觉醒插图（cutinprep 不去白底）
PART_CUTS = {'avenger': [1048, 1602, 2444, 3234]}   # 复仇者部件表的手工分界列（去黑边之后的坐标）
# (技能 id, 图标描述)：顺序 = 生图表的阅读顺序（切图按这个顺序命名）
ICONS = {'exorcist': [
    ('pe_zen', 'a round ritual formation seal split half into red fire and half into white-gold holy light, balanced like yin and yang'),
    ('pe_force', 'a huge silver-gold battleaxe swinging in a wide arc, blowing away dark purple demon wisps'),
    ('pe_lurk', 'a dark blue dragon coiled asleep around a round stone shield, calm and unbreakable'),
    ('pe_plate', 'an ivory-and-gold plate chestplate with a red paper talisman pinned on it'),
    ('pe_mastery', 'a giant silver-gold battleaxe and a string of dark prayer beads crossed, with a bright gleam'),
    ('pe_book', 'an old taoist exorcism book lying open with red-inked yellow talismans flying out of it'),
    ('pe_lotus', 'a lotus flower made of orange fire and golden light blooming around an axe blade'),
    ('pe_gale', 'a shoulder charge silhouette bursting forward with a white wind shockwave in front'),
    ('pe_star', 'a battleaxe flinging a small dark monster silhouette into the night sky like a falling star with a sparkling trail'),
    ('pe_suzaku', 'a vermilion firebird (Zhuque) diving forward inside a whirl of orange flames'),
    ('pe_genbu', 'a black tortoise with a serpent tail raising floating boulders that swirl around it'),
    ('pe_byakko', 'a roaring white tiger head with blue lightning bolts striking down from a glowing orb'),
    ('pe_chaos', 'a giant battleaxe hammering the ground again and again, three cracked impact craters'),
    ('pe_spin', 'a giant battleaxe spinning in a violent whirlwind vortex'),
    ('pe_atomic', 'two spinning arcs sweeping enemies together, then a huge overhead battleaxe slam with a crater'),
    ('pe_spirit', 'a burning red fighting-spirit aura rising from a fist gripping dark prayer beads'),
    ('pe_awaken', 'a massive ornate red temple gate swinging open with a swarm of glowing divine firebirds bursting out'),
    ('pe_seiryu', 'an azure water dragon swinging a giant weapon among splashing waves'),
    ('pe_quake', 'a battleaxe slamming into the earth and splitting it with huge glowing orange cracks'),
    ('pe_insight', 'four small spirit beast emblems (red bird, black tortoise, white tiger, blue dragon) orbiting a glowing golden core'),
    ('pe_kouryu', 'a golden yellow Chinese dragon coiling in a circle with speed lines, radiant'),
    ('pe_seven', 'seven overlapping golden battleaxe slash arcs forming a fan'),
    ('pe_pentacle', 'a golden magic formation circle on the ground with a yellow dragon rising from its center in a pillar of light'),
    ('pe_awaken2', 'a giant golden dragon-head battleaxe cleaving down with a huge yellow dragon spirit behind it'),
    ('pe_general', 'a translucent blue-and-gold giant guardian deity making a hand seal, glowing eyes'),
    ('pe_blitz', 'a battleaxe tearing up a huge slab of rock from the ground, a firebird and a tortoise spirit helping, flying rocks'),
    ('pe_awaken3', 'a colossal golden dragon-head axe smashing down over a stormy sea with a lightning tiger and a tsunami dragon'),
    ('pe_crest', 'an exorcist emblem: a battleaxe with a string of dark prayer beads and a red talisman, a small firebird on top'),
], 'avenger': [
    ('pa_devil', 'a dark purple demonic afterimage silhouette slashing beside a black scythe, violet energy trails'),
    ('pa_scythe', 'a huge black scythe with a curved violet-edged blade glowing with dark energy'),
    ('pa_echo', 'a pale ear surrounded by purple whispering sound waves and a small glowing demonic eye'),
    ('pa_heavy', 'heavy dark gunmetal plate armor with spiked pauldrons and purple trim'),
    ('pa_nightmare', 'a sleeping face with a violet demon shadow rising out of it, nightmare'),
    ('pa_rebirth', 'a cracked black demonic heart with a glowing human silhouette stepping out of it, revival light'),
    ('pa_evil', 'a pink-violet demon afterimage with a glowing evil grin, evolved dark power'),
    ('pa_righteous', 'a wing that is half white light and half black demonic feathers, with a glowing cross mark between'),
    ('pa_meta', 'a human silhouette half turned into black shadow with glowing red eyes and claws, half-demon'),
    ('pa_render', 'a black scythe slashing in a flurry of six violet crescent cuts'),
    ('pa_mine', 'a fist punching the ground with three dark stone pillars erupting in a row'),
    ('pa_cutter', 'a black scythe spinning like a boomerang with violet circular trails'),
    ('pa_thorn', 'dark purple thorns bursting out of the ground in every direction around a crouching silhouette'),
    ('pa_wheel', 'a giant spinning black saw wheel throwing violet sparks while charging forward'),
    ('pa_fist', 'a huge demonic arm of dark purple energy thrusting forward, a violent explosion at its fist'),
    ('pa_reaper', 'a giant shadow demon arm reaching out of a dark pool on the ground, grabbing'),
    ('pa_authority', 'an inverted dark cross-shaped slash mark exploding with violet energy'),
    ('pa_fall', 'a violet ghostly soul wisp falling down into a glowing demonic mark'),
    ('pa_awaken', 'a huge black horned demon with red eyes and big claws roaring inside a dark purple aura'),
    ('pa_claw', 'a giant black demon claw slashing down leaving three purple claw marks'),
    ('pa_execute', 'a giant demonic hand gripping a small enemy silhouette and slamming it into the ground'),
    ('pa_barrier', 'a dark violet demonic barrier dome with glowing hexagon cracks'),
    ('pa_gate', 'an open gothic hell gate firing beams of violet demonic energy'),
    ('pa_disaster', 'a demon crashing down from the sky onto a swirling dark magic circle'),
    ('pa_howl', 'a black demon head roaring with purple shockwave rings'),
    ('pa_smite', 'a charging demon with huge horns and a skull-shaped dark shockwave in front'),
    ('pa_awaken2', 'a black clawed demonic hand tearing through space in an X-shaped rend, blood-red shards flying'),
    ('pa_stream', 'a dark orb above a head firing a sweeping violet-and-white beam across the ground'),
    ('pa_awaken3', 'a giant scythe made of pure white light formed from a torn black wing, a halo of light and darkness'),
    ('pa_crest', 'an avenger emblem: a black scythe crossed with a glowing violet cross-shaped scar and a small demon horn'),
]}
CUTIN = {'exorcist': {
    'exorcist': 'standing before a massive ornate red temple gate that is swinging open behind him, raising a burning red paper talisman in his left hand and forming a hand seal with his right, '
                'a small cute vermilion firebird spirit perched on his shoulder, a swarm of glowing divine firebirds pouring out of the gate, orange and red palette, intense focused expression',
    'exorcist2': 'raising a gigantic golden battleaxe whose head is shaped like a roaring dragon high over his head with one hand, the other hand holding his dark prayer beads with small glowing light orbs floating around them, '
                 'a huge cream-gold eastern yellow dragon coiling behind him, a glowing golden formation circle under him, a sweeping golden light slash across the picture, fierce shout',
    'exorcist3': 'dramatic close-up swinging a colossal golden dragon-head battleaxe down with golden energy trails, glowing golden eyes and gritted teeth, a stormy sea with a towering tsunami and blue lightning behind him, '
                 'a giant translucent blue-and-gold guardian deity making a hand seal behind him, small glowing orbs with golden glyphs floating around',
}, 'avenger': {
    'avenger': 'the moment of demonic transformation: the right half of his body turning into a huge black horned demon with a glowing red eye, black skin and a big clawed hand, '
               'a cross-shaped scar on his chest glowing white as holy light is sucked into it, purple-black miasma swirling around him, anguished shout',
    'avenger2': 'extreme close-up of his face: his black demonic clawed hand sliding over his face while black demonic corruption spreads across his skin, one eye glowing red, '
                'thick dark purple mist all around, blood-red crystal shards flying',
    'avenger3': 'in his true demon form with huge black wings, tearing off one of his wings so that bright golden-white light bursts out like sparks, the torn wing reforming into a giant scythe made of pure golden light, '
                'a great halo of light and darkness behind him, intense glowing eyes. The whole background is a solid very dark purple-black night filled with dark mist (NOT white)',
}}
JOBPOSE = {'exorcist': 'resting the huge battleaxe on his shoulder with one hand and holding a red paper talisman between two fingers of the other hand, a small cute vermilion firebird spirit hovering by his shoulder, calm confident smile',
           'avenger': 'normal human form with NO horns and a normal human face with both eyes blue, holding the huge black scythe over his shoulder with one hand, the other hand clenched with faint violet energy, a thin purple-black mist curling around his boots, stern cold expression'}
PARTS = {'exorcist': [
    ('pe_suzaku', 'a vermilion firebird (Zhuque) spirit beast flying to the RIGHT with its wings spread wide, flame feathers and a long flowing fire tail, side view'),
    ('pe_genbu', 'a black tortoise spirit beast with a dark green-black rocky shell and a serpent coiled around it, both facing RIGHT, side view'),
    ('pe_byakko', 'a white tiger spirit beast with black stripes and blue lightning crackling around it, pouncing to the RIGHT, side view'),
    ('pe_seiryu', 'an azure dragon-headed warrior spirit in flowing blue water robes swinging a huge crescent-bladed polearm, charging to the RIGHT, side view'),
    ('pe_kouryu', 'a golden yellow eastern dragon rising straight UP in a tall vertical S-curve, head at the top, long whiskers'),
    ('pe_gate', 'a massive ornate red Chinese temple gate with golden studs on its closed doors and a tiled roof, front view'),
], 'avenger': [
    ('pa_wings', 'a pair of large black demonic bat wings spread wide open, violet glowing membranes, seen from behind, symmetrical'),
    ('pa_horns', 'a single pair of big curved black demon horns with violet glowing tips, front view, just the horns'),
    ('pa_demon', 'a huge hunched black muscular demon (Doom Guardian) with curved horns, glowing red eyes and big claws, a glowing cross-shaped scar on its chest, side view facing RIGHT'),
    ('pa_lightscythe', 'a giant scythe made of pure glowing white-gold light with a long curved blade, diagonal'),
    ('pa_lightwing', 'a single wing made of long glowing white light blades, like a wing of swords of light'),
]}

def icon_prompt(items):
    cols = 4; rows = (len(items) + cols - 1) // cols
    return (f'A sprite sheet of {len(items)} separate game skill icons arranged in a grid of {cols} columns and {rows} rows on a plain pure white background, '
            f'evenly spaced with generous white gaps between icons, no icon touching another, {C.ICON_STYLE}. In reading order (left to right, top to bottom): '
            + '; '.join(f'({i + 1}) {t}' for i, t in enumerate(items)) + '. No text, no numbers, no labels, no letters.')

def icon_size(n):
    rows = (n + 3) // 4
    return f'2048x{min(3840, rows * 512)}'

def run_jobs(L):
    print(f'{len(L)} jobs', flush=True)
    for j in L: print(C.run(j), flush=True)   # 串行：同时最多 1 个生图请求

def cutin_jobs(job, only=''):
    L, first = [], os.path.join(C.OUT, 'cutin', f'{job}.png')
    for n, d in CUTIN[job].items():
        if only and n != only: continue
        ref = first if n != job and os.path.exists(first) else REF
        who = 'this exact chibi character (same face, same honey-blond hair, same outfit, same cute art style)' if ref == first else 'the character in this reference image (same face, same honey-blond hair and blue eyes, same chibi proportions and art style), but dressed as'
        p = (f'Using {who} {"" if ref == first else LOOK[job]}, draw a dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. '
             'Plain pure white background, no text, no letters, no border.')
        L.append({'out': os.path.join(C.OUT, 'cutin', f'{n}.png'), 'ref': ref, 'size': '1536x1024', 'model': 'gpt-image-2.5-sunburst', 'prompt': p})
    return L

def cutin_prep(job):
    from prep import remove_bg
    from PIL import Image
    from sky_art import clear_holes
    out = os.path.join(C.HERE, 'final', 'cutin'); os.makedirs(out, exist_ok=True)
    for n in CUTIN[job]:
        p = os.path.join(C.OUT, 'cutin', f'{n}.png')
        if not os.path.exists(p): print('missing', n); continue
        if n in DARK_CUTIN:   # 深色背景（白色的光会被去白底挖掉）：整张保留，四周椭圆羽化
            import numpy as np
            im = Image.open(p).convert('RGBA').resize((720, 480), Image.LANCZOS); a = np.array(im)
            yy, xx = np.mgrid[0:480, 0:720]; d = np.sqrt(((xx - 360) / 360) ** 2 + ((yy - 240) / 240) ** 2)
            a[..., 3] = (np.clip((1.02 - d) / 0.3, 0, 1) * 255).astype(np.uint8); im = Image.fromarray(a, 'RGBA')
        else: im = clear_holes(remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS).convert('RGBA'))
        f = os.path.join(out, f'{n}.webp')
        im.save(f, 'WEBP', quality=82, method=6); print(n, os.path.getsize(f) // 1024, 'KB')

def job_jobs(job):
    first = os.path.join(C.OUT, 'cutin', f'{job}.png')
    ref = first if os.path.exists(first) and job != 'avenger' else REF   # 复仇者的一觉插图是魔化中的样子（有角）：立绘改用原装立绘当参考
    p = (f'Using this exact chibi character (same face, same honey-blond hair), draw a full-body standing portrait for a class selection screen of {LOOK[job]}, '
         f'cute chibi proportions, full body visible from head to boots, facing slightly right in three-quarter view, {JOBPOSE[job]}. '
         'Plain pure white background, no text, no effects other than a few small magic particles.')
    return [{'out': os.path.join(C.SRC, 'quests', f'job_{job}.png'), 'ref': ref, 'size': '1024x1536', 'model': 'gpt-image-2.5-sunburst', 'prompt': p}]

def job_prep(job):
    from importlib import util as _u
    spec = _u.spec_from_file_location('job_art_mod', os.path.join(os.path.dirname(__file__), 'job_art.py'))
    src = open(spec.origin).read().split('os.makedirs(OUT, exist_ok=True)')[0]
    g = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), g)
    from PIL import Image
    p = os.path.join(C.SRC, 'quests', f'job_{job}.png')
    if not os.path.exists(p): print('missing', p); return
    im = g['cutout'](Image.open(p), True)
    if im.height > 900: im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
    out = os.path.join(C.HERE, 'final', 'job', f'{job}.webp'); im.save(out, 'WEBP', quality=86, method=6); print(f'job/{job}', im.size)

def parts_jobs(job):
    items = PARTS[job]
    p = (f'A sprite sheet of {len(items)} separate game effect sprites arranged in one row on a plain pure white background, evenly spaced with generous white gaps, no sprite touching another, '
         'cute cartoon 2D mobile game style, bold clean outlines, vibrant saturated colors, soft cel shading, polished. From left to right: '
         + '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(items)) + '. No text, no letters, no ground shadow.')
    return [{'out': os.path.join(C.OUT, 'fx', f'{PFX[job]}_parts.png'), 'size': '3840x1280' if len(items) > 4 else '3072x1024', 'model': 'gpt-image-2.5-sunburst', 'prompt': p}]

def parts_prep(job):
    import numpy as np
    from PIL import Image
    from prep import remove_bg
    p = os.path.join(C.OUT, 'fx', f'{PFX[job]}_parts.png')
    if not os.path.exists(p): print('missing', p); return
    src = Image.open(p).convert('RGB'); g = np.array(src).mean(axis=(0, 2))
    x0, x1 = int(np.argmax(g > 40)), len(g) - int(np.argmax(g[::-1] > 40))   # 生图偶尔在左右留黑边：先裁掉
    im = remove_bg(src.crop((x0, 0, x1, src.height))); arr = np.array(im)
    if job in PART_CUTS:   # 手工分界（成对的翅膀 / 角中间的缝比部件之间的还宽，自动切会切错）：按列切成 N 段
        edges = [0] + PART_CUTS[job] + [arr.shape[1]]
        segs = [(edges[k], edges[k + 1]) for k in range(len(edges) - 1)]
    else:   # 默认：连通块，取最大的 N 块，按 x 排序
        from prep import components
        lab, comps = components(arr[..., 3], min_cells=400); boxes = []
        for n, cells in comps:
            ys, xs = np.where(lab == n); boxes.append((xs.min(), xs.max() + 1, n, cells))
        boxes = sorted(sorted(boxes, key=lambda b: -b[3])[:len(PARTS[job])], key=lambda b: b[0])
        segs = [(b[0], b[1], b[2]) for b in boxes]
        arr = arr.copy()
        for x0, x1, n in segs: arr[:, x0:x1, 3] = np.where((lab[:, x0:x1] == n) | (lab[:, x0:x1] == 0), arr[:, x0:x1, 3], 0)
    print(len(segs), 'parts found, expected', len(PARTS[job]))
    for (name, _), sg in zip(PARTS[job], segs):
        seg = arr[:, sg[0]:sg[1]]; ys, xs = np.where(seg[..., 3] > 24)
        ic = Image.fromarray(seg[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy(), 'RGBA'); s = 384 / max(ic.size)
        if s < 1: ic = ic.resize((round(ic.width * s), round(ic.height * s)), Image.LANCZOS)
        f = os.path.join(C.HERE, 'final', 'fx', f'{name}.webp'); ic.save(f, 'WEBP', quality=84, method=6); print(name, ic.size)

def review(job):
    from PIL import Image, ImageDraw, ImageFont
    fin = os.path.join(C.HERE, 'final')
    ids = [n for n, _ in ICONS[job]]
    W = 1600; out = Image.new('RGB', (W, 1400), (32, 30, 40)); d = ImageDraw.Draw(out)
    try: font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 16)
    except Exception: font = None
    def paste(im, x, y):
        bg = Image.new('RGBA', im.size, (32, 30, 40, 255)); bg.alpha_composite(im.convert('RGBA')); out.paste(bg.convert('RGB'), (x, y))
    for i, n in enumerate(ids):
        f = os.path.join(fin, 'icon', f'{n}.webp')
        if os.path.exists(f): paste(Image.open(f), 10 + (i % 14) * 112, 24 + (i // 14) * 130)
        d.text((10 + (i % 14) * 112, 6 + (i // 14) * 130 + 124), n, fill=(255, 220, 150), font=font)
    y = 300; x = 10
    for n in CUTIN[job]:
        f = os.path.join(fin, 'cutin', f'{n}.webp')
        if os.path.exists(f): im = Image.open(f); im.thumbnail((520, 346)); paste(im, x, y); d.text((x, y - 18), n, fill=(255, 220, 150), font=font)
        x += 530
    f = os.path.join(fin, 'job', f'{job}.webp')
    if os.path.exists(f): im = Image.open(f); im.thumbnail((360, 640)); paste(im, 10, 700)
    x = 400
    for n, _ in PARTS[job]:
        f = os.path.join(fin, 'fx', f'{n}.webp')
        if os.path.exists(f): im = Image.open(f); im.thumbnail((280, 280)); paste(im, x, 720); d.text((x, 702), n, fill=(255, 220, 150), font=font); x += 290
    o = os.path.join(C.HERE, 'work', 'priest_jobs'); os.makedirs(o, exist_ok=True); out.save(os.path.join(o, f'{job}.jpg'), quality=84); print(os.path.join(o, f'{job}.jpg'))

if __name__ == '__main__':
    a = sys.argv[1:] or ['help']; ph = a[0]; job = a[1] if len(a) > 1 else ''
    if job and job not in LOOK: print('job = exorcist | avenger'); sys.exit(1)
    if ph == 'icons': run_jobs([{'out': os.path.join(C.OUT, 'icons', f'{PFX[job]}_icons.png'), 'prompt': icon_prompt([d for _, d in ICONS[job]]), 'size': icon_size(len(ICONS[job])), 'model': 'gpt-image-2.5-sunburst'}])
    elif ph == 'iconcut':
        C.ICON_SHEETS = {f'{PFX[job]}_icons': ICONS[job]}
        import icons; sys.argv = ['icons.py', '--combat', '--only', f'{PFX[job]}_icons']; icons.main()
    elif ph == 'cutin': run_jobs(cutin_jobs(job, a[2] if len(a) > 2 else ''))
    elif ph == 'cutinprep': cutin_prep(job)
    elif ph == 'job': run_jobs(job_jobs(job))
    elif ph == 'jobprep': job_prep(job)
    elif ph == 'parts': run_jobs(parts_jobs(job))
    elif ph == 'partsprep': parts_prep(job)
    elif ph == 'review': review(job)
    else: print(__doc__)
