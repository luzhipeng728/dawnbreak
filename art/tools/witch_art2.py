#!/usr/bin/env python3
"""魔道学者的图标 / 觉醒插图 / 一觉 4 台机械 / 四个助手的立绘（沿用 combatgen.py 的画风和调用；一次只跑 1 路，另一路给 witch_art.py）。
  witch_art2.py icons [--only 表]    技能图标表 → <主仓库>/art/src/combat/icons/wt_icons_{a,b}.png；iconcut 切到 art/final/icon/
  witch_art2.py iconcut
  witch_art2.py cutin [--only 名]    觉醒插图 → <主仓库>/art/src/combat/cutin/witch{,2,3}.png；cutinprep → art/final/cutin/
  witch_art2.py cutinprep
  witch_art2.py awk                  一觉的 4 台机械（一张动作表，画风参考已通过的加热炉）→ <主仓库>/art/src/witch/sheets2/wtAwk_act.png（之后 witch_art.py cut --only wtAwk）
  witch_art2.py helpers              四个助手站成一排（一张图）→ 切成 helperJack / helperSnow / helperEel / helperCat 的参考立绘
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import combatgen as C
import jobs

WSRC = os.path.join(C.MAIN, 'src', 'witch')
ICONS_A = [
    ('wt_broom', 'a cute witch broom flying with a sparkle trail and a small wizard hat hanging on the handle'),
    ('wt_affinity', 'four tiny familiars huddled together with a heart: a pumpkin-head, a little snowman, a yellow electric eel and a black cat'),
    ('wt_book', 'an ancient thick magic tome glowing with violet runes and a bookmark ribbon'),
    ('wt_shululu', 'a pumpkin-head rag doll in a pink frilly dress taunting with its tongue out'),
    ('wt_missile', 'a yellow star-shaped magic missile chaining between three targets with thin lightning links'),
    ('wt_cloak', 'a huge black shadow cloak billowing and wrapping around a small silhouette'),
    ('wt_powder', 'a broom sprinkling sparkling blue ice powder and green poison powder from its bristles'),
    ('wt_lucky', 'a swirly rainbow lollipop with a four-leaf clover and sparkles'),
    ('wt_swatter', 'a giant warm yellow-orange fly swatter slamming down with a purple impact star'),
    ('wt_lava', 'a round glass potion flask with bubbling orange lava splashing out'),
    ('wt_acid', 'a small grey-green rain cloud dripping acid drops'),
    ('wt_swatlock', 'a fly swatter wrapped in chains with a padlock'),
    ('wt_spin', 'a broom spinning like a top with yellow swirl trails'),
    ('wt_tesla', 'a brass tesla tower with two blue eels on top and a wooden hamster wheel, yellow lightning bolts'),
    ('wt_bitter', 'a dark brown bitter lollipop with a grimacing face and a small explosion'),
    ('wt_furnace', 'a round iron furnace machine with a jack-o-lantern face grate and leather bellows on top, shooting fire stones'),
    ('wt_antigrav', 'a small brass device with cat ears and a purple lens lifting little silhouettes into the air'),
    ('wt_detonate', 'a big red detonator button with a lit fuse'),
    ('wt_drill', 'a snowman-shaped drill car on caterpillar treads with a big ice-blue spiral drill'),
    ('wt_premonition', 'a glowing pink candy above a shining lucky star'),
    ('wt_awaken', 'four fantastic magic machines assembled together around a big wooden hammer and gears, golden glow'),
    ('wt_candy', 'a round pink swirl candy in a twisted wrapper with sparkles'),
    ('q_wt_candle', 'a lit candle with a bright flame that never goes out, wax dripping'),
    ('q_wt_ice', 'a chunk of blue crystal ice that never melts, with frost sparkles'),
]
ICONS_B = [
    ('wt_superswat', 'an enormous fly swatter smashing down with a big purple shockwave'),
    ('wt_rabbit', 'a cute white and brass rabbit robot shooting a yellow electric beam from its nozzle mouth'),
    ('wt_stone', 'a glowing red philosopher\'s stone crystal floating over an alchemy circle'),
    ('wt_helper', 'four small hooded homunculus helpers waving: pumpkin, snowman, electric eel and black cat themed hoods'),
    ('wt_shaved', 'a snowman-shaped shaved-ice machine with a crank and a bowl of colorful shaved ice, frost swirl'),
    ('wt_lollipop', 'a giant swirly lollipop smashing down with small black and white candy dolls popping out'),
    ('wt_awaken2', 'a purple and gold mechanical snake ring biting its own tail on caterpillar treads, pink glow'),
    ('wt_pink', 'a glowing pink candy made from a red philosopher\'s stone, with sparkles and hearts'),
    ('wt_trickjack', 'a giant grinning jack-o-lantern helper in a small witch hat spraying lava from a nozzle'),
    ('wt_awaken3', 'a cute roller coaster train with a pumpkin-shaped front cart racing on a loop track, fireworks'),
    ('q_wt_orb', 'a crackling cold electric orb, pale blue with small yellow sparks and frost'),
    ('q_wt_mask', 'a soft pink sleeping eye mask with cute closed eyes embroidered on it and a small zzz'),
]
C.ICON_SHEETS = {'wt_icons_a': ICONS_A, 'wt_icons_b': ICONS_B}
ICON_SIZE = {'wt_icons_a': '1536x2048', 'wt_icons_b': '2048x1536'}
C.CUTIN = {
    'witch': ('mage', 'grinning and holding up a big wooden hammer while riding a flying broom, four fantastic steampunk magic machines being assembled behind her, '
                      'a pumpkin-head, a snowman, an electric eel and a black cat familiar cheering around her'),
    'witch2': ('mage', 'standing proudly on top of a purple and gold mechanical snake ring vehicle, holding up a glowing red philosopher\'s stone, four little hooded homunculus helpers beside her'),
    'witch3': ('mage', 'shouting with joy in the front seat of a cute roller coaster racing through a candy amusement park, holding a giant pink candy, her familiars riding behind her'),
}
AWK_FRAMES = [
    'the electric field generator, idle: a brass tripod machine with a big yellow glass orb on top and two copper coil antennas',
    'the same electric field generator, the orb glowing blinding bright yellow-white',
    'the pumpkin factory, idle: a boxy orange workshop machine with a pumpkin-shaped chimney and a round hatch on the front, riveted brass',
    'the same pumpkin factory with its front hatch flung wide open',
    'the snowman spinner, idle: a round white snowman-shaped machine on a brass turntable with a scoop arm and a red scarf',
    'the same snowman spinner turned sideways mid-spin, the scoop arm swung out',
    'the giant cat machine, mouth closed: a huge black cat-head shaped machine on short brass legs, pointy ears, round yellow eyes, about one and a half times taller than the other machines',
    'the same giant cat machine with its big hinged mouth wide open and a boxing glove on a spring punching forward out of it',
]
def awk_job():
    items = '; '.join(f'({i + 2}) {t}' for i, t in enumerate(AWK_FRAMES))
    prompt = ('Using the same art style as this reference machine (cute cartoon steampunk magic machine, chunky rounded shapes, riveted brass and iron, bold clean outlines, soft cel shading, bright colors), '
              'draw a professional 2D game SPRITE SHEET of four different magic machines: 9 frames at the same scale, every frame in strict side view FACING RIGHT, arranged in a grid of 3 columns and 3 rows, '
              'with wide empty white gaps so that no frame touches another; the bottoms of the machines in each row sit on the same baseline. NO person, nobody operating them. '
              f'Frames in reading order (left to right, top to bottom): (1) the electric field generator, idle (size reference); {items}. '
              'No smoke, no sparks, no lightning, no motion lines, no effects outside the machines. Plain pure white background, no ground, no shadows, no text.')
    return {'out': os.path.join(WSRC, 'sheets2', 'wtAwk_act.png'), 'ref': os.path.join(WSRC, 'furnace_ref.png'), 'size': '2048x2048', 'model': 'gpt-image-2.5-sunburst', 'prompt': prompt}
HELPERS = [('helperJack', 'a pumpkin-head hood, an orange and black work dress, a little lantern at the belt'), ('helperSnow', 'a white snowman-shaped hood with a carrot nose on it and a knitted red scarf, a white work dress'),
           ('helperEel', 'a yellow raincoat with an electric-eel shaped hood with little fins, rubber boots'), ('helperCat', 'a black cat-eared hood, a black and purple work dress, a long black cat tail')]
def helpers_job():
    items = '; '.join(f'({i + 1}) {d}' for i, (_, d) in enumerate(HELPERS))
    prompt = (f'Character design lineup for a 2D side-scrolling beat-em-up game: four cute familiar homunculus helpers standing side by side in one row, all the SAME size (small, child-sized), full body, '
              f'each in strict side view profile facing RIGHT, neutral standing pose, round faces, big eyes, work gloves, modest outfits, wide empty gaps between them. Left to right: {items}. '
              f'Art style: {jobs.CHIBI}. Plain pure white background, no ground shadow, no text.')
    return {'out': os.path.join(WSRC, '_helpers_lineup.png'), 'size': '2048x1152', 'model': 'gpt-image-2.5-sunburst', 'prompt': prompt}
def helpers_split():
    """四个助手的排队图 → 各自的参考立绘（白底，按连通块从左到右）"""
    import numpy as np
    from PIL import Image
    from prep import remove_bg, components
    im = remove_bg(Image.open(os.path.join(WSRC, '_helpers_lineup.png'))); arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=4); comps = sorted(comps, key=lambda c: -c[1])[:12]
    boxes = []
    for c, _ in comps:
        ys, xs = np.where(lab == c); boxes.append([xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, [c]])
    big = sorted(boxes, key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))[:4]
    for b in boxes:   # 小碎块并到最近的大块
        if b in big: continue
        cx = (b[0] + b[2]) / 2; t = min(big, key=lambda g: abs((g[0] + g[2]) / 2 - cx)); t[0], t[1], t[2], t[3] = min(t[0], b[0]), min(t[1], b[1]), max(t[2], b[2]), max(t[3], b[3]); t[4] += b[4]
    for (name, _), b in zip(HELPERS, sorted(big, key=lambda g: g[0])):
        sub = arr[b[1]:b[3], b[0]:b[2]].copy(); sub[..., 3] = np.where(np.isin(lab[b[1]:b[3], b[0]:b[2]], b[4]), sub[..., 3], 0)
        fg = Image.fromarray(sub, 'RGBA'); k = 1200 / fg.height; fg = fg.resize((round(fg.width * k), 1200), Image.LANCZOS)
        cv = Image.new('RGB', (1024, 1536), (255, 255, 255)); cv.paste(fg, ((1024 - fg.width) // 2, 168), fg); cv.save(os.path.join(WSRC, f'{name}_ref.png')); print(name, fg.size)

def main():
    a = sys.argv[1:]; ph = a[0]; only = a[a.index('--only') + 1] if '--only' in a else ''
    if ph == 'icons': L = [{'out': os.path.join(C.OUT, 'icons', f'{n}.png'), 'prompt': C.icon_prompt([d for _, d in it]), 'size': ICON_SIZE[n]} for n, it in C.ICON_SHEETS.items() if n.startswith(only or 'wt_')]
    elif ph == 'iconcut': import icons; sys.argv = ['icons.py', '--combat', '--only', only or 'wt_icons']; icons.main(); return
    elif ph == 'cutin': L = [j for j in C.cutin_jobs() if os.path.basename(j['out']).startswith(only or 'witch')]
    elif ph == 'cutinprep': C.cutin_prep(); return
    elif ph == 'awk': L = [awk_job()]
    elif ph == 'helpers': L = [helpers_job()]
    elif ph == 'helpersplit': helpers_split(); return
    else: raise SystemExit(__doc__)
    for j in L: print(C.run(j), flush=True)
    if ph == 'helpers': helpers_split()

if __name__ == '__main__':
    main()
