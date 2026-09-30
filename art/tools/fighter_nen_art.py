#!/usr/bin/env python3
"""气功师（男格斗家 nenmaster，B4）美术：29 个技能图标（3 张表）、觉醒插图 3 张（cutin/nenmaster{,2,3}）、转职立绘（job/nenmaster）。
原图写到主仓库 art/src/nenmaster/（不进 git），切好的素材输出到本仓库 art/final/{icon,cutin,job}。
  fighter_nen_art.py icons [--only fn_icons_a]      图标表（4 列，每张 12 个；画风同战斗组 ICON_STYLE，念气金色 + 雷光）
  fighter_nen_art.py cutin [--only nenmaster]       觉醒插图（1536x1024，参考图 = 男格斗家原装立绘；B1 的 fighter_ref.png 还没出时用男鬼剑士立绘当画风参考）
  fighter_nen_art.py job                            转职立绘（1024x1536）
  fighter_nen_art.py prep                           切图 → art/final
  fighter_nen_art.py contact                        审图总览（一张）→ art/src/nenmaster/contact.png
样图流程（PLAYBOOK §1.4）：先 icons --only fn_icons_a + cutin --only nenmaster 两张给主线程审，过了再出其余 5 张（fn_icons_b / c、nenmaster2 / 3、job）。
主线程审图意见：图标过；插图人物不能和散打一样（红头带 + 白色练功服）→ 气功师改成青绿 / 米白气功长袍 + 金边 + 念珠，不戴头带（FIGHTER）。
念兽（金雷虎 / 獬豸 / 虎头）不生图：运行时借用雪虎精灵帧换成金色（src/content/classes/fighter_nen.js fnBeast）。
"""
import os, sys, argparse, importlib.util
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.environ.get('ART_MAIN', '/Users/luzhipeng/projects/dawnbreak/art')
SRC = os.path.join(MAIN, 'src')
OUT = os.path.join(SRC, 'nenmaster')
spec = importlib.util.spec_from_file_location('gi', os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py'))
gi = importlib.util.module_from_spec(spec); spec.loader.exec_module(gi)
MODEL = 'gpt-image-2.5-sunburst'

ICON_STYLE = ('cute cartoon mobile RPG icon style, bold clean outlines, bright saturated colors, soft shading, glossy and polished; '
              'every icon is a rounded square tile with its own colored background and a thick dark border')
NEN = 'golden-yellow and white glowing nen energy with small golden lightning sparks'
ICONS = {
    'fn_icons_a': [('fn_tattoo', f'a muscular forearm covered with glowing golden tribal tattoo lines, {NEN} flowing along the lines'),
                   ('fn_cannon', f'a huge charged ball of {NEN} held between two open palms'),
                   ('fn_spiral', 'five small glowing golden energy orbs orbiting in a ring around a bright white core'),
                   ('fn_legstrike', 'a leg in a dark trouser swinging down in an axe kick, wrapped in golden lightning, a golden lightning bolt hitting the ground'),
                   ('fn_blast', 'a translucent golden ghost clone of a martial artist bursting into a bright golden explosion'),
                   ('fn_guard', 'a translucent golden half-dome barrier with a hexagon pattern over a glowing ground circle'),
                   ('fn_press', 'three glowing golden energy orbs chasing and circling around a small dark target silhouette'),
                   ('fn_nencannon2', 'two palms thrust forward firing a thick straight beam of golden lightning'),
                   ('fn_stone', 'large golden energy orbs spinning fast in a wide ring with bright motion trails'),
                   ('fn_tiger', 'a roaring tiger head made of golden lightning, fierce and glowing'),
                   ('fn_roar', 'a roaring golden lion head with sound-wave rings blasting out to the right'),
                   ('fn_thunderdrop', 'a golden tiger-shaped energy spirit stomping down, a big golden lightning explosion on the ground')],
    'fn_icons_b': [('fn_field', 'a glowing golden sphere of spiral energy with electric arcs crackling around it'),
                   ('fn_haitai', 'a golden spirit beast haitai (a lion with one horn on its forehead) pouncing forward, made of glowing energy'),
                   ('fn_awaken', 'a huge golden thunder lion with a lightning mane leaping, a small rider silhouette on its back'),
                   ('fn_spear', 'a long spear made of golden light piercing forward, lightning around the tip'),
                   ('fn_pillar', 'a golden pillar of light erupting up from the ground where a glowing crystal falls'),
                   ('fn_windstorm', 'a swirling golden spiral vortex of wind and lightning'),
                   ('fn_blade', 'a hand holding a crackling blade made of golden-white lightning'),
                   ('fn_moon', 'a crescent moon shedding soft golden-white rays of light over a glowing ground circle'),
                   ('fn_awaken2', 'a giant radiant golden-white energy sphere collapsing inward with lightning and light rays'),
                   ('fn_tigerblast', 'a spiral of golden energy orbs forming a roaring tiger head explosion'),
                   ('fn_awaken3', 'a silhouette meditating cross-legged in the air in front of a giant golden halo wheel of light'),
                   ('fn_nature', 'a lotus flower made of golden light with swirling green and gold nature energy')],
    'fn_icons_c': [('fn_sense', 'a glowing golden third eye with rings of nen waves'),
                   ('fn_lightaff', 'a radiant golden sun emblem in front of a small white shield'),
                   ('fn_cloth', 'a white martial-arts cloth jacket with red trim and a red sash'),
                   ('fn_conduit', 'a golden fist bursting with sparkling star-shaped critical-hit energy'),
                   ('fn_absorb', 'a curved golden gauge meter filling up with swirling golden lightning'),
                   ('nenmaster', 'a golden fist emblem with a spiral nen orb symbol, a golden medal')],
}
# 气功师的造型（主线程 2026-09-30 定：和散打的红头带 + 白色练功服区分开）：同一张脸和棕色刺猬头（B1 的 fighter_ref.png），不戴头带；
# 青绿 / 米白的飘逸气功长袍 + 金边，念珠和念气珠饰品；念兽（金狮）保留
FIGHTER = ('the same young male martial artist as the reference (same face, same brown spiky hair, same cute chibi proportions), NO headband, '
           'now dressed as a Nen Master qigong monk: a flowing teal and cream qigong robe with gold trim and wide sleeves, a gold sash, loose cream trousers, cloth shoes, '
           'a string of large wooden prayer beads around his neck, small golden nen orbs floating near his hands')
CUTIN = {   # 觉醒插图：nenmaster = 一觉 狂虎帝、nenmaster2 = 二觉 念皇、nenmaster3 = 三觉 归元·气功师
    'nenmaster': 'riding a huge golden thunder lion made of glowing nen energy that leaps forward, one palm raised with a glowing golden nen orb, golden lightning crackling everywhere, fierce shout, robe sleeves and sash flowing in the wind',
    'nenmaster2': 'both palms thrust forward, a giant radiant golden-white energy sphere collapsing in front of him with lightning, calm but fierce eyes, glowing golden aura',
    'nenmaster3': 'floating cross-legged in meditation with a mudra hand seal, a giant golden halo wheel of light behind him, ten golden nen orbs circling, serene closed eyes',
}
JOB = (f'Draw a full-body standing portrait for a class selection screen of {FIGHTER}, in the same cute chibi art style as the reference (thick outlines, hand-painted, same head and body proportions): '
       'a Nen Master: confident martial-arts stance facing slightly to the right, one palm forward holding a glowing golden energy ball, five small golden energy orbs orbiting around him, '
       'faint golden lightning around his fists. Plain pure white background, no text.')
REF = os.path.join(SRC, 'fighter_ref.png') if os.path.exists(os.path.join(SRC, 'fighter_ref.png')) else os.path.join(SRC, 'sword_ref.png')


def icon_prompt(items):
    cols = 4 if len(items) > 6 else 3; rows = (len(items) + cols - 1) // cols
    return (f'A sprite sheet of {len(items)} separate game skill icons arranged in a grid of {cols} columns and {rows} rows on a plain pure white background, '
            f'evenly spaced with generous white gaps between icons, no icon touching another, {ICON_STYLE}. Theme: a martial artist who fights with golden nen energy and lightning. '
            'In reading order (left to right, top to bottom): ' + '; '.join(f'({i + 1}) {t}' for i, (_, t) in enumerate(items)) + '. No text, no numbers, no labels.')


def post(prompt, refs, out, size):
    """发一个生图请求（参考图直接传本地文件，见 PLAYBOOK §4 生图参考图）"""
    base, key, _ = gi.load_cfg()
    payload = {'model': MODEL, 'prompt': prompt, 'n': 1, 'size': size, 'quality': 'high', 'response_format': 'b64_json'}
    if refs: payload['image'] = ['local:' + os.path.abspath(p) for p in refs]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    try:
        gi.save_images(gi.post_json(f'{base}/images/generations', key, payload, 900), out, False, False); print('ok  ', out, flush=True); return True
    except (SystemExit, OSError) as e:
        print('FAIL', out, str(e)[:200], flush=True); return False


def cmd_icons(a):
    for n, items in ICONS.items():
        if a.only and n not in a.only.split(','): continue
        out = os.path.join(OUT, 'icons', f'{n}.png')
        if os.path.exists(out) and not a.force: print('skip', n); continue
        post(icon_prompt(items), [], out, '2048x1536' if len(items) > 6 else '1536x1024')


def cmd_cutin(a):
    for k, d in CUTIN.items():
        if a.only and k not in a.only.split(','): continue
        out = os.path.join(OUT, 'cutin', f'{k}.png')
        if os.path.exists(out) and not a.force: print('skip', k); continue
        post(f'Using the reference character (same face, brown spiky hair and cute chibi art style: thick outlines, big head, hand-painted), draw {FIGHTER}. '
             f'Change only the outfit as described (no red clothes, no bandages, no headband). A dynamic dramatic upper-body close-up illustration for an ultimate-skill cut-in, facing right: {d}. Colors: teal, cream and gold outfit; golden yellow, white and warm orange glow effects (no magenta). Plain pure white background, no text.',
             [REF], out, '1536x1024')


def cmd_job(a):
    out = os.path.join(OUT, 'job_nenmaster.png')
    if os.path.exists(out) and not a.force: print('skip job'); return
    post(JOB, [REF], out, '1024x1536')


def recolor_red(im, hue):
    """把饱和的红色像素（色相 < 20° 或 > 340°）转到指定色相，明度 / 饱和度不变"""
    import colorsys
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, al = px[x, y]
            if not al: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.35 and (h < 20 / 360 or h > 340 / 360):
                r2, g2, b2 = colorsys.hsv_to_rgb(hue / 360, s * 0.85, v); px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), al)
    return im


def cmd_prep(a):
    import numpy as np
    sys.path.insert(0, os.path.dirname(__file__))
    from prep import remove_bg, components
    fin = os.path.join(HERE, 'final')
    for n, items in ICONS.items():
        p = os.path.join(OUT, 'icons', f'{n}.png')
        if not os.path.exists(p): continue
        arr = np.array(remove_bg(Image.open(p))); lab, comps = components(arr[..., 3], min_cells=200)
        boxes = []
        for c, _ in comps:
            ys, xs = np.where(lab == c)
            if ys.max() - ys.min() > 80 and xs.max() - xs.min() > 80: boxes.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, c))
        boxes.sort(key=lambda b: (b[0] + b[1]) / 2); rows, cur = [], []
        for b in boxes:
            if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > (b[1] - b[0]) * 0.5: rows.append(cur); cur = []
            cur.append(b)
        if cur: rows.append(cur)
        order = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
        print(n, 'found', len(order), 'expected', len(items))
        for (y0, y1, x0, x1, c), (name, _) in zip(order, items):
            crop = arr[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(lab[y0:y1, x0:x1] == c, crop[..., 3], 0)
            ic = Image.fromarray(crop, 'RGBA'); s = max(ic.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(ic, ((s - ic.width) // 2, (s - ic.height) // 2))
            ic = sq.resize((104, 104), Image.LANCZOS)
            if name == 'fn_cloth': ic = recolor_red(ic, 175)   # 布甲精通图标画成了红边白衣（散打的配色）→ 红色部分转成气功师长袍的青绿色，不重新生图
            ic.save(os.path.join(fin, 'icon', f'{name}.webp'), 'WEBP', quality=84, method=6)
    p = os.path.join(OUT, 'job_nenmaster.png')
    if os.path.exists(p):
        im = remove_bg(Image.open(p)); im = im.crop(im.getchannel('A').getbbox()); k = 720 / im.height
        im.resize((round(im.width * k), 720), Image.LANCZOS).save(os.path.join(fin, 'job', 'nenmaster.webp'), 'WEBP', quality=82, method=6); print('job')
    for k in CUTIN:
        p = os.path.join(OUT, 'cutin', f'{k}.png')
        if os.path.exists(p): remove_bg(Image.open(p)).resize((720, 480), Image.LANCZOS).save(os.path.join(fin, 'cutin', f'{k}.webp'), 'WEBP', quality=82, method=6); print('cutin', k)


def cmd_contact(a):
    """审图总览：原图（图标表 + 插图 + 立绘）缩小拼成一张"""
    ims = [p for p in [os.path.join(OUT, 'icons', f'{n}.png') for n in ICONS] + [os.path.join(OUT, 'cutin', f'{k}.png') for k in CUTIN] + [os.path.join(OUT, 'job_nenmaster.png')] if os.path.exists(p)]
    if not ims: print('nothing'); return
    H = 420; tiles = []
    for p in ims:
        im = Image.open(p).convert('RGB'); k = H / im.height; tiles.append((os.path.basename(p), im.resize((round(im.width * k), H))))
    W = sum(t.width for _, t in tiles) + 10 * len(tiles); sheet = Image.new('RGB', (W, H + 24), (40, 40, 46)); d = ImageDraw.Draw(sheet); x = 0
    for n, t in tiles: sheet.paste(t, (x, 24)); d.text((x + 4, 4), n, fill=(255, 230, 120)); x += t.width + 10
    out = os.path.join(OUT, 'contact.png'); sheet.save(out); print(out, sheet.size)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('--only', default=''); ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    {'icons': cmd_icons, 'cutin': cmd_cutin, 'job': cmd_job, 'prep': cmd_prep, 'contact': cmd_contact}[a.cmd](a)


if __name__ == '__main__':
    main()
