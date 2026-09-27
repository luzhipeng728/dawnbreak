#!/usr/bin/env python3
"""天空之城美术流水线（地下城内容组）：参考立绘 → 动作表 → 切帧；三层手绘背景。
复用 jobs.py（画风常量、背景提示词）、sheets.py（上传缓存）、sheets2.py（动作表提示词）、frames2.py（切帧），不修改它们。
AI 原图写到主仓库 art/src/sky/（不进 git），最终 webp 写到本仓库 art/final/spr/<id>/、art/final/bg/。

  sky_art.py refs   [--only 前缀]     参考立绘 → <主仓库>/art/src/sky/<id>_ref.png
  sky_art.py sheets [--only 前缀]     动作表 walk / run / act / more → <主仓库>/art/src/sky/sheets2/<id>_<表>.png
  sky_art.py cut    [--only 前缀]     切帧 → art/final/spr/<id>/*.webp + spr.json（预览在 <主仓库>/art/src/sky/cut/）
  sky_art.py bg     [--only 前缀]     背景远景 / 地面 → <主仓库>/art/src/sky/bg/<主题>_{far,floor}.png
  sky_art.py edge   [--only 前缀]     交界带（以远景为参考）→ <主仓库>/art/src/sky/bg/<主题>_edge.png
  sky_art.py bgcut  [--only 前缀]     背景裁切 → art/final/bg/<主题>_{far,floor,edge}.webp
生图并发固定 2（全队共用一个账号）；遇到 429 退避 65 秒。已存在的输出自动跳过。
"""
import os, sys, json, time, argparse, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # 本仓库 art/
MAIN = '/Users/luzhipeng/projects/dawnbreak/art'                              # 主仓库 art/（原图共享目录）
SRC = os.path.join(MAIN, 'src', 'sky')
GI = os.path.expanduser('~/.claude/skills/gpt-image/scripts/gpt_image.py')
PAR = 2   # 生图并发上限

# ---- 怪物设定：外观、站立高度（世界单位）、攻击 / 施法描述、手持物；fly = 悬浮（切帧后整体抬高） ----
M = {
    'wyvern': dict(h=84, hold=None,
        desc='A small cute wyvern monster (a baby dragon that walks on two legs): teal-green scales with a cream belly, big leathery bat-like wings folded on its back, a short neck, a round snout with tiny fangs, big round yellow eyes, two sturdy clawed hind legs, small clawed hands, a long tail with an arrow-shaped tip.',
        atk='the snapping jaws and clawed feet', cast='spreading its wings wide and flapping hard', low='diving forward low with wings swept back'),
    'dragonman': dict(h=118, hold='holding the long rake-like polearm',
        desc='A dragonman warrior monster (a lizard-dragon humanoid): green reptilian scales, a dragon head with two small back-swept horns and a spiky frill, yellow slit eyes, a long thick tail, bronze shoulder armor, a leather belt and a torn brown kilt, clawed bare feet, holding a long wooden polearm with a wide three-pronged iron rake head.',
        atk='the long rake-like polearm', cast='raising the polearm overhead and roaring', low='lunging forward with the polearm thrust low'),
    'puppeteer': dict(h=76, hold='holding the wooden marionette control cross',
        desc='A small puppeteer monster (a magical servant of the Sky Castle): a short hunched creature in a muddy brown patched hooded robe, the deep pointed hood hides its face except two glowing orange eyes, long thin grey hands, holding a wooden marionette control cross with thin strings that dangle down to a tiny wooden puppet doll.',
        atk='the wooden marionette control cross', cast='raising both hands with glowing orange magic runes', low='crouching low and touching the ground with one hand'),
    'golem': dict(h=120, hold=None,
        desc='A stone golem monster: a chunky round-bodied golem built from brown clay-stone blocks with patches of moss, huge blocky stone fists, short thick stone legs, a small round head sunk between the shoulders with two glowing blue rune eyes, glowing blue rune cracks on the chest.',
        atk='both huge stone fists', cast='raising both stone fists high above the head', low='hunching forward with the fists on the ground'),
    'kargo': dict(h=72, hold='holding a throwing dart',
        desc='A kargo monster (a small sneaky imp): dark grey-blue skin, big pointy ears, a short black hood and a long red scarf, round green glowing night-vision goggles on its eyes, a belt full of throwing darts, pointed shoes, holding a throwing dart.',
        atk='the throwing dart', cast='throwing a dart overhand', low='crouching low ready to dash'),
    'expeller': dict(h=120, hold='holding the long sword',
        desc='An expeller knight monster (a haunted guard of the Sky Castle): dark steel full plate armor with gold trim, a closed great helm with a narrow visor slit glowing dark red, a tattered dark crimson cape and tabard, armored boots, holding a long straight sword.',
        atk='the long sword', cast='raising the long sword high overhead', low='dashing forward low with the sword held forward'),
    'lucas': dict(h=132, hold='holding the lightning trident',
        desc='Lucas, a dragonman chieftain boss monster: a big blue-green scaled dragon humanoid with large curved horns, a glowing electric-blue crest on his head, yellow eyes, ornate gold and navy blue armor with shoulder spikes, a short dark blue cape, a long thick tail, holding a golden trident spear crackling with blue lightning, small sparks around him.',
        atk='the lightning trident', cast='raising the trident overhead as blue lightning crackles around his whole body', low='crouching low with the trident held back'),
    'dogrey': dict(h=130, hold='holding the marionette scepter',
        desc='Dogrey the Puppet King boss monster: a creepy-cute giant marionette king, a wooden puppet body with visible round ball joints, a pale white porcelain mask face with a painted wide smile and hollow violet eyes, a tall crooked golden crown, a royal purple and gold coat with frills, thin marionette strings rising from his shoulders and wrists straight up, holding a golden scepter shaped like a marionette control cross.',
        atk='the marionette scepter', cast='lifting both arms as violet puppet strings shoot out from his fingers', low='bending forward with arms dangling like a puppet'),
    'platani': dict(h=150, hold=None,
        desc='Platani the Golden Giant boss monster: a massive golden metal golem, bulky and top-heavy, huge golden fists, a small head with a single glowing orange eye slit, a glowing orange power core behind a grate on its chest, engraved runes and riveted golden plates, short thick legs.',
        atk='both huge golden fists', cast='slamming both golden fists together overhead with orange energy glowing', low='charging forward head-down with the shoulders first'),
    'skyExpeller': dict(h=130, hold='holding the glowing energy greatsword', holes=False,
        desc='The Sky Expeller boss monster: the elite commander knight of the Lord of Light, white-silver and gold plate armor, a horned great helm with a glowing red visor, a long royal-blue cape, holding a greatsword with a glowing golden energy blade crackling with lightning.',
        atk='the glowing energy greatsword', cast='raising the greatsword to the sky as lightning strikes down onto it', low='dashing forward very low with the greatsword trailing behind'),
    'seghart': dict(h=132, hold=None, holes=False,
        desc='Seghart, the Lord of Light boss monster: a tall elegant warrior-lord with extremely long flowing golden-white hair reaching his ankles, glowing golden eyes, a radiant white and gold ornate armor, a golden halo ring floating behind his back, a white cape, bright light glowing around his bare hands, no weapon.',
        atk='a whip of his long glowing hair', cast='raising one hand as a blinding ring of light bursts around him', low='sweeping one arm low releasing a line of light'),
    'sinEye': dict(h=112, hold=None, fly=True,
        desc='The Eye of Sin boss monster: a giant floating demonic eyeball with a huge crimson-purple iris and a slit pupil, wrapped in a cracked grey stone shell shaped like heavy eyelids, small purple tentacles and floating stone fragments hanging below it, a dark purple aura, no legs, hovering above the ground.',
        atk='a lunge of its stone shell', cast='opening its eye wide as a purple laser charges in the pupil', low='tilting down and glaring at the ground'),
}
FLY = {  # 悬浮怪物：走 / 跑没有腿，自定义循环
    'walk': ['floating and bobbing slightly up', 'floating at the top of the bob, tentacles trailing', 'floating and bobbing down', 'floating at the lowest point of the bob',
             'floating and bobbing up again, tilted slightly forward', 'floating high, tentacles swaying back', 'floating down, tentacles swaying forward', 'floating low, eye glancing forward'],
    'run': ['drifting forward fast tilted forward, tentacles streaming behind', 'drifting forward fast, tentacles whipping behind', 'drifting forward fast, bobbing up', 'drifting forward fast, bobbing down',
            'drifting forward fast tilted forward, fragments trailing', 'drifting forward fast, tentacles whipping behind', 'drifting forward fast, bobbing up', 'drifting forward fast, bobbing down'],
}
HOVER = {'sinEye': 34}   # 悬浮高度（世界单位）：画面整体抬高，影子留在地上

# ---- 背景主题：远景 / 地面 / 交界带 ----
BG = {
    'skyTower': ('A sky castle tower terrace high above the clouds in bright daylight: tall white and sandstone tower walls with arched windows and blue banners, a vast sea of fluffy white clouds below, floating rocks and distant floating towers, clear blue sky, a few birds.',
                 'a white-grey stone brick terrace floor with thin inlaid gold lines, a few cracks with tiny moss and wind-blown petals, bright daylight',
                 'a low white stone balustrade railing with small broken columns and potted plants, fluffy clouds peeking between the posts'),
    'skyHall': ('The puppet entrance hall inside a sky castle: a grand marble hall with rows of lifelike cold stone statues of adventurers on pedestals, violet velvet curtains, thin marionette strings hanging from the high ceiling, candle chandeliers, eerie cozy purple light.',
                'a polished checkered marble floor in violet and cream tiles with a few scattered wooden puppet parts and candle wax drips',
                'a row of small stone statues on low pedestals, broken wooden puppet dolls, candle stands and a velvet rope barrier'),
    'skyDark': ('A pitch-dark gothic corridor deep inside a sky castle: black stone arches and pillars fading into darkness, rows of armored knight statues whose visors glow faint red, dim red wall torches, thick shadows, a cold eerie atmosphere but still cute cartoon style.',
                'a dark cracked flagstone corridor floor with a long faded red carpet runner, dust and a few fallen stones, dim red torchlight',
                'broken knight statue pieces, iron candle stands with red candles, dark stone rubble and a torn red banner'),
    'skyPalace': ('The radiant throne palace at the top of the sky castle: golden and white marble colonnades, huge stained glass windows glowing with sunlight, soft light rays, a distant empty golden throne, white clouds and blue sky visible outside, sacred and majestic.',
                  'a white marble palace floor with golden filigree patterns and soft light reflections, bright warm light',
                  'a low golden balustrade with white marble pillars, glowing light crystals and white flower planters'),
}
# 地面贴图缩放宽度（参照 bgs.py：越窄纹理越小）
FLOOR_W = {'skyTower': 1800, 'skyHall': 1700, 'skyDark': 1600, 'skyPalace': 1800}


def gen(out, prompt, size, model=None, refs=()):
    """调用 gpt-image 技能脚本；429 退避 65 秒，其他错误短暂重试。"""
    if os.path.exists(out): return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cmd = ['python3', GI, 'edit' if refs else 'gen', prompt, '-o', out, '-s', size, '-q', 'high']
    for r in refs: cmd += ['-i', r]
    if model: cmd += ['-m', model]
    t = time.time(); err = ''
    for attempt in range(6):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out): return f'ok   {os.path.basename(out)}  {time.time() - t:.0f}s'
        err = (r.stderr + r.stdout)[-300:]
        time.sleep(65 if '429' in err else 8 + attempt * 6)
    return f'FAIL {os.path.basename(out)}: {err}'


def sheet_job(name, sheet):
    """动作表：用 sheets2 的提示词；走 / 跑带姿势参考图（悬浮怪物改用自定义循环）。"""
    import sheets2
    d = M[name]; ref = os.path.join(SRC, f'{name}_ref.png'); out = os.path.join(SRC, 'sheets2', f'{name}_{sheet}.png')
    if sheet in ('walk', 'run'):
        if d.get('fly'): return out, sheets2.prompt(FLY[sheet], None), [ref]
        return out, sheets2.guide_prompt(sheet, d['hold']), [ref, os.path.join(MAIN, 'src', f'guide_{sheet}.png')]
    atk, cast, low = d['atk'], d['cast'], d['low']
    frames = {
        'act': [f'attack wind-up start: pulling back {atk}', f'attack wind-up peak: {atk} raised high, body coiled', f'attack strike: swinging {atk} down and forward with force',
                f'attack follow-through: {atk} low in front, leaning forward', 'hurt: flinching backward', 'hurt harder: knocked back, upper body bent backward',
                'knocked into the air: body horizontal tumbling backward mid-air', 'lying knocked down flat on the back on the ground'],
        'more': [f'{cast}, beginning', f'{cast}, at full power', f'crouching low, preparing for {low}', f'{low} forward, body stretched low',
                 'getting up from the ground on one knee', 'leaping in the air', 'standing idle, breathing in with the chest up', 'laughing and taunting'],
    }[sheet]
    return out, sheets2.prompt(frames, None), [ref]


def clear_holes(im, thr=236, min_area=400):
    """去掉被主体包围的白底（武器和身体之间露出的白色）。frames2 的 fill_holes 只认 ≥251 的纯白，
    生图的白底常有 240~255 的噪点，会留下斑点；这里放宽到 thr 且要求低饱和，再把边缘的浅色抗锯齿一起去掉。"""
    from collections import deque
    from prep import dilate
    a = np.array(im); rgb = a[..., :3].astype(np.int16)
    W = (rgb.min(-1) >= thr) & (rgb.max(-1) - rgb.min(-1) <= 14) & (a[..., 3] > 0)
    h, w = W.shape; f = 2; hs, ws = h // f, w // f
    Mk = W[:hs * f, :ws * f].reshape(hs, f, ws, f).sum(axis=(1, 3)) >= 3
    lab = np.zeros((hs, ws), np.int32); n = 0
    for y0, x0 in zip(*np.nonzero(Mk)):
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; dq = deque([(y0, x0)]); cells = []
        while dq:
            y, x = dq.popleft(); cells.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < hs and 0 <= nx < ws and Mk[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; dq.append((ny, nx))
        if len(cells) * f * f >= min_area:
            for y, x in cells: a[y * f:(y + 1) * f, x * f:(x + 1) * f, 3] = 0
    hole = a[..., 3] == 0; light = (a[..., :3].min(-1) >= 205) & ((a[..., :3].max(-1).astype(int) - a[..., :3].min(-1)) <= 24)
    for _ in range(4):
        grow = dilate(hole) & light & ~hole & (a[..., 3] > 0)
        if not grow.any(): break
        a[..., 3] = np.where(grow, 0, a[..., 3]); hole = hole | grow
    return Image.fromarray(a, 'RGBA')


def cut9(path, holes=True, n=9):
    """同 frames2.cut9，只是换成 clear_holes。"""
    from prep import remove_bg, components
    im = remove_bg(Image.open(path))
    if holes: im = clear_holes(im)                 # False：白色系角色（白甲、白发、白披风）不补洞，否则会把角色本身挖空
    arr = np.array(im)
    lab, comps = components(arr[..., 3], min_cells=4)
    boxes = []
    for c, cells in comps:
        ys, xs = np.where(lab == c); boxes.append({'ids': [c], 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1, 'cells': cells})
    boxes.sort(key=lambda b: -b['cells']); big, small = boxes[:n], boxes[n:]
    for s in small:
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        dist = lambda b: max(0, b['x0'] - cx, cx - b['x1']) + max(0, b['y0'] - cy, cy - b['y1'])
        b = min(big, key=dist)
        if dist(b) > 150: continue
        b['ids'].append(s['ids'][0]); b['x0'] = min(b['x0'], s['x0']); b['x1'] = max(b['x1'], s['x1']); b['y0'] = min(b['y0'], s['y0']); b['y1'] = max(b['y1'], s['y1'])
    H = arr.shape[0]
    for b in big: b['row'] = min(2, int((b['y0'] + b['y1']) / 2 / (H / 3)))
    return im, arr, lab, sorted(big, key=lambda b: (b['row'], b['x0']))


def cut(name):
    """切帧：同 frames2.py 的做法（走 / 跑按躯干中线 + 行基线对齐，其余按脚底对齐），比例按参考站姿统一。"""
    from frames2 import names_for, CYCLE
    RES = 2.0
    src = os.path.join(SRC, 'sheets2'); pv_dir = os.path.join(SRC, 'cut'); os.makedirs(pv_dir, exist_ok=True)
    out = os.path.join(HERE, 'final', 'spr', name)
    if os.path.isdir(out):
        for x in os.listdir(out): os.remove(os.path.join(out, x))
    os.makedirs(out, exist_ok=True)
    meta = {'res': RES, 'frames': {}}
    for sheet in ('walk', 'run', 'act', 'more'):
        path = os.path.join(src, f'{name}_{sheet}.png')
        if not os.path.exists(path): print(f'  缺少 {name}_{sheet}'); continue
        names = names_for(name, sheet)
        im, arr, lab, order = cut9(path, M[name].get('holes', True))
        rows_ok = [sum(1 for b in order if b['row'] == r) for r in range(3)]
        bad = len(order) != 9 or rows_ok != [3, 3, 3]
        print(f'{name}_{sheet}: {len(order)} frames rows={rows_ok}{"  <-- CHECK" if bad else ""}')
        pv = Image.new('RGB', im.size, (60, 64, 72)); pv.paste(im, (0, 0), im); dr = ImageDraw.Draw(pv)
        for i, b in enumerate(order):
            dr.rectangle([b['x0'], b['y0'], b['x1'], b['y1']], outline=(255, 220, 60), width=3); dr.text((b['x0'] + 4, b['y0'] + 4), f'{i} {names[i] if i < len(names) else "?"}', fill=(255, 60, 60))
        pv.thumbnail((900, 900)); pv.save(os.path.join(pv_dir, f'{name}_{sheet}.png'))
        if not order: continue
        ref = order[0]; k = M[name]['h'] * RES / (ref['y1'] - ref['y0'])
        base = {r: max(b['y1'] for b in order if b['row'] == r) for r in range(3) if any(b['row'] == r for b in order)}
        for b, fn in zip(order, names):
            if fn is None or fn in meta['frames']: continue
            sub = arr[b['y0']:b['y1'], b['x0']:b['x1']].copy(); sub[..., 3] = np.where(np.isin(lab[b['y0']:b['y1'], b['x0']:b['x1']], b['ids']), sub[..., 3], 0)
            a = sub[..., 3] > 40; h = a.shape[0]
            if sheet in CYCLE:
                xs = np.where(a[int(h * 0.15):int(h * 0.55)])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
                ay = base[b['row']] - b['y0']
            else:
                rows = np.where(a.any(1))[0]; bottom = rows.max() + 1
                xs = np.where(a[max(0, bottom - int(h * 0.12)):bottom])[1]; ax = float(np.median(xs)) if len(xs) else a.shape[1] / 2
                ay = bottom
            fr = Image.fromarray(sub, 'RGBA'); sm = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS)
            sm.save(os.path.join(out, f'{fn}.webp'), 'WEBP', quality=76, method=6)
            lift = HOVER.get(name, 0) * RES if fn not in ('down', 'air') else 0
            meta['frames'][fn] = {'w': sm.width, 'h': sm.height, 'ax': round(ax * k, 1), 'ay': round(ay * k + lift, 1)}
    json.dump(meta, open(os.path.join(out, 'spr.json'), 'w'), indent=1)
    tot = sum(os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith('.webp'))
    print(f'  -> {name}: {len(meta["frames"])} frames, {tot // 1024} KB')


def bgcut(t):
    """同 bgs.py：远景 1650 宽截 22%~92%；地面缩到 FLOOR_W 截 470 高；交界带去背后缩到 1400 宽，底部 35% 渐隐。"""
    from prep import remove_bg
    out = os.path.join(HERE, 'final', 'bg'); os.makedirs(out, exist_ok=True)
    s = lambda k: os.path.join(SRC, 'bg', f'{t}_{k}.png')
    if os.path.exists(s('far')):
        im = Image.open(s('far')).convert('RGB'); W = 1650; im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS); H = im.height
        im.crop((0, round(H * 0.22), W, round(H * 0.92))).save(f'{out}/{t}_far.webp', 'WEBP', quality=70, method=6)
    if os.path.exists(s('floor')):
        fw = FLOOR_W[t]; fl = Image.open(s('floor')).convert('RGB'); fl = fl.resize((fw, round(fl.height * fw / fl.width)), Image.LANCZOS); h = 470; y0 = (fl.height - h) // 2
        fl.crop((0, y0, fw, y0 + h)).save(f'{out}/{t}_floor.webp', 'WEBP', quality=68, method=6)
    if os.path.exists(s('edge')):
        e = remove_bg(Image.open(s('edge'))); ew = 1400; e = e.resize((ew, round(e.height * ew / e.width)), Image.LANCZOS)
        bb = e.getbbox(); e = e.crop((0, bb[1], ew, bb[3])); e = e.crop((0, 0, ew, round(e.height * 0.75)))
        a = np.array(e).astype(np.float32); h = a.shape[0]; f0 = round(h * 0.65)
        ramp = np.ones(h, np.float32); ramp[f0:] = np.linspace(1, 0, h - f0); a[..., 3] *= ramp[:, None]
        Image.fromarray(a.astype(np.uint8), 'RGBA').save(f'{out}/{t}_edge.webp', 'WEBP', quality=72, method=6)
    print(t, *[f'{k}:{os.path.getsize(f"{out}/{t}_{k}.webp") // 1024}K' for k in ('far', 'floor', 'edge') if os.path.exists(f'{out}/{t}_{k}.webp')])


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('phase'); ap.add_argument('--only', default=''); ap.add_argument('--sheets', default='walk,run,act,more'); a = ap.parse_args()
    import jobs
    L = []
    if a.phase == 'refs':
        for n, d in M.items():
            if n.startswith(a.only): L.append((os.path.join(SRC, f'{n}_ref.png'), f'Full-body character design image for a 2D side-scrolling beat-em-up game. {jobs.POSE} {d["desc"]} {jobs.REF_TAIL}', '1024x1536', 'gpt-image-2.5-sunburst', ()))
    elif a.phase == 'sheets':
        for n in M:
            if not n.startswith(a.only): continue
            for sh in a.sheets.split(','):
                out, prompt, refs = sheet_job(n, sh); L.append((out, prompt, '2048x2048', 'gpt-image-2.5-sunburst', refs))
    elif a.phase in ('bg', 'edge'):
        for t, d in BG.items():
            if not t.startswith(a.only): continue
            jobs.BG[t] = d
            if a.phase == 'bg':
                L.append((os.path.join(SRC, 'bg', f'{t}_far.png'), jobs.far_prompt(t), '3840x2160', None, ()))
                L.append((os.path.join(SRC, 'bg', f'{t}_floor.png'), jobs.floor_prompt(t), '3840x2160', None, ()))
            else:
                L.append((os.path.join(SRC, 'bg', f'{t}_edge.png'), jobs.edge_prompt(t), '3840x2160', None, (os.path.join(SRC, 'bg', f'{t}_far.png'),)))
    elif a.phase == 'cut':
        for n in M:
            if n.startswith(a.only): cut(n)
        return
    elif a.phase == 'bgcut':
        for t in BG:
            if t.startswith(a.only): bgcut(t)
        return
    print(f'{len(L)} jobs, {PAR} parallel', flush=True)
    with ThreadPoolExecutor(PAR) as ex:
        for f in as_completed([ex.submit(gen, *j) for j in L]): print(f.result(), flush=True)


if __name__ == '__main__':
    main()
