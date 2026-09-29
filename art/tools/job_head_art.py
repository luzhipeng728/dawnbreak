#!/usr/bin/env python3
"""转职头饰（每个转职一件，按头部锚点叠加，见 src/content/avatar/job_looks.js 和 docs/JOB_VISUALS.md §5）
  job_head_art.py gen  [id,...] [-j 3] [--force]   生图（参考 = 职业立绘 + 转职立绘）→ 主仓库 art/src/avatar/jobhead/<id>.png
  job_head_art.py prep [id,...]                    去白底、去碎块、按宽度缩放 → art/final/avatar/job_<id>.webp
  job_head_art.py sheet [id,...]                   原图拼一张审图 → art/src/avatar/jobhead/review.png
id = 头饰 key 去掉 job_ 前缀；在头上的位置 / 缩放写在 job_looks.js 的 AVATAR_ACC.job_<id>.pos。
"""
import os, sys, argparse
import numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(__file__))
from prep import remove_bg, components
import avatar_gen as AG
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(AG.OUT, 'jobhead')
OVER = 1.25   # 和 avatar_acc.py 一样：图比游戏里画的大 1.25 倍（AVATAR_ACC_SCALE = 0.8）
SIDE = 'seen in strict side view (profile) as worn by a character facing RIGHT'
BAND = f'{SIDE} on an invisible head: only the near side of the band is drawn, as a slightly curved horizontal strip'
# id: (职业, 转职, 在帧里的宽度（帧像素）, 设计)
HEADS = {
    'blade_band': ('sword', 'blade', 84, f'a navy-blue cloth headband (hachimaki) {BAND}, with a small silver metal plate at the front (right end) and a knot at the back (left end) with two long flowing navy-blue tails fluttering to the left'),
    'ranger_hat': ('gun', 'ranger', 100, f'a black leather cowboy hat {SIDE}, with a dark red hat band and one big blood-red rose on the side of the crown, brim curled up at the sides'),
    'elemental_tiara': ('mage', 'elemental', 60, f'a slender silver circlet (tiara) {BAND}, with one big glowing ice-blue crystal at the front (right end) and three small gems (red, yellow and purple) along the band'),
    'soulbender_charm': ('sword', 'soulbender', 16, f'a vertical yellow paper exorcist talisman with a glowing purple ghost rune painted on it, hanging from a small purple bead cord and a tiny silver hairpin at the top, {SIDE}'),
    'berserker_bandage': ('sword', 'berserker', 84, f'a charcoal-black torn cloth headband with a thin crimson-red trim line along both edges and a few small dark blood drips, {BAND}, with two ragged torn ends fluttering to the left at the back; clean bold dark outline, flat cel shading, NO white or pale parts (it is worn on dark red hair and must read as one solid dark band)'),   # 第一版白绷带 + 血点：在红发上看着像没染到的浅色斑块
    'ghostblade_mask': ('sword', 'ghostblade', 46, f'a black cloth half-face mask that covers the nose and mouth (ninja style) with thin pale-blue trim, {SIDE}: the mask profile points to the right with a strap going back to the left'),
    'launcher_goggles': ('gun', 'launcher', 78, f'big round steampunk goggles with thick brass frames and glowing orange lenses on a thick brown leather strap, pushed up on the forehead, {SIDE}: one round lens in front (right) and the strap curving back to the left'),
    'mechanic_cap': ('gun', 'mechanic', 92, f'a yellow-and-grey mechanic work cap (baseball cap with the visor pointing right) with a silver gear emblem on the side and a small wrench pin, {SIDE}'),
    'spitfire_bandana': ('gun', 'spitfire', 92, f'a red combat bandana tied over the top of the head (covering the whole top of the head like a cap) with a small brass bullet charm, a knot at the back (left) and two short tails fluttering to the left, {SIDE}'),
    'paramedic_headset': ('gun', 'paramedic', 52, f'a white-and-blue futuristic tactical headset {SIDE}: one big round white ear cup with a glowing cyan ring, a short headband arc going over the top, a thin microphone boom pointing forward to the right and a small antenna'),
    'battlemage_band': ('mage', 'battlemage', 84, f'a red martial-arts cloth headband {BAND}, with a small gold plate at the front (right end) and a knot at the back (left end) with two long red tails with gold tips fluttering to the left'),
    'summoner_horns': ('mage', 'summoner', 50, f'one curled ram horn (dark purple with glowing violet runes and a gold tip) that grows from the side of the head and curls around the ear, {SIDE}; a single horn only, spiral shape'),
    'witch_glasses': ('mage', 'witch', 44, f'a pair of big round glasses with thick gold frames and a thin gold chain hanging from the temple, {SIDE}: one big round lens rim in front (right) and one thin temple arm going back to the left'),
    'enchantress_bow': ('mage', 'enchantress', 54, f'a big gothic lolita ribbon bow hair ornament in black and crimson with lace edges and one red rose in the knot, two ribbon tails hanging down, {SIDE}, worn at the back of the head'),
}

def jobs(ids):
    L = []
    for i in ids:
        cls, job, _, desc = HEADS[i]
        refs = [os.path.join(AG.SRC, f'{cls}_ref.png'), os.path.join(HERE, 'final', 'job', f'{job}.webp')]
        refs = [p for p in refs if os.path.exists(p)]
        L.append({'out': os.path.join(SRC, f'{i}.png'), 'refs': [_png(p) for p in refs], 'size': '1024x1024',
                  'prompt': ('2D game costume accessory sprite for a cute chibi action RPG, matching the art style of the character in the reference images '
                             '(bold dark outlines, clean cel shading, bright saturated colors). Draw exactly ONE accessory, large and centered: '
                             f'{desc}. No character, no head, no face, no hair, no hands, no text, no shadow, no background scenery. Plain pure white background.')})
    return L

def _png(p):   # 参考图统一转 png（上传接口不收 webp）
    if p.endswith('.png'): return p
    q = os.path.join(SRC, 'refs', os.path.basename(p)[:-5] + '.png'); os.makedirs(os.path.dirname(q), exist_ok=True)
    if not os.path.exists(q): Image.open(p).convert('RGB').save(q)
    return q

def run(job, base, key, force):   # 参考图直接传本地文件（gpt-image 路由按各家的方式传；不走 sheets.upload 的旧上传缓存，里面的地址会过期）
    out = job['out']
    if os.path.exists(out) and not force: return f'skip {os.path.basename(out)}'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    payload = {'model': 'gpt-image-2.5-sunburst', 'prompt': job['prompt'], 'n': 1, 'size': job['size'], 'quality': 'high', 'response_format': 'b64_json',
               'image': ['local:' + os.path.abspath(p) for p in job['refs']]}
    try:
        AG.gi.save_images(AG.gi.post_json(f'{base}/images/generations', key, payload, 900), out, False, False); return f'ok   {os.path.basename(out)}'
    except (SystemExit, OSError) as e: return f'FAIL {os.path.basename(out)}: {str(e)[:200]}'

def prep(ids):
    outd = os.path.join(HERE, 'final', 'avatar'); os.makedirs(outd, exist_ok=True)
    for i in ids:
        p = os.path.join(SRC, f'{i}.png')
        if not os.path.exists(p): print(f'  {i}: 没有原图'); continue
        a = np.array(remove_bg(Image.open(p)))
        lab, comps = components(a[..., 3], min_cells=6)
        big = max(c[1] for c in comps); keep = [c for c, n in comps if n >= big * 0.02]   # 去掉零星碎点
        a[..., 3] = np.where(np.isin(lab, keep), a[..., 3], 0)
        ys, xs = np.where(a[..., 3] > 30); sub = Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
        k = HEADS[i][2] * OVER / sub.width
        sm = sub.resize((max(1, round(sub.width * k)), max(1, round(sub.height * k))), Image.LANCZOS)
        sm.save(os.path.join(outd, f'job_{i}.webp'), 'WEBP', quality=90, method=6)
        print(f'  job_{i}: {sm.width}x{sm.height}')

def sheet(ids):
    ims = [Image.open(os.path.join(SRC, f'{i}.png')).convert('RGB').resize((320, 320)) for i in ids if os.path.exists(os.path.join(SRC, f'{i}.png'))]
    out = Image.new('RGB', (330 * max(1, len(ims)), 320), (255, 255, 255))
    for k, im in enumerate(ims): out.paste(im, (k * 330, 0))
    out.save(os.path.join(SRC, 'review.png')); print(os.path.join(SRC, 'review.png'))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('ids', nargs='?', default=''); ap.add_argument('-j', type=int, default=3); ap.add_argument('--force', action='store_true')
    a = ap.parse_args(); ids = [i for i in a.ids.split(',') if i] or list(HEADS)
    for i in ids:
        if i not in HEADS: sys.exit('未知头饰 ' + i)
    if a.cmd == 'prep': return prep(ids)
    if a.cmd == 'sheet': return sheet(ids)
    if a.cmd != 'gen': sys.exit('未知命令 ' + a.cmd)
    base, key, _ = AG.gi.load_cfg(); L = jobs(ids); print(f'{len(L)} jobs', flush=True)
    with ThreadPoolExecutor(min(3, a.j)) as ex:
        for f in as_completed([ex.submit(run, j, base, key, a.force) for j in L]): print(f.result(), flush=True)

if __name__ == '__main__':
    main()
